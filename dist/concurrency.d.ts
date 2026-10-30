import type { Clock } from '@arki/clock';
import type { FailureOf } from '@arki/failure';
/** Cancellation for concurrency operations. */
export type SignalOptions = {
    readonly signal?: AbortSignal;
};
/** Deadline timer configuration. */
export type TimeoutOptions = SignalOptions & {
    readonly clock?: Clock;
};
/** Admission limit for ordered concurrent work. */
export type ConcurrencyOptions = SignalOptions & {
    readonly concurrency?: number;
};
declare function pool<I, O>(name: string, items: Iterable<I>, fn: (item: I, signal: AbortSignal, index: number) => Promise<O>, options: ConcurrencyOptions): Promise<O[] | import("@arki/failure").Failure<"async.cancelled", undefined> | import("@arki/failure").Failure<"failure.unexpected_defect", undefined>>;
/** Ordered concurrent mapping. Fulfilled Failure values remain explicit result elements. Started work is joined. */
export declare function mapConcurrent<Item, Mapper extends (item: Item, signal: AbortSignal, index: number) => Promise<unknown>>(items: Iterable<Item>, fn: Mapper, options?: ConcurrencyOptions): Promise<Awaited<ReturnType<Mapper>>[] | FailureOf<typeof pool>>;
/** Per-position Promise values, with owned cancellation and callback defects returned separately. */
export declare function all<const Tasks extends readonly ((signal: AbortSignal) => Promise<unknown>)[]>(tasks: Tasks, options?: ConcurrencyOptions): Promise<{
    -readonly [Key in keyof Tasks]: Awaited<ReturnType<Tasks[Key]>>;
} | FailureOf<typeof pool>>;
/** First fulfilled Promise value wins; losing tasks are cancelled and joined. An empty race is static misuse. */
export declare function race<const Tasks extends readonly ((signal: AbortSignal) => Promise<unknown>)[]>(tasks: Tasks, options?: SignalOptions): Promise<Awaited<ReturnType<Tasks[number]>> | FailureOf<typeof raceRuntime>>;
declare function raceRuntime(tasks: readonly ((signal: AbortSignal) => Promise<unknown>)[], options: SignalOptions): Promise<import("@arki/failure").Failure<"async.cancelled", undefined> | import("@arki/failure").Failure<"failure.unexpected_defect", undefined> | {
    value: unknown;
}>;
/** Returns the task value or an owned deadline/cancellation/defect. Uncooperative late task settlement is observed. */
export declare function timeout<Task extends (signal: AbortSignal) => Promise<unknown>>(task: Task, ms: number, options?: TimeoutOptions): Promise<Awaited<ReturnType<Task>> | FailureOf<typeof timeoutRuntime>>;
declare function timeoutRuntime<T>(task: (signal: AbortSignal) => Promise<T>, ms: number, options: TimeoutOptions): Promise<import("@arki/failure").Failure<"async.cancelled", undefined> | import("@arki/failure").Failure<"async.deadline", undefined> | import("@arki/failure").Failure<"failure.unexpected_defect", undefined> | {
    value: T;
}>;
export {};
//# sourceMappingURL=concurrency.d.ts.map