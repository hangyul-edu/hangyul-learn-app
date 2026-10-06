/**
 * ChannelTalk web SDK loader and identity owner.
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
 *
 * Identity: `memberId` / `memberHash` are **boot** options (the SDK's
 * `updateUser` cannot change who the user is), so identifying a member means
 * re-booting. This module remembers which member the SDK is booted as, so it
 * re-boots only when that changes, and `resetChannelTalkUser` shuts the
 * member session down on sign-out — otherwise the next person on a shared
 * device would open the previous member's conversations.
 *
 * The member-hash secret never reaches the browser: the hash comes from
 * `GET /support/channel-talk/identity`, signed on the server.
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

/** `boot` callback: `error` is set when ChannelTalk refused the boot (e.g. a
 * member hash that does not match the member id). */
type BootCallback = (error: unknown, user?: unknown) => void;

/** Whom the SDK is currently booted as: `undefined` = not booted by us yet,
 * `null` = anonymous, otherwise the member id. */
let bootedAs: string | null | undefined;

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

function anonymousBootOptions(): Record<string, unknown> {
  return {
    pluginKey: CHANNEL_TALK_PLUGIN_KEY,
    // The app has its own floating support button — hide the SDK's launcher.
    hideChannelButtonOnBoot: true,
  };
}

/**
 * Boot ChannelTalk anonymously if a plugin key is configured. Safe to call
 * once at startup; a no-op when unconfigured or outside the browser.
 */
export function bootChannelTalk(): void {
  if (typeof window === "undefined" || !isChannelTalkConfigured()) return;
  loadSdk();
  window.ChannelIO?.("boot", anonymousBootOptions());
  bootedAs = null;
}

/**
 * Identify the signed-in member with the ChannelTalk SDK, then call `onReady`.
 *
 * Re-boots with `memberId` (+ the server-signed `memberHash` when there is
 * one) only when the SDK is not already booted as this member. If ChannelTalk
 * refuses the identity (wrong hash, or verification enforced and no hash) it
 * falls back to an anonymous boot so support stays reachable; `onReady`
 * receives whether the member was identified. A no-op returning `false` when
 * unconfigured or the SDK isn't installed — the caller decides what to do.
 */
export function identifyChannelTalkUser(
  params: {
    memberId: string;
    memberHash?: string | null;
    name?: string | null;
  },
  onReady?: (identified: boolean) => void,
): boolean {
  if (typeof window === "undefined" || !isChannelTalkConfigured()) return false;
  const channel = window.ChannelIO;
  if (typeof channel !== "function") return false;
  if (bootedAs === params.memberId) {
    if (params.name) channel("updateUser", { profile: { name: params.name } });
    onReady?.(true);
    return true;
  }
  const options = {
    ...anonymousBootOptions(),
    memberId: params.memberId,
    ...(params.memberHash ? { memberHash: params.memberHash } : {}),
    ...(params.name ? { profile: { name: params.name } } : {}),
  };
  bootedAs = params.memberId;
  const onBoot: BootCallback = (error) => {
    if (!error) {
      onReady?.(true);
      return;
    }
    // Identity refused: keep support reachable as an anonymous visitor rather
    // than leaving the messenger un-booted.
    bootedAs = null;
    channel("boot", anonymousBootOptions(), () => onReady?.(false));
  };
  channel("boot", options, onBoot);
  return true;
}

/**
 * End the member's ChannelTalk session (call on sign-out): shut the SDK down
 * and boot it again anonymously, so the next person using this browser can't
 * read the previous member's chats. A no-op when the SDK was never booted as a
 * member.
 */
export function resetChannelTalkUser(onReady?: () => void): void {
  if (typeof window === "undefined" || !isChannelTalkConfigured()) return;
  const channel = window.ChannelIO;
  if (typeof channel !== "function" || !bootedAs) {
    onReady?.();
    return;
  }
  channel("shutdown");
  bootedAs = null;
  channel("boot", anonymousBootOptions(), () => onReady?.());
}

/** The member id the SDK is booted as (`null` anonymous, `undefined` never
 * booted here). Exposed for the support entry point and tests. */
export function channelTalkBootedAs(): string | null | undefined {
  return bootedAs;
}
