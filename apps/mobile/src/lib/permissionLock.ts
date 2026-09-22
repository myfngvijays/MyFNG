/** One OS permission dialog at a time — iOS/Android drop a second prompt. */
let tail: Promise<unknown> = Promise.resolve();

export function withPermissionLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = tail.then(fn, fn);
  tail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
