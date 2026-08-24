import { afterEach, describe, expect, it, vi } from "vitest";
import { openCustomerSupportChat } from "./customerSupport";

afterEach(() => {
  delete (window as unknown as { ChannelIO?: unknown }).ChannelIO;
  delete (window as unknown as { ReactNativeWebView?: unknown }).ReactNativeWebView;
  vi.restoreAllMocks();
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
    expect(ChannelIO).toHaveBeenCalledWith("updateUser", {
      memberId: "u2",
      profile: { name: "Ann" },
    });
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

  it("re-boots with memberId + memberHash when a hash and plugin key are present", async () => {
    vi.stubEnv("VITE_CHANNEL_TALK_PLUGIN_KEY", "test-plugin-key");
    vi.resetModules();
    const { openCustomerSupportChat: open } = await import("./customerSupport");

    const ChannelIO = vi.fn();
    (window as unknown as { ChannelIO: unknown }).ChannelIO = ChannelIO;

    const ok = open({ id: "u3", nickname: "김", name: "Kim", memberHash: "deadbeef" });

    expect(ok).toBe(true);
    const bootCall = ChannelIO.mock.calls.find((c) => c[0] === "boot");
    expect(bootCall?.[1]).toMatchObject({
      pluginKey: "test-plugin-key",
      memberId: "u3",
      memberHash: "deadbeef",
    });
    // Verified path must NOT fall back to the unverified updateUser.
    expect(ChannelIO).not.toHaveBeenCalledWith("updateUser", expect.anything());
    expect(ChannelIO).toHaveBeenLastCalledWith("showMessenger");
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
