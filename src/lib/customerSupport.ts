/**
 * Customer-support chat entry point (ChannelTalk).
 *
 * 1:1 support is handled out-of-band by ChannelTalk — the backend exposes no
 * inquiry surface (see the support module). The FAQ UI opens the ChannelTalk
 * messenger through this single wrapper instead of poking at a browser global
 * or native SDK from multiple components.
 *
 * Two delivery paths, tried in order:
 *   1. Native app shell — a React-Native WebView bridge. The shell owns the
 *      real ChannelTalk mobile SDK; we just post it a message.
 *   2. Web — the ChannelTalk JS SDK (`window.ChannelIO`), when it has been
 *      booted on the page.
 *
 * `window.ChannelIO` is NOT assumed to exist: if neither path is available the
 * wrapper returns `false` so the caller can surface a temporary-error toast
 * and let the user retry. We never (re)boot the SDK here — booting is an
 * app-level concern — so a missing SDK can't spin into an init loop.
 */

type ChannelIO = (command: string, ...args: unknown[]) => void;

declare global {
  interface Window {
    ChannelIO?: ChannelIO;
    ReactNativeWebView?: { postMessage: (message: string) => void };
  }
}

/** Minimal, already-approved member fields ChannelTalk may use to attach the
 * conversation to a known logged-in user. No auth tokens, no learning data. */
export interface SupportChatUser {
  id: string;
  name?: string | null;
  nickname?: string | null;
}

/** Message type the native shell listens for to open ChannelTalk. */
const NATIVE_MESSAGE_TYPE = "OPEN_CUSTOMER_SUPPORT_CHAT";

/**
 * Open the ChannelTalk customer-support chat.
 *
 * @returns `true` if a support channel was reached (native bridge or web SDK),
 *          `false` if no integration is available — the caller should then show
 *          a retryable error.
 */
export function openCustomerSupportChat(user?: SupportChatUser | null): boolean {
  const profile = user
    ? { memberId: user.id, name: user.nickname ?? user.name ?? undefined }
    : null;

  // 1) Native app shell bridge (mobile wrapper owns the real SDK).
  const bridge = typeof window !== "undefined" ? window.ReactNativeWebView : undefined;
  if (bridge && typeof bridge.postMessage === "function") {
    try {
      bridge.postMessage(JSON.stringify({ type: NATIVE_MESSAGE_TYPE, profile }));
      return true;
    } catch {
      // Fall through to the web SDK if the bridge threw for any reason.
    }
  }

  // 2) ChannelTalk web SDK — only if it has actually been booted.
  const channel = typeof window !== "undefined" ? window.ChannelIO : undefined;
  if (typeof channel === "function") {
    try {
      if (profile) channel("updateUser", { memberId: profile.memberId, profile: { name: profile.name } });
      channel("showMessenger");
      return true;
    } catch {
      return false;
    }
  }

  return false;
}
