// Preserve object identity for our own storage notifications and equal cross-tab values.
export function mergeStoredValue<T>(previous: T, incoming: T): T {
  return JSON.stringify(previous) === JSON.stringify(incoming) ? previous : incoming;
}
