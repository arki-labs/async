import type { Failure } from '@arki/failure';
/** One span per owner, kept open through cancellation, joining and finalization. */
export declare function scopeTelemetry(): {
    /** A defective context manager must never skip, replay or replace user work. */
    run<Value>(this: void, run: () => Value): Value;
    end(outcome: void | Failure, primary: readonly Failure[], cleanup: readonly Failure[], finalizers: number): void;
};
//# sourceMappingURL=scope-telemetry.d.ts.map