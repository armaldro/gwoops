/**
 * The domain tier: everything Nest knows how to reason about, with no idea
 * where the data came from.
 *
 * Nothing in here performs I/O, reads configuration, or imports a framework.
 * That is what lets the same code run in the API tier, the web tier, a worker,
 * and a unit test with no database — and why its tests need no mocks.
 */
export * from './categories'
export * from './distribution'
export * from './geo'
export * from './duplicates'
export * from './colors'
