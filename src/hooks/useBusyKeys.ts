import { useState } from "react";
import { withKey, withoutKey } from "../lib/collections";

/**
 * Per-row single flight: `run(key, task)` ignores a second tap on a row whose
 * task is still running, and `busy` says which rows are, for their spinners.
 * Resolves true when the task ran.
 */
export function useBusyKeys() {
  const [busy, setBusy] = useState<Set<string>>(new Set());
  async function run(key: string, task: () => Promise<void>): Promise<boolean> {
    if (busy.has(key)) return false;
    setBusy((prev) => withKey(prev, key));
    try {
      await task();
    } finally {
      setBusy((prev) => withoutKey(prev, key));
    }
    return true;
  }
  return { busy, run };
}
