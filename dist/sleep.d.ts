import type { Clock } from '@arki/clock';
import type { FailureOf } from '@arki/failure';
import { Cancelled } from './errors.js';
/** Options of {@link sleep}. */
export type SleepOptions = {
    /** Cuts the wait short, returning Cancelled with the private signal reason. */
    readonly signal?: AbortSignal;
    /** Whose timer to wait on. Default: the system clock. */
    readonly clock?: Clock;
};
/** Waits for a timer, returning cancellation or a supervised provider defect. Invalid delays are static misuse. */
export declare function sleep(ms: number, options?: {
    readonly clock?: never;
    readonly signal?: never;
}): Promise<void | Exclude<FailureOf<typeof sleepRuntime>, ReturnType<typeof Cancelled>>>;
export declare function sleep(ms: number, options: SleepOptions): Promise<void | FailureOf<typeof sleepRuntime>>;
declare function sleepRuntime(ms: number, options: SleepOptions): Promise<import("@arki/failure").Failure<"async.cancelled", undefined> | import("@arki/failure").Failure<"failure.unexpected_defect", undefined> | undefined>;
export {};
//# sourceMappingURL=sleep.d.ts.map