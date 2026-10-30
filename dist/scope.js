import { SleepCancelled } from '@arki/clock';
import { isFailure, UnexpectedDefect } from '@arki/failure';
import { Cancelled, Deadline, scopeAggregate } from './errors.js';
import { scopeTelemetry } from './scope-telemetry.js';
import { linkedController } from './signal.js';
import { watchSignal } from './watch-signal.js';
const EntryTag = Symbol('scope.entry');
function acquired(value) {
    return !isFailure(value);
}
function refused(value) {
    return isFailure(value);
}
function createResource(open, close) {
    // Promise returns preserve output variance: a Failure cannot be discarded as void.
    const acquire = async (signal) => open(signal);
    const release = async (value) => close(value);
    return {
        [EntryTag]: true,
        kind: 'resource',
        open: acquire,
        close: release,
        async prepare(signal) {
            const value = await acquire(signal);
            if (refused(value))
                return value;
            if (acquired(value))
                return { value, close: () => release(value) };
            throw new Error('Unreachable resource result');
        },
    };
}
function createCleanup(close) {
    return { [EntryTag]: true, kind: 'cleanup', close: async () => close() };
}
function createChild(run) {
    return { [EntryTag]: true, kind: 'child', run: async (signal) => run(signal) };
}
/** Define an acquisition and its correlated finalizer without starting either. */
export function resource(open, close) {
    return createResource(open, close);
}
/** Define a finalizer whose failure contract participates in scope closure. */
export function cleanup(close) {
    return createCleanup(close);
}
/** Define child work whose settlement is joined before resource finalization. */
export function child(run) {
    return createChild(run);
}
/** Recognize an inert resource without acquiring it. */
export function isResource(value) {
    return isScopeEntry(value) && value.kind === 'resource';
}
/** Recognize a descriptor constructed by this module. */
export function isScopeEntry(value) {
    return typeof value === 'object' && value !== null && EntryTag in value && value[EntryTag] === true;
}
// One outcome reducer retains exact original failures; no extra wrapper on success.
function finish(value, primary, cleanup) {
    if (primary.length === 0 && cleanup.length === 0)
        return value;
    if (primary.length === 1 && cleanup.length === 0)
        return primary[0];
    if (primary.length === 0 && cleanup.length === 1)
        return cleanup[0];
    return scopeAggregate(primary, cleanup);
}
export async function openScope(plan, options = {}) {
    return openScopeRuntime(plan, options);
}
async function openScopeRuntime(plan, options = {}) {
    const state = lifetimeRuntime(options);
    for (const [name, entry] of Object.entries(plan)) {
        if (state.signal.aborted)
            break;
        if (entry.kind === 'resource') {
            const opened = await state.acquire(entry.prepare);
            if (refused(opened)) {
                state.fail(opened);
                break;
            }
            Object.defineProperty(state.values, name, { value: opened, enumerable: true });
        }
        else if (entry.kind === 'cleanup') {
            // eslint-disable-next-line failure/must-use -- The owner already retains signal cancellation and closes below.
            state.defer(entry.close);
        }
        else {
            // eslint-disable-next-line failure/must-use -- The owner already retains signal cancellation and joins the child below.
            state.fork(entry.run);
        }
    }
    if (state.signal.aborted || state.hasFailure()) {
        const failed = await state.close();
        return refused(failed) ? failed : UnexpectedDefect({ cause: new Error('Failed scope lost its failure') });
    }
    return {
        values: state.values,
        signal: state.signal,
        close: state.close,
        async complete(body) {
            let value;
            try {
                value = await state.run(() => body(state.values, state.signal));
                if (refused(value))
                    state.fail(value);
            }
            catch (error) {
                const failure = state.defect(error);
                if (failure !== undefined)
                    state.fail(failure);
            }
            const closed = await state.close();
            return refused(closed) ? closed : value;
        },
    };
}
export async function scoped(plan, body, options = {}) {
    const opened = await openScopeRuntime(plan, options);
    if (refused(opened))
        return opened;
    return opened.complete(body);
}
export function createLifetime(options) {
    return lifetimeRuntime(options);
}
function lifetimeRuntime(options) {
    const telemetry = scopeTelemetry();
    const { controller, unlink } = linkedController();
    const ownedReason = Object.freeze({ owner: 'scope.stop' });
    const primary = [];
    const cleanupFailures = [];
    const finalizers = [];
    const children = [];
    const acquisitions = [];
    const values = {};
    let admission = true;
    let closing;
    let quieting;
    const abort = (failure) => {
        if ((Cancelled.is(failure) || SleepCancelled.is(failure)) && failure.cause === ownedReason)
            return;
        if (!primary.includes(failure))
            primary.push(failure);
        controller.abort(ownedReason);
    };
    const unwatchSignal = watchSignal(options.signal, reason => abort(Cancelled({ cause: reason })), abort);
    const unwatchDeadline = watchSignal(options.deadline, reason => abort(Deadline({ cause: reason })), abort);
    const normalize = (error) => {
        if (controller.signal.reason === ownedReason && error === ownedReason)
            return;
        return UnexpectedDefect({ cause: error });
    };
    const finalize = async (run) => {
        try {
            const result = await telemetry.run(run);
            if (refused(result))
                cleanupFailures.push(result);
        }
        catch (error) {
            cleanupFailures.push(UnexpectedDefect({ cause: error }));
        }
    };
    const accepting = () => admission && !controller.signal.aborted;
    function acquire(prepare) {
        if (!accepting())
            return Promise.resolve(Cancelled({ cause: ownedReason }));
        // Track admission before user code can synchronously close this lifetime.
        const acquiring = Promise.resolve().then(async () => {
            try {
                const prepared = await telemetry.run(() => prepare(controller.signal));
                if (refused(prepared)) {
                    abort(prepared);
                    return prepared;
                }
                const run = prepared.close;
                // Even late resources stay alive until every admitted child has joined.
                finalizers.push(() => run());
                return accepting() ? prepared.value : Cancelled({ cause: ownedReason });
            }
            catch (error) {
                const failure = normalize(error) ?? Cancelled({ cause: ownedReason });
                abort(failure);
                return failure;
            }
        });
        acquisitions.push(acquiring);
        return acquiring;
    }
    function defer(run) {
        if (!admission || controller.signal.aborted)
            return Cancelled({ cause: ownedReason });
        finalizers.push(run);
        return;
    }
    function fork(run) {
        if (!admission || controller.signal.aborted)
            return Cancelled({ cause: ownedReason });
        children.push(Promise.resolve()
            .then(() => telemetry.run(() => run(controller.signal)))
            .then(value => {
            if (refused(value)) {
                if ((Cancelled.is(value) || SleepCancelled.is(value)) &&
                    controller.signal.reason === ownedReason &&
                    value.cause === ownedReason)
                    return;
                abort(value);
            }
        }, error => {
            const failure = normalize(error);
            if (failure !== undefined)
                abort(failure);
        }));
        return;
    }
    function quiesce() {
        if (quieting !== undefined)
            return quieting;
        admission = false;
        // Abort dispatch is synchronous and can re-enter quiesce/close.
        quieting = Promise.resolve()
            .then(() => Promise.all([...children, ...acquisitions]))
            .then(() => finish(undefined, primary, []));
        if (!controller.signal.aborted)
            controller.abort(ownedReason);
        return quieting;
    }
    function close() {
        if (closing !== undefined)
            return closing;
        closing = Promise.resolve().then(async () => {
            // eslint-disable-next-line failure/must-use -- Close reduces the retained primary failures after every finalizer.
            await quiesce();
            for (const finalizer of finalizers.reverse())
                await finalize(finalizer);
            for (const unwatch of [unwatchSignal, unwatchDeadline]) {
                const failure = await unwatch();
                if (failure !== undefined)
                    cleanupFailures.push(failure);
            }
            unlink();
            const outcome = finish(undefined, primary, cleanupFailures);
            telemetry.end(outcome, primary, cleanupFailures, finalizers.length);
            return outcome;
        });
        // eslint-disable-next-line failure/must-use -- Close returns the retained primary and cleanup failures together.
        void quiesce();
        return closing;
    }
    return {
        values,
        signal: controller.signal,
        acquire,
        defer,
        fork,
        fail: abort,
        hasFailure: () => primary.length > 0,
        defect: normalize,
        quiesce,
        close,
        run: telemetry.run,
    };
}
function allowedFailure(definitions, value) {
    return definitions.some(definition => definition.is(value));
}
export function dynamicScope(definitions) {
    const checked = async (run) => {
        const value = await run();
        if (refused(value) && !allowedFailure(definitions, value))
            return UnexpectedDefect({ cause: value });
        return value;
    };
    return {
        async run(body, options = {}) {
            const state = lifetimeRuntime(options);
            const scope = runtimeRegistration(state);
            if (state.signal.aborted)
                return state.close();
            let value;
            try {
                value = await state.run(() => body(scope));
                if (refused(value))
                    state.fail(value);
            }
            catch (error) {
                const failure = state.defect(error);
                if (failure !== undefined)
                    state.fail(failure);
            }
            const closed = await state.close();
            return refused(closed) ? closed : value;
        },
    };
    function runtimeRegistration(state) {
        return {
            signal: state.signal,
            acquire(open, close) {
                return state.acquire(async (signal) => {
                    const value = await checked(() => open(signal));
                    if (refused(value))
                        return value;
                    return { value, close: () => checked(() => close(value)) };
                });
            },
            defer(close) {
                return state.defer(() => checked(close));
            },
            fork(run) {
                return state.fork(signal => checked(() => run(signal)));
            },
        };
    }
}
//# sourceMappingURL=scope.js.map