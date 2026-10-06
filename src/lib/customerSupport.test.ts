import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { openCustomerSupportChat as OpenFn } from "./customerSupport";

afterEach(() => {
  delete (window as unknown as { ChannelIO?: unknown }).ChannelIO;
  delete (window as unknown as { ReactNativeWebView?: unknown }).ReactNativeWebView;
  vi.restoreAllMocks();
});

// These cases run as a build with NO plugin key (the developer's .env may set
// one), on a fresh module so no member session leaks in from another test.
let openCustomerSupportChat: typeof OpenFn;
beforeEach(async () => {
  vi.stubEnv("VITE_CHANNEL_TALK_PLUGIN_KEY", "");
  vi.resetModules();
  ({ openCustomerSupportChat } = await import("./customerSupport"));
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("openCustomerSupportChat", () => {
  it("returns false when no support integration is available", () => {
    expect(openCustomerSupportChat()).toBe(false);
  });

  it("posts to the native bridge when present and returns true", () => {
    const postMessage = vi.fn();
    (window as unknown as { ReactNativeWebView: unknown }).ReactNativeWebView = { postMessage };

    const ok = openCustomerSupportChat({ id: "u1", nickname: "홍길동", name: "Gildong" });

    expect(ok).toBe(true);
    expect(postMessage).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(postMessage.mock.calls[0][0]);
    expect(payload.type).toBe("OPEN_CUSTOMER_SUPPORT_CHAT");
    // Prefers nickname, carries the member id, never leaks tokens.
    expect(payload.profile).toEqual({ memberId: "u1", name: "홍길동" });
  });

  it("opens the ChannelTalk web SDK when the bridge is absent", () => {
    const ChannelIO = vi.fn();
    (window as unknown as { ChannelIO: unknown }).ChannelIO = ChannelIO;

    const ok = openCustomerSupportChat({ id: "u2", nickname: null, name: "Ann" });

    expect(ok).toBe(true);
    // Without a plugin key this build can't re-boot as the member; it never
    // tries `updateUser({ memberId })`, which the SDK does not support.
    expect(ChannelIO).not.toHaveBeenCalledWith("updateUser", expect.anything());
    expect(ChannelIO).toHaveBeenLastCalledWith("showMessenger");
  });

  it("does not attach a user when none is provided", () => {
    const ChannelIO = vi.fn();
    (window as unknown as { ChannelIO: unknown }).ChannelIO = ChannelIO;

    openCustomerSupportChat(null);

    expect(ChannelIO).toHaveBeenCalledTimes(1);
    expect(ChannelIO).toHaveBeenCalledWith("showMessenger");
  });

  it("reports failure if the web SDK throws", () => {
    (window as unknown as { ChannelIO: unknown }).ChannelIO = vi.fn(() => {
      throw new Error("not booted");
    });
    expect(openCustomerSupportChat()).toBe(false);
  });
});

describe("openCustomerSupportChat — verified identification", () => {
  afterEach(() => {
    delete (window as unknown as { ChannelIO?: unknown }).ChannelIO;
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  /** A fake SDK that completes every boot (optionally with an error). */
  function fakeSdk(bootError: (options: Record<string, unknown>) => unknown = () => null) {
    return vi.fn((command: string, options?: unknown, callback?: unknown) => {
      if (command === "boot" && typeof callback === "function") {
        (callback as (error: unknown) => void)(bootError(options as Record<string, unknown>));
      }
    });
  }

  async function freshModules() {
    vi.stubEnv("VITE_CHANNEL_TALK_PLUGIN_KEY", "test-plugin-key");
    vi.resetModules();
    const support = await import("./customerSupport");
    const talk = await import("./channelTalk");
    return { open: support.openCustomerSupportChat, talk };
  }

  it("re-boots with memberId + memberHash, then opens the messenger after the boot", async () => {
    const { open } = await freshModules();
    const ChannelIO = fakeSdk();
    (window as unknown as { ChannelIO: unknown }).ChannelIO = ChannelIO;

    const ok = open({ id: "u3", nickname: "김", name: "Kim", memberHash: "deadbeef" });

    expect(ok).toBe(true);
    const bootCall = ChannelIO.mock.calls.find((c) => c[0] === "boot");
    expect(bootCall?.[1]).toMatchObject({
      pluginKey: "test-plugin-key",
      memberId: "u3",
      memberHash: "deadbeef",
      hideChannelButtonOnBoot: true,
    });
    expect(ChannelIO).not.toHaveBeenCalledWith("updateUser", expect.anything());
    expect(ChannelIO).toHaveBeenLastCalledWith("showMessenger");
  });

  it("does not open the messenger before the boot has finished", async () => {
    const { open } = await freshModules();
    const ChannelIO = vi.fn(); // never completes a boot
    (window as unknown as { ChannelIO: unknown }).ChannelIO = ChannelIO;

    open({ id: "u5", memberHash: "abc" });

    expect(ChannelIO).not.toHaveBeenCalledWith("showMessenger");
  });

  it("does not re-boot for the member it is already booted as", async () => {
    const { open } = await freshModules();
    const ChannelIO = fakeSdk();
    (window as unknown as { ChannelIO: unknown }).ChannelIO = ChannelIO;

    open({ id: "u6", memberHash: "abc" });
    open({ id: "u6", memberHash: "abc" });

    expect(ChannelIO.mock.calls.filter((c) => c[0] === "boot")).toHaveLength(1);
    expect(ChannelIO.mock.calls.filter((c) => c[0] === "showMessenger")).toHaveLength(2);
  });

  it("re-boots when a different member opens support on the same page", async () => {
    const { open } = await freshModules();
    const ChannelIO = fakeSdk();
    (window as unknown as { ChannelIO: unknown }).ChannelIO = ChannelIO;

    open({ id: "first", memberHash: "h1" });
    open({ id: "second", memberHash: "h2" });

    const boots = ChannelIO.mock.calls.filter((c) => c[0] === "boot").map((c) => c[1]);
    expect(boots).toEqual([
      expect.objectContaining({ memberId: "first", memberHash: "h1" }),
      expect.objectContaining({ memberId: "second", memberHash: "h2" }),
    ]);
  });

  it("falls back to an anonymous session when ChannelTalk rejects the member hash", async () => {
    const { open, talk } = await freshModules();
    const ChannelIO = fakeSdk((options) => (options.memberHash ? new Error("verification failed") : null));
    (window as unknown as { ChannelIO: unknown }).ChannelIO = ChannelIO;

    open({ id: "u7", memberHash: "wrong" });

    const boots = ChannelIO.mock.calls.filter((c) => c[0] === "boot").map((c) => c[1]);
    expect(boots[1]).not.toHaveProperty("memberId");
    expect(talk.channelTalkBootedAs()).toBeNull();
    // Support stays reachable.
    expect(ChannelIO).toHaveBeenLastCalledWith("showMessenger");
  });

  it("shuts the member session down when a signed-out visitor opens support", async () => {
    const { open } = await freshModules();
    const ChannelIO = fakeSdk();
    (window as unknown as { ChannelIO: unknown }).ChannelIO = ChannelIO;

    open({ id: "u8", memberHash: "abc" });
    ChannelIO.mockClear();
    open(null);

    expect(ChannelIO.mock.calls.map((c) => c[0])).toEqual(["shutdown", "boot", "showMessenger"]);
    expect(ChannelIO.mock.calls[1][1]).not.toHaveProperty("memberId");
  });

  it("resetChannelTalkUser ends a member session for sign-out", async () => {
    const { open, talk } = await freshModules();
    const ChannelIO = fakeSdk();
    (window as unknown as { ChannelIO: unknown }).ChannelIO = ChannelIO;

    open({ id: "u9", memberHash: "abc" });
    talk.resetChannelTalkUser();

    expect(ChannelIO).toHaveBeenCalledWith("shutdown");
    expect(talk.channelTalkBootedAs()).toBeNull();
  });

  it("passes memberHash to the native bridge profile", () => {
    const postMessage = vi.fn();
    (window as unknown as { ReactNativeWebView: unknown }).ReactNativeWebView = { postMessage };

    openCustomerSupportChat({ id: "u4", nickname: "이", memberHash: "cafef00d" });

    const payload = JSON.parse(postMessage.mock.calls[0][0]);
    expect(payload.profile).toMatchObject({ memberId: "u4", memberHash: "cafef00d" });
    delete (window as unknown as { ReactNativeWebView?: unknown }).ReactNativeWebView;
  });
});
