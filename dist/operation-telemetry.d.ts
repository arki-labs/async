import type { Context } from '@opentelemetry/api';
/** Ignore a reporter's recursive invocation until the original callback has produced its result. */
export declare function runObservedContext<Value>(owned: Context | undefined, run: () => Value): Value;
/** One span per orchestration call; instrumentation never owns callback execution. */
export declare function operationTelemetry(name: string): {
    run<Value>(run: () => Value): Value;
    end(outcome?: unknown): void;
};
//# sourceMappingURL=operation-telemetry.d.ts.map