import { UnexpectedDefect } from '@arki/failure';
/** Observe a foreign signal without letting its registration or cleanup escape its owner. */
export function watchSignal(signal, cancel, defect) {
    let attached = false;
    let closed = false;
    let notified = false;
    const onAbort = () => {
        if (closed || notified)
            return;
        notified = true;
        try {
            cancel(signal?.reason);
        }
        catch (error) {
            defect(UnexpectedDefect.is(error) ? error : UnexpectedDefect({ cause: error }));
        }
    };
    try {
        if (signal?.aborted)
            onAbort();
        else if (signal !== undefined) {
            attached = true;
            const registration = signal.addEventListener('abort', onAbort, { once: true });
            void Promise.resolve(registration).catch((error) => {
                if (!closed)
                    defect(UnexpectedDefect.is(error) ? error : UnexpectedDefect({ cause: error }));
            });
            if (signal.aborted)
                onAbort();
        }
    }
    catch (error) {
        defect(UnexpectedDefect.is(error) ? error : UnexpectedDefect({ cause: error }));
    }
    return async () => {
        if (closed)
            return;
        closed = true;
        if (!attached)
            return;
        try {
            const cleanup = signal?.removeEventListener('abort', onAbort);
            await cleanup;
            return;
        }
        catch (error) {
            return UnexpectedDefect.is(error) ? error : UnexpectedDefect({ cause: error });
        }
    };
}
//# sourceMappingURL=watch-signal.js.map