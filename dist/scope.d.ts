/** Owned resources and child work with callback-inferred failure contracts. */
import type { Failure, FailureDefinition, FailureIn, FailureOf } from '@arki/failure';
import { UnexpectedDefect } from '@arki/failure';
import type { ScopeAggregate, SupervisorFailure } from './errors.js';
declare const EntryTag: unique symbol;
type SignalTask<Result> = (signal: AbortSignal) => Result;
type ResourceClose<Opened, Closed> = (value: Exclude<Awaited<Opened>, Failure>) => Closed;
type CleanupTask<Result> = () => Result;
declare function createResource<Opened, Closed>(open: SignalTask<Opened>, close: ResourceClose<Opened, Closed>): {
    [EntryTag]: true;
    kind: 'resource';
    open: (signal: AbortSignal) => Promise<Opened>;
    close: (value: Exclude<Awaited<Opened>, Failure>) => Promise<Closed>;
    prepare(this: void, signal: AbortSignal): Promise<{
        value: Exclude<Awaited<Opened>, Failure>;
        close: () => Promise<Closed>;
    } | FailureIn<Awaited<Opened>>>;
};
declare function createCleanup<Closed>(close: CleanupTask<Closed>): {
    [EntryTag]: true;
    kind: 'cleanup';
    close: () => Promise<Closed>;
};
declare function createChild<Ran>(run: SignalTask<Ran>): {
    [EntryTag]: true;
    kind: 'child';
    run: (signal: AbortSignal) => Promise<Ran>;
};
/** Named inferred descriptor types keep consumer declarations independent of private brands. */
export interface Resource<Opened, Closed> extends ReturnType<typeof createResource<Opened, Closed>> {
}
export interface Cleanup<Closed> extends ReturnType<typeof createCleanup<Closed>> {
}
export interface Child<Ran> extends ReturnType<typeof createChild<Ran>> {
}
/** Define an acquisition and its correlated finalizer without starting either. */
export declare function resource<Opened, Closed>(open: SignalTask<Opened>, close: ResourceClose<Opened, Closed>): Resource<Opened, Closed>;
/** Define a finalizer whose failure contract participates in scope closure. */
export declare function cleanup<Closed>(close: CleanupTask<Closed>): Cleanup<Closed>;
/** Define child work whose settlement is joined before resource finalization. */
export declare function child<Ran>(run: SignalTask<Ran>): Child<Ran>;
/** Recognize an inert resource without acquiring it. */
export declare function isResource(value: unknown): value is ReturnType<typeof resource>;
/** Recognize a descriptor constructed by this module. */
export declare function isScopeEntry(value: unknown): value is Entry;
type Entry = Pick<ReturnType<typeof resource>, typeof EntryTag | 'kind' | 'prepare'> | ReturnType<typeof cleanup> | ReturnType<typeof child>;
export type ScopePlan = Readonly<Record<string, Entry>>;
type Plan = ScopePlan;
type CallbackOutput<Descriptor> = Descriptor extends unknown ? {
    [Key in keyof Descriptor]: Descriptor[Key] extends (...args: never[]) => infer Result ? Awaited<Result> : never;
}[keyof Descriptor] : never;
/** Require inferred callback outcomes before an owner accepts a descriptor plan. */
export type CheckedPlan<P extends Plan> = {
    [Key in keyof P]: unknown extends CallbackOutput<P[Key]> ? never : P[Key];
};
type DescriptorFailure<Descriptor, Key extends PropertyKey> = Descriptor extends Record<Key, infer Fn extends (...args: never[]) => unknown> ? FailureOf<Fn> : never;
type CallbackFailure<P extends Plan, Key extends PropertyKey> = {
    [Name in keyof P]: DescriptorFailure<P[Name], Key>;
}[keyof P];
export type OpenFailure<P extends Plan> = CallbackFailure<P, 'open'>;
export type CleanupFailure<P extends Plan> = CallbackFailure<P, 'close'>;
export type ChildFailure<P extends Plan> = CallbackFailure<P, 'run'>;
export type Values<P extends Plan> = {
    readonly [Name in keyof P as P[Name] extends {
        kind: ReturnType<typeof resource>['kind'];
    } ? Name : never]: P[Name] extends {
        open: (...args: never[]) => infer Opened;
    } ? Exclude<Awaited<Opened>, Failure> : never;
};
type Outcome<Value, Primary extends Failure, Cleanup extends Failure> = Value | Primary | Cleanup | ScopeAggregate<Primary, Cleanup>;
type Primary<P extends Plan> = OpenFailure<P> | ChildFailure<P> | SupervisorFailure;
type Closing<P extends Plan> = CleanupFailure<P> | SupervisorFailure;
export type ScopeOptions = {
    readonly signal?: AbortSignal;
    readonly deadline?: AbortSignal;
};
export declare function openScope<const P extends Plan>(plan: P & CheckedPlan<NoInfer<P>>, options?: ScopeOptions): Promise<{
    readonly values: Values<P>;
    readonly signal: AbortSignal;
    close(this: void): Promise<Outcome<void, ChildFailure<P> | SupervisorFailure, Closing<P>>>;
} | Primary<P> | CleanupFailure<P> | ScopeAggregate<Primary<P>, Closing<P>>>;
export declare function scoped<const P extends Plan, Result>(plan: P & CheckedPlan<NoInfer<P>>, body: (values: Values<P>, signal: AbortSignal) => Result, options?: ScopeOptions): Promise<Outcome<Exclude<Awaited<Result>, Failure>, Primary<P> | Extract<Awaited<Result>, Failure>, Closing<P>>>;
type Prepare = ReturnType<typeof resource>['prepare'];
type PreparedSuccess<Run extends Prepare> = Exclude<Awaited<ReturnType<Run>>, Failure>;
type PreparedValue<Run extends Prepare> = PreparedSuccess<Run> extends {
    value: infer Value;
} ? Value : never;
type PreparedClose<Run extends Prepare> = PreparedSuccess<Run> extends {
    close: infer Close extends () => unknown;
} ? Close : never;
type CoveredCallback<Run extends (...args: never[]) => unknown, Allowed extends Failure> = unknown extends Awaited<ReturnType<Run>> ? never : [Exclude<FailureOf<Run>, Allowed>] extends [never] ? unknown : never;
export declare function createLifetime<Primary extends Failure = never, Cleanup extends Failure = never>(options: ScopeOptions): {
    readonly signal: AbortSignal;
    readonly values: Record<string, unknown>;
    acquire<Run extends Prepare>(prepare: Run & CoveredCallback<Run, Primary | SupervisorFailure> & CoveredCallback<PreparedClose<Run>, Cleanup | SupervisorFailure>): Promise<PreparedValue<Run> | FailureOf<Run> | SupervisorFailure>;
    defer<Run extends () => unknown>(run: Run & CoveredCallback<Run, Cleanup | SupervisorFailure>): void | SupervisorFailure;
    fork<Ran>(this: void, run: (signal: AbortSignal) => Ran, ...coverage: CoveredCallback<() => Ran, Primary | SupervisorFailure> extends never ? [invalid: never] : []): void | SupervisorFailure;
    fail(failure: Primary | SupervisorFailure): void;
    hasFailure(): boolean;
    defect(error: unknown): FailureOf<typeof UnexpectedDefect> | undefined;
    quiesce(this: void): Promise<Outcome<void, Primary | SupervisorFailure, never>>;
    close(this: void): Promise<Outcome<void, Primary | SupervisorFailure, Cleanup | SupervisorFailure>>;
};
type Definition = Pick<FailureDefinition, 'code' | 'is' | 'dataSchema'> & ((...args: never[]) => Failure);
type Defined<Definitions extends readonly Definition[]> = ReturnType<Definitions[number]>;
type Covered<Value, Allowed extends Failure> = unknown extends Awaited<Value> ? never : [Exclude<Extract<Awaited<Value>, Failure>, Allowed>] extends [never] ? Value : never;
/** Fix canonical failure definitions before imperative registrations start. */
export declare function dynamicScope<const Definitions extends readonly Definition[]>(definitions: Definitions): {
    run<Body extends (scope: {
        readonly signal: AbortSignal;
        acquire<Open extends (signal: AbortSignal) => unknown, Close extends (value: Exclude<Awaited<ReturnType<Open>>, Failure>) => unknown>(open: Open & ((signal: AbortSignal) => Covered<ReturnType<Open>, NoInfer<Defined<Definitions>>>), close: Close & ((value: Exclude<Awaited<ReturnType<Open>>, Failure>) => Covered<ReturnType<Close>, NoInfer<Defined<Definitions>>>)): Promise<Awaited<ReturnType<Open>> | SupervisorFailure>;
        defer<Close extends () => unknown>(this: void, close: Close & (() => Covered<ReturnType<Close>, NoInfer<Defined<Definitions>>>)): void | SupervisorFailure;
        fork<Run extends (signal: AbortSignal) => unknown>(run: Run & ((signal: AbortSignal) => Covered<ReturnType<Run>, NoInfer<Defined<Definitions>>>)): void | SupervisorFailure;
    }) => unknown>(body: Body, options?: ScopeOptions): Promise<Outcome<Exclude<Awaited<ReturnType<Body>>, Failure>, Defined<Definitions> | FailureOf<Body> | SupervisorFailure, Defined<Definitions> | SupervisorFailure>>;
};
export {};
//# sourceMappingURL=scope.d.ts.map