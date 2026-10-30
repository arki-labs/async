import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { Failure, FailureOf } from '@arki/failure';
/**
 * Owned execution returns typed failures. Static setup misuse throws an
 * {@link AsyncError}. Both expose stable codes for classification.
 */
/** Stable error codes of `@arki/async`. */
export declare const ASYNC_ERROR_CODES: {
    /**
     * A wait is negative, `NaN`, not finite, or above {@link MAX_WAIT_MS}.
     *
     * @fix Pass a finite wait from 0 up to `MAX_WAIT_MS` (about 24.8 days). For a longer wait, sleep again when the timer fires.
     * @verify bun run test
     */
    readonly invalidWait: 'ARKI_ASYNC_E001';
    /**
     * A `concurrency` limit is not a positive integer or `Infinity`.
     *
     * @fix Pass a whole number of at least 1, or leave `concurrency` out for no limit.
     * @verify bun run test
     */
    readonly invalidConcurrency: 'ARKI_ASYNC_E005';
};
/** The code of an {@link AsyncError}. */
export type AsyncErrorCode = (typeof ASYNC_ERROR_CODES)[keyof typeof ASYNC_ERROR_CODES];
/** Longest wait a timer can hold: 2^31 - 1 ms (about 24.8 days). Larger values fire at once in most runtimes. */
export declare const MAX_WAIT_MS = 2147483647;
/** A coded failure of any `@arki/async` helper. */
export declare class AsyncError extends Error {
    readonly code: AsyncErrorCode;
    /** What to do about it, in one sentence. */
    readonly remediation: string;
    constructor(code: AsyncErrorCode, message: string, remediation: string, options?: ErrorOptions);
}
/** Owned execution was cancelled; the external reason stays private.
 * @fix Honor the signal and handle cancellation at the calling boundary.
 * @verify bun run test
 */
export declare const Cancelled: import("@arki/failure").FailureDefinition<"async.cancelled", undefined>;
/** An owned deadline elapsed; work still needs cooperative settlement.
 * @fix Allow more time or make work honor the owned signal.
 * @verify bun run test
 */
export declare const Deadline: import("@arki/failure").FailureDefinition<"async.deadline", undefined>;
/** Canonical failures normalized by every scope. */
export declare const SUPERVISOR_FAILURES: readonly [import("@arki/failure").FailureDefinition<"async.cancelled", undefined>, import("@arki/failure").FailureDefinition<"async.deadline", undefined>, import("@arki/failure").FailureDefinition<"failure.unexpected_defect", undefined>];
/** The exact canonical supervisor union. */
export type SupervisorFailure = ReturnType<(typeof SUPERVISOR_FAILURES)[number]>;
/** Multiple owned failures; public counts serialize while original members stay private.
 * @fix Inspect the local typed cause and address every failure.
 * @verify bun run test
 */
export declare const ScopeFailed: import("@arki/failure").FailureDefinition<"async.scope_failed", StandardSchemaV1<unknown, {
    primaryCount: number;
    cleanupCount: number;
}>>;
declare function scopeCause<Primary extends Failure, Cleanup extends Failure>(primary: readonly Primary[], cleanup: readonly Cleanup[]): Readonly<{
    primary: readonly Primary[];
    cleanup: readonly Cleanup[];
}>;
/** Exact local members; revived ScopeFailed values retain only public counts. */
export type ScopeAggregate<Primary extends Failure, Cleanup extends Failure> = FailureOf<typeof ScopeFailed> & {
    readonly cause: ReturnType<typeof scopeCause<Primary, Cleanup>>;
};
/** Keep exact original members in the existing private cause. */
export declare function scopeAggregate<Primary extends Failure, Cleanup extends Failure>(primary: readonly Primary[], cleanup: readonly Cleanup[]): ScopeAggregate<Primary, Cleanup>;
export {};
//# sourceMappingURL=errors.d.ts.map