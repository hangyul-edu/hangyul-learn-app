import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// CHANNEL_TALK_PLUGIN_KEY is read from import.meta.env at module load, so each
// test stubs the env and re-imports the module fresh via resetModules.

describe("bootChannelTalk", () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    delete (window as unknown as { ChannelIO?: unknown }).ChannelIO;
    delete (window as unknown as { ChannelIOInitialized?: unknown }).ChannelIOInitialized;
    document.querySelectorAll('script[src*="ch-plugin-web.js"]').forEach((s) => s.remove());
  });

  it("is a no-op when no plugin key is configured", async () => {
    vi.stubEnv("VITE_CHANNEL_TALK_PLUGIN_KEY", "");
    const { bootChannelTalk, isChannelTalkConfigured } = await import("./channelTalk");

    expect(isChannelTalkConfigured()).toBe(false);
    bootChannelTalk();

    expect((window as unknown as { ChannelIO?: unknown }).ChannelIO).toBeUndefined();
    expect(document.querySelector('script[src*="ch-plugin-web.js"]')).toBeNull();
  });

  it("installs the queue, injects the SDK, and boots with the launcher hidden", async () => {
    vi.stubEnv("VITE_CHANNEL_TALK_PLUGIN_KEY", "test-plugin-key");
    const { bootChannelTalk, isChannelTalkConfigured } = await import("./channelTalk");

    expect(isChannelTalkConfigured()).toBe(true);
    bootChannelTalk();

    const ch = (window as unknown as { ChannelIO?: { q?: unknown[][] } }).ChannelIO;
    expect(typeof ch).toBe("function");
    // The boot command is queued (replayed once the remote script loads).
    expect(ch?.q).toContainEqual([
      "boot",
      { pluginKey: "test-plugin-key", hideChannelButtonOnBoot: true },
    ]);
    expect(document.querySelector('script[src*="ch-plugin-web.js"]')).not.toBeNull();
  });

  it("injects the remote SDK script only once across boots", async () => {
    vi.stubEnv("VITE_CHANNEL_TALK_PLUGIN_KEY", "test-plugin-key");
    const { bootChannelTalk } = await import("./channelTalk");

    bootChannelTalk();
    bootChannelTalk();

    expect(document.querySelectorAll('script[src*="ch-plugin-web.js"]')).toHaveLength(1);
  });
});
