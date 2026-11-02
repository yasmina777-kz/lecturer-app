/** Reuse decoded immutable motion clips by versioned URL; retry failed loads. */
export function createMotionCache<T>(load: (url: string) => Promise<T>, capacity = 64) {
  const entries = new Map<string, Promise<T>>();
  return (url: string): Promise<T> => {
    const existing = entries.get(url);
    if (existing) {
      entries.delete(url);
      entries.set(url, existing);
      return existing;
    }
    const pending = Promise.resolve().then(() => load(url));
    entries.set(url, pending);
    pending.catch(() => { if (entries.get(url) === pending) entries.delete(url); });
    while (entries.size > capacity) entries.delete(entries.keys().next().value!);
    return pending;
  };
}
