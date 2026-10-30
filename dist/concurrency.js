import { isFailure, UnexpectedDefect } from '@arki/failure';
import { assertWait, Cancelled, Deadline, invalidConcurrency, isValidConcurrency } from './errors.js';
import { operationTelemetry } from './operation-telemetry.js';
import { sleep } from './sleep.js';
import { watchSignal } from './watch-signal.js';
async function pool(name, items, fn, options) {
    const { concurrency = Number.POSITIVE_INFINITY, signal } = options;
    if (!isValidConcurrency(concurrency))
        throw invalidConcurrency(name, concurrency);
    const telemetry = operationTelemetry(`async.${name}`);
    const controller = new AbortController();
    let cancelled;
    let defect;
    const results = [];
    const stopped = () => cancelled !== undefined || defect !== undefined;
    const fail = (failure) => {
        defect ??= failure;
        controller.abort(failure);
    };
    const unwatch = watchSignal(signal, reason => {
        if (stopped())
            return;
        cancelled = Cancelled({ cause: reason });
        controller.abort(cancelled);
    }, fail);
    try {
        if (!stopped()) {
            // Materialize before admission: iterator defects cannot orphan started work.
            const pending = [...items];
            const next = pending.entries();
            const worker = async () => {
                while (!stopped()) {
                    const step = next.next();
                    if (step.done)
                        return;
                    const [index, item] = step.value;
                    try {
                        results[index] = await telemetry.run(() => fn(item, controller.signal, index));
                    }
                    catch (error) {
                        fail(UnexpectedDefect.is(error) ? error : UnexpectedDefect({ cause: error }));
                    }
                }
            };
            await Promise.all(Array.from({ length: Math.min(concurrency, pending.length) }, worker));
        }
    }
    catch (error) {
        fail(UnexpectedDefect.is(error) ? error : UnexpectedDefect({ cause: error }));
    }
    const cleanup = await unwatch();
    if (cleanup !== undefined)
        defect = cleanup;
    const outcome = defect ?? cancelled ?? results;
    telemetry.end(outcome);
    return outcome;
}
export function mapConcurrent(items, fn, options = {}) {
    return pool('mapConcurrent', items, fn, options);
}
export function all(tasks, options = {}) {
    return pool('all', tasks, (task, signal) => task(signal), options);
}
export async function race(tasks, options = {}) {
    const outcome = await raceRuntime(tasks, options);
    return isFailure(outcome) ? outcome : outcome?.value;
}
async function raceRuntime(tasks, options) {
    if (tasks.length === 0)
        throw new AggregateError([], 'race() requires at least one task');
    const telemetry = operationTelemetry('async.race');
    const entries = tasks.map(task => ({ task, controller: new AbortController() }));
    const errors = [];
    let winner;
    let cancelled;
    let defect;
    const stop = () => {
        for (const entry of entries)
            entry.controller.abort(cancelled ?? defect);
    };
    const unwatch = watchSignal(options.signal, reason => {
        if (winner !== undefined || cancelled !== undefined || defect !== undefined)
            return;
        cancelled = Cancelled({ cause: reason });
        stop();
    }, failure => {
        defect = failure;
        stop();
    });
    if (cancelled === undefined && defect === undefined) {
        await Promise.all(entries.map(async ({ task, controller }, index) => {
            try {
                const value = await telemetry.run(() => task(controller.signal));
                if (winner === undefined && cancelled === undefined && defect === undefined) {
                    winner = { value };
                    for (const other of entries)
                        if (other.controller !== controller)
                            other.controller.abort();
                }
            }
            catch (error) {
                errors[index] = error;
            }
        }));
    }
    const cleanup = await unwatch();
    if (cleanup !== undefined)
        defect = cleanup;
    if (winner === undefined && cancelled === undefined && defect === undefined)
        defect = UnexpectedDefect({ cause: new AggregateError(errors, 'Every race task rejected') });
    const outcome = defect ?? cancelled ?? winner ?? UnexpectedDefect({ cause: new Error('Race lost its outcome') });
    telemetry.end(isFailure(outcome) ? outcome : outcome?.value);
    return outcome;
}
export async function timeout(task, ms, options = {}) {
    const outcome = await timeoutRuntime(task, ms, options);
    return isFailure(outcome) ? outcome : outcome.value;
}
async function timeoutRuntime(task, ms, options) {
    assertWait('timeout', 'ms', ms);
    const telemetry = operationTelemetry('async.timeout');
    const controller = new AbortController();
    const timer = new AbortController();
    let result;
    let cancelled;
    let deadline;
    let defect;
    let settled = false;
    let resolveCompletion;
    const completion = new Promise(resolve => {
        resolveCompletion = resolve;
    });
    const finish = () => {
        if (settled)
            return false;
        settled = true;
        resolveCompletion();
        return true;
    };
    const unwatch = watchSignal(options.signal, reason => {
        if (!finish())
            return;
        cancelled = Cancelled({ cause: reason });
        controller.abort(cancelled);
    }, failure => {
        if (!finish())
            return;
        defect = failure;
        controller.abort(failure);
    });
    let timing;
    if (!settled) {
        timing = sleep(ms, { clock: options.clock, signal: timer.signal }).then(outcome => {
            if (timer.signal.aborted) {
                if (UnexpectedDefect.is(outcome))
                    defect = outcome;
                return;
            }
            if (!finish())
                return;
            if (UnexpectedDefect.is(outcome))
                defect = outcome;
            else if (Cancelled.is(outcome))
                cancelled = outcome;
            else
                deadline = Deadline();
            controller.abort(defect ?? cancelled ?? deadline);
        });
        if (!settled)
            void (async () => {
                try {
                    const value = await telemetry.run(() => task(controller.signal));
                    if (finish())
                        result = { value };
                }
                catch (error) {
                    if (finish())
                        defect = UnexpectedDefect.is(error) ? error : UnexpectedDefect({ cause: error });
                }
            })();
    }
    await completion;
    timer.abort();
    await timing;
    const cleanup = await unwatch();
    if (cleanup !== undefined)
        defect = cleanup;
    const outcome = defect ?? cancelled ?? deadline ?? result ?? UnexpectedDefect({ cause: new Error('Timeout lost its outcome') });
    telemetry.end(isFailure(outcome) ? outcome : outcome.value);
    return outcome;
}
//# sourceMappingURL=concurrency.js.map