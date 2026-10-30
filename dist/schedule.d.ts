import type { Clock } from '@arki/clock';
/** A debounced or throttled function. */
export type Scheduled<A extends readonly unknown[]> = {
    (...args: A): void;
    /** Drops the pending call and resets the timers. */
    cancel(): void;
    /** Runs the pending trailing call now, if there is one. */
    flush(): void;
    /** True while a timer is running and a call may still fire. */
    readonly pending: boolean;
};
/** Options of {@link debounce}. */
export type DebounceOptions = {
    /** Call on the first call of a burst. Default `false`. */
    readonly leading?: boolean;
    /** Call after the burst ends. Default `true`. */
    readonly trailing?: boolean;
    /** Longest time a burst may delay the call. Raised to `wait` when smaller. */
    readonly maxWait?: number;
    /** Whose time and timers to use. Default: the system clock. Pass a `MockClock` to make tests instant. */
    readonly clock?: Clock;
};
/** Options of {@link throttle}. */
export type ThrottleOptions = {
    /** Call on the first call of a window. Default `true`. */
    readonly leading?: boolean;
    /** Call at the end of the window with the latest arguments. Default `true`. */
    readonly trailing?: boolean;
    /** Whose time and timers to use. Default: the system clock. Pass a `MockClock` to make tests instant. */
    readonly clock?: Clock;
};
/**
 * Delays `fn` until `wait` ms have passed without a new call. The latest
 * arguments win. Defaults: `leading: false`, `trailing: true`. Throws
 * `ARKI_ASYNC_E001` for an invalid `wait` or `maxWait`.
 */
export declare function debounce<A extends readonly unknown[]>(fn: (...args: A) => void, wait: number, options?: DebounceOptions): Scheduled<A>;
/**
 * Calls `fn` at most once per `wait` ms. It is a debounce with `maxWait = wait`.
 * Defaults: `leading: true`, `trailing: true`. Throws `ARKI_ASYNC_E001` for an invalid `wait`.
 */
export declare function throttle<A extends readonly unknown[]>(fn: (...args: A) => void, wait: number, options?: ThrottleOptions): Scheduled<A>;
//# sourceMappingURL=schedule.d.ts.map