import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const { recordActivity } = vi.hoisted(() => ({ recordActivity: vi.fn() }));
vi.mock("../api/endpoints", () => ({ learnApi: { recordActivity } }));

import { useRecordDisplayedItem } from "./learningActivity";

function wrapper(qc: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

type Props = { id: string | null | undefined; kind?: "conversation" | "topik" };

function mount(initial: Props, qc = new QueryClient()) {
  return renderHook(({ id, kind = "conversation" }: Props) => useRecordDisplayedItem(kind, id), {
    initialProps: initial,
    wrapper: wrapper(qc),
  });
}

/** Let the (deliberately async) request chain settle. */
const flush = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });

beforeEach(() => {
  recordActivity.mockReset();
  recordActivity.mockResolvedValue({ studied_today: true, learning_day_created: true, total_learning_days: 1 });
});
afterEach(() => vi.useRealTimers());

describe("useRecordDisplayedItem", () => {
  it("records nothing while no item is displayed", async () => {
    const h = mount({ id: null });
    h.rerender({ id: undefined });
    await flush();
    expect(recordActivity).not.toHaveBeenCalled();
  });

  it("records once when an item is displayed, not again on re-render", async () => {
    const h = mount({ id: "s1", kind: "topik" });
    await flush();
    expect(recordActivity).toHaveBeenCalledTimes(1);
    expect(recordActivity).toHaveBeenCalledWith("topik", "s1");
    h.rerender({ id: "s1", kind: "topik" });
    h.rerender({ id: "s1", kind: "topik" });
    await flush();
    expect(recordActivity).toHaveBeenCalledTimes(1);
  });

  it("does not re-send for later items on the same UTC day (the endpoint is idempotent per day)", async () => {
    const h = mount({ id: "s1" });
    await flush();
    h.rerender({ id: "s2" });
    h.rerender({ id: "s3" });
    await flush();
    expect(recordActivity).toHaveBeenCalledTimes(1);
  });

  it("records again once the device's local day rolls over", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    // Local wall-clock times: one minute either side of the device's midnight.
    vi.setSystemTime(new Date(2026, 8, 29, 23, 59));
    const h = mount({ id: "s1" });
    await flush();
    vi.setSystemTime(new Date(2026, 8, 30, 0, 1));
    h.rerender({ id: "s2" });
    await flush();
    expect(recordActivity).toHaveBeenCalledTimes(2);
  });

  it("lights the sun optimistically", () => {
    const qc = new QueryClient();
    qc.setQueryData(["dashboard"], { studied_today: false });
    mount({ id: "s1" }, qc);
    expect(qc.getQueryData<{ studied_today: boolean }>(["dashboard"])?.studied_today).toBe(true);
  });

  it("fails silently and retries on the next displayed item", async () => {
    recordActivity.mockRejectedValueOnce(new Error("offline"));
    const h = mount({ id: "s1" });
    // The rejection is swallowed — nothing throws into the render tree.
    await flush();
    expect(recordActivity).toHaveBeenCalledTimes(1);
    h.rerender({ id: "s2" });
    await flush();
    expect(recordActivity).toHaveBeenCalledTimes(2);
    expect(recordActivity).toHaveBeenLastCalledWith("conversation", "s2");
  });

  it("never throws when the request cannot even be issued", async () => {
    recordActivity.mockImplementationOnce(() => {
      throw new Error("boom");
    });
    expect(() => mount({ id: "s1" })).not.toThrow();
    await flush();
    expect(recordActivity).toHaveBeenCalledTimes(1);
  });
});
