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
