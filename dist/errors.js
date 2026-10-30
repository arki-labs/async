import { defineFailure, UnexpectedDefect } from '@arki/failure';
import { is, recordSchema } from '@arki/schema';
/**
 * Owned execution returns typed failures. Static setup misuse throws an
 * {@link AsyncError}. Both expose stable codes for classification.
 */
/** Stable error codes of `@arki/async`. */
export const ASYNC_ERROR_CODES = {
    /**
     * A wait is negative, `NaN`, not finite, or above {@link MAX_WAIT_MS}.
     *
     * @fix Pass a finite wait from 0 up to `MAX_WAIT_MS` (about 24.8 days). For a longer wait, sleep again when the timer fires.
     * @verify bun run test
     */
    invalidWait: 'ARKI_ASYNC_E001',
    /**
     * A `concurrency` limit is not a positive integer or `Infinity`.
     *
     * @fix Pass a whole number of at least 1, or leave `concurrency` out for no limit.
     * @verify bun run test
     */
    invalidConcurrency: 'ARKI_ASYNC_E005',
};
/** Longest wait a timer can hold: 2^31 - 1 ms (about 24.8 days). Larger values fire at once in most runtimes. */
export const MAX_WAIT_MS = 2_147_483_647;
/** A coded failure of any `@arki/async` helper. */
export class AsyncError extends Error {
    code;
    /** What to do about it, in one sentence. */
    remediation;
    constructor(code, message, remediation, options) {
        super(`${code}: ${message}`, options);
        this.name = 'AsyncError';
        this.code = code;
        this.remediation = remediation;
    }
}
/** @internal Throws E001 unless `value` is a finite number from 0 to {@link MAX_WAIT_MS}. */
export function assertWait(fn, name, value) {
    if (typeof value !== 'number' || !isValidWait(value))
        throw invalidWait(fn, name, value);
}
/** @internal NaN fails both comparisons, so it is rejected too. */
export function isValidWait(value) {
    return typeof value === 'number' && value >= 0 && value <= MAX_WAIT_MS;
}
/** @internal */
export function invalidWait(fn, name, value) {
    return new AsyncError(ASYNC_ERROR_CODES.invalidWait, `${fn}() needs ${name} to be a number from 0 to ${MAX_WAIT_MS} milliseconds, got ${String(value)}`, `Pass a finite ${name} between 0 and ${MAX_WAIT_MS}. For longer waits, schedule again when the timer fires.`);
}
/** @internal NaN, 0, negatives and fractions fail; `Infinity` means no limit. */
export function isValidConcurrency(value) {
    return typeof value === 'number' && (value === Number.POSITIVE_INFINITY || (Number.isInteger(value) && value >= 1));
}
/** @internal E005: `concurrency` is not a positive integer or `Infinity`. */
export function invalidConcurrency(fn, value) {
    return new AsyncError(ASYNC_ERROR_CODES.invalidConcurrency, `${fn}() needs concurrency to be a positive integer or Infinity, got ${String(value)}`, 'Pass a whole number of at least 1, or Infinity (the default) for no limit.');
}
/** Owned execution was cancelled; the external reason stays private.
 * @fix Honor the signal and handle cancellation at the calling boundary.
 * @verify bun run test
 */
export const Cancelled = defineFailure('async.cancelled', {
    status: 499,
    remediation: 'Honor the owned signal and handle cancellation.',
});
/** An owned deadline elapsed; work still needs cooperative settlement.
 * @fix Allow more time or make work honor the owned signal.
 * @verify bun run test
 */
export const Deadline = defineFailure('async.deadline', {
    status: 504,
    remediation: 'Allow more time or honor the owned signal.',
});
/** Canonical failures normalized by every scope. */
export const SUPERVISOR_FAILURES = [Cancelled, Deadline, UnexpectedDefect];
function validateScopeCounts(value) {
    if (is(value, recordSchema) && 'primaryCount' in value && 'cleanupCount' in value) {
        const { primaryCount, cleanupCount } = value;
        if (typeof primaryCount === 'number' &&
            Number.isSafeInteger(primaryCount) &&
            primaryCount >= 0 &&
            typeof cleanupCount === 'number' &&
            Number.isSafeInteger(cleanupCount) &&
            cleanupCount >= 0) {
            return { value: { primaryCount, cleanupCount } };
        }
    }
    return { issues: [{ message: 'Expected nonnegative primary/cleanup counts.' }] };
}
const scopeCounts = { '~standard': { version: 1, vendor: 'arki-async', validate: validateScopeCounts } };
/** Multiple owned failures; public counts serialize while original members stay private.
 * @fix Inspect the local typed cause and address every failure.
 * @verify bun run test
 */
export const ScopeFailed = defineFailure('async.scope_failed', {
    status: 500,
    data: scopeCounts,
    remediation: 'Inspect every primary and cleanup failure in the local cause.',
});
function scopeCause(primary, cleanup) {
    return Object.freeze({
        primary: Object.freeze([...primary]),
        cleanup: Object.freeze([...cleanup]),
    });
}
export function scopeAggregate(primary, cleanup) {
    return ScopeFailed({ primaryCount: primary.length, cleanupCount: cleanup.length }, { cause: scopeCause(primary, cleanup) });
}
//# sourceMappingURL=errors.js.map