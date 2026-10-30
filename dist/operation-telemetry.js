import { context, metrics, SpanStatusCode, trace } from '@opentelemetry/api';
import packageMetadata from '@arki/async/package.json' with { type: 'json' };
import { isFailure } from '@arki/failure';
import { systemClock } from './system-clock.js';
function observe(report) {
    try {
        const value = report();
        void Promise.resolve(value).catch(() => {
            /* Reporting never owns execution. */
        });
        return value;
    }
    catch {
        return;
    }
}
/** Ignore a reporter's recursive invocation until the original callback has produced its result. */
export function runObservedContext(owned, run) {
    const invocation = { running: false };
    const invoke = () => {
        if (invocation.running)
            return;
        if (invocation.outcome === undefined) {
            invocation.running = true;
            try {
                invocation.outcome = { value: run() };
            }
            catch (error) {
                invocation.outcome = { cause: error };
            }
            finally {
                invocation.running = false;
            }
        }
        if ('cause' in invocation.outcome)
            throw invocation.outcome.cause;
        return invocation.outcome.value;
    };
    if (owned !== undefined)
        observe(() => context.with(owned, invoke));
    invoke();
    const outcome = invocation.outcome;
    if (outcome === undefined)
        throw new Error('Unreachable: telemetry callback has no synchronous result');
    if ('cause' in outcome)
        throw outcome.cause;
    return outcome.value;
}
/** One span per orchestration call; instrumentation never owns callback execution. */
export function operationTelemetry(name) {
    const span = observe(() => trace.getTracer('@arki/async', packageMetadata.version).startSpan(name));
    const owned = observe(() => (span === undefined ? context.active() : trace.setSpan(context.active(), span)));
    const started = observe(() => systemClock.now().getTime());
    let ended = false;
    return {
        run(run) {
            return runObservedContext(owned, run);
        },
        end(outcome) {
            if (ended)
                return;
            ended = true;
            const failure = isFailure(outcome) ? outcome : undefined;
            observe(() => span?.setStatus({ code: failure === undefined ? SpanStatusCode.OK : SpanStatusCode.ERROR }));
            if (failure !== undefined)
                observe(() => span?.setAttributes({ 'failure.code': failure.code, 'failure.status': failure.status }));
            observe(() => {
                if (started === undefined)
                    return;
                metrics
                    .getMeter('@arki/async', packageMetadata.version)
                    .createHistogram('async.operation.duration', {
                    unit: 'ms',
                    description: 'Owned concurrency operation duration.',
                })
                    .record(Math.max(0, systemClock.now().getTime() - started), { 'async.operation': name, 'async.outcome': failure === undefined ? 'ok' : 'failed' }, owned);
            });
            observe(() => span?.end());
        },
    };
}
//# sourceMappingURL=operation-telemetry.js.map