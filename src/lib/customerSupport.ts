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
 * and let the user retry. Booting belongs to `channelTalk.ts`: this wrapper
 * only asks it to (re)identify the member on an explicit tap, and never loads
 * the SDK, so a missing SDK can't spin into an init loop.
 */

import { channelTalkBootedAs, identifyChannelTalkUser, resetChannelTalkUser } from "./channelTalk";

type ChannelIO = (command: string, ...args: unknown[]) => void;

declare global {
  interface Window {
    ChannelIO?: ChannelIO;
    ReactNativeWebView?: { postMessage: (message: string) => void };
  }
}

/** Minimal, already-approved member fields ChannelTalk may use to attach the
 * conversation to a known logged-in user. No auth tokens, no learning data.
 * `memberHash` is the server-signed HMAC for ChannelTalk user verification
 * (null/absent → the user is identified without verification). */
export interface SupportChatUser {
  id: string;
  name?: string | null;
  nickname?: string | null;
  memberHash?: string | null;
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
    ? {
        memberId: user.id,
        name: user.nickname ?? user.name ?? undefined,
        memberHash: user.memberHash ?? undefined,
      }
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

  // 2) ChannelTalk web SDK — only if it has actually been installed.
  const channel = typeof window !== "undefined" ? window.ChannelIO : undefined;
  if (typeof channel === "function") {
    try {
      const show = () => channel("showMessenger");
      if (profile) {
        // Identity (memberId / memberHash) is a boot option, so the SDK-owner
        // module re-boots as this member when needed and opens the messenger
        // once that boot has finished — opening it mid-boot can drop the call.
        // Without a hash the member is identified unverified, which works only
        // while the channel does not enforce member verification.
        const handled = identifyChannelTalkUser(
          { memberId: profile.memberId, memberHash: profile.memberHash, name: profile.name },
          show,
        );
        // No plugin key in this build (the SDK came from elsewhere): we can't
        // re-boot, so just open what is there.
        if (!handled) show();
      } else if (channelTalkBootedAs()) {
        // Signed out but the SDK still holds a member session — never show the
        // previous member's chats to whoever is using the device now.
        resetChannelTalkUser(show);
      } else {
        show();
      }
      return true;
    } catch {
      return false;
    }
  }

  return false;
}
