import { UnexpectedDefect } from '@arki/failure';
/** Observe a foreign signal without letting its registration or cleanup escape its owner. */
export declare function watchSignal(signal: AbortSignal | undefined, cancel: (reason: unknown) => void, defect: (failure: ReturnType<typeof UnexpectedDefect>) => void): () => Promise<import("@arki/failure").Failure<"failure.unexpected_defect", undefined> | undefined>;
//# sourceMappingURL=watch-signal.d.ts.map