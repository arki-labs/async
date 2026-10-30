import { SleepCancelled } from '@arki/clock';
import { UnexpectedDefect } from '@arki/failure';
import { assertWait, Cancelled } from './errors.js';
import { systemClock } from './system-clock.js';
export function sleep(ms, options = {}) {
    return sleepRuntime(ms, options);
}
async function sleepRuntime(ms, options) {
    assertWait('sleep', 'ms', ms);
    try {
        const result = await (options.clock ?? systemClock).sleep(ms, options.signal);
        if (SleepCancelled.is(result))
            return Cancelled({ cause: result.cause });
        if (UnexpectedDefect.is(result))
            return result;
        if (result !== undefined)
            return UnexpectedDefect({ cause: result });
        return;
    }
    catch (error) {
        return UnexpectedDefect.is(error) ? error : UnexpectedDefect({ cause: error });
    }
}
//# sourceMappingURL=sleep.js.map