/**
 * ChannelTalk web SDK loader.
 *
 * Boots the ChannelTalk JS SDK once at app startup **only** when a plugin key
 * is configured via `VITE_CHANNEL_TALK_PLUGIN_KEY`. When it's absent (local
 * dev, native shell builds) this is a no-op, so the native bridge / graceful
 * fallback in `openCustomerSupportChat` still handle support.
 *
 * We install `window.ChannelIO` synchronously as a command queue (the SDK's
 * standard bootstrap), so calls made before the remote script finishes loading
 * — e.g. `showMessenger` from the FAQ support button — are queued and replayed.
 * The default in-page launcher is hidden because the app renders its own
 * floating "채팅 상담하기" button.
 */

export const CHANNEL_TALK_PLUGIN_KEY = (
  import.meta.env.VITE_CHANNEL_TALK_PLUGIN_KEY ?? ""
).trim();

declare global {
  interface Window {
    // Set by the SDK bootstrap to guarantee the remote script loads once.
    ChannelIOInitialized?: boolean;
  }
}

export function isChannelTalkConfigured(): boolean {
  return CHANNEL_TALK_PLUGIN_KEY.length > 0;
}

/** Command-queue shape the bootstrap installs before the real SDK loads. */
type ChannelIOQueue = ((...args: unknown[]) => void) & {
  q?: unknown[][];
  c?: (args: IArguments) => void;
};

/** Install the `window.ChannelIO` queue and inject the remote script once. */
function loadSdk(): void {
  const w = window;
  if (typeof w.ChannelIO !== "function") {
    const ch = function (this: unknown) {
      // eslint-disable-next-line prefer-rest-params
      ch.c?.(arguments);
    } as ChannelIOQueue;
    ch.q = [];
    ch.c = (args) => {
      ch.q?.push(Array.prototype.slice.call(args));
    };
    w.ChannelIO = ch;
  }
  if (w.ChannelIOInitialized) return;
  w.ChannelIOInitialized = true;
  const script = document.createElement("script");
  script.async = true;
  script.src = "https://cdn.channel.io/plugin/ch-plugin-web.js";
  const first = document.getElementsByTagName("script")[0];
  if (first?.parentNode) first.parentNode.insertBefore(script, first);
  else document.head.appendChild(script);
}

/**
 * Boot ChannelTalk if a plugin key is configured. Safe to call once at startup;
 * a no-op when unconfigured or outside the browser.
 */
export function bootChannelTalk(): void {
  if (typeof window === "undefined" || !isChannelTalkConfigured()) return;
  loadSdk();
  window.ChannelIO?.("boot", {
    pluginKey: CHANNEL_TALK_PLUGIN_KEY,
    // The app has its own floating support button — hide the SDK's launcher.
    hideChannelButtonOnBoot: true,
  });
}
