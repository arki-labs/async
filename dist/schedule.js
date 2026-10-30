import { assertWait } from './errors.js';
import { systemClock } from './system-clock.js';
/**
 * Same algorithm as lodash's debounce, so the two behave identically:
 * the latest arguments win, and a call that arrives while the timer runs
 * never starts a second timer.
 */
function schedule(name, fn, wait, leading, trailing, maxWait, clock) {
    assertWait(name, 'wait', wait);
    if (maxWait !== undefined)
        assertWait(name, 'maxWait', maxWait);
    const longest = maxWait === undefined ? undefined : Math.max(maxWait, wait);
    // `Date.now()` skips the `Date` that a clock's `now()` allocates on every call.
    const now = clock === undefined ? () => Date.now() : () => clock.now().getTime();
    const timers = clock ?? systemClock;
    let lastArgs;
    /** Cancels the running timer; `undefined` while none runs. */
    let timer;
    let lastCallTime;
    let lastInvokeTime = 0;
    const invoke = (time) => {
        const args = lastArgs;
        lastArgs = undefined;
        lastInvokeTime = time;
        if (args !== undefined)
            fn(...args);
    };
    const remaining = (time) => {
        const waiting = wait - (time - (lastCallTime ?? time));
        return longest === undefined ? waiting : Math.min(waiting, longest - (time - lastInvokeTime));
    };
    const shouldInvoke = (time) => {
        if (lastCallTime === undefined)
            return true;
        const sinceCall = time - lastCallTime;
        return sinceCall >= wait || sinceCall < 0 || (longest !== undefined && time - lastInvokeTime >= longest);
    };
    const trailingEdge = (time) => {
        timer = undefined;
        if (trailing && lastArgs !== undefined)
            invoke(time);
        else
            lastArgs = undefined;
    };
    const expired = () => {
        const time = now();
        if (shouldInvoke(time))
            trailingEdge(time);
        else
            timer = timers.setTimer(expired, remaining(time));
    };
    const scheduled = (...args) => {
        const time = now();
        const invoking = shouldInvoke(time);
        lastArgs = args;
        lastCallTime = time;
        if (invoking) {
            if (timer === undefined) {
                lastInvokeTime = time;
                timer = timers.setTimer(expired, wait);
                if (leading)
                    invoke(time);
                return;
            }
            if (longest !== undefined) {
                timer();
                timer = timers.setTimer(expired, wait);
                invoke(time);
                return;
            }
        }
        timer ??= timers.setTimer(expired, wait);
    };
    Object.defineProperties(scheduled, {
        cancel: {
            value: () => {
                if (timer !== undefined)
                    timer();
                lastInvokeTime = 0;
                lastArgs = lastCallTime = timer = undefined;
            },
        },
        flush: {
            value: () => {
                if (timer === undefined)
                    return;
                timer();
                trailingEdge(now());
            },
        },
        pending: { get: () => timer !== undefined },
    });
    if (!isScheduled(scheduled))
        throw new TypeError('unreachable: scheduled function is missing its controls');
    return scheduled;
}
/** Real check, so the compiler learns the shape from the runtime rather than from a cast. */
function isScheduled(f) {
    return 'cancel' in f && 'flush' in f && 'pending' in f;
}
/**
 * Delays `fn` until `wait` ms have passed without a new call. The latest
 * arguments win. Defaults: `leading: false`, `trailing: true`. Throws
 * `ARKI_ASYNC_E001` for an invalid `wait` or `maxWait`.
 */
export function debounce(fn, wait, options = {}) {
    return schedule('debounce', fn, wait, options.leading ?? false, options.trailing ?? true, options.maxWait, options.clock);
}
/**
 * Calls `fn` at most once per `wait` ms. It is a debounce with `maxWait = wait`.
 * Defaults: `leading: true`, `trailing: true`. Throws `ARKI_ASYNC_E001` for an invalid `wait`.
 */
export function throttle(fn, wait, options = {}) {
    return schedule('throttle', fn, wait, options.leading ?? true, options.trailing ?? true, wait, options.clock);
}
//# sourceMappingURL=schedule.js.map