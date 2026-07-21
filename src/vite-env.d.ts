/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the Hangyul API, e.g. "https://api.hangyul.app". Empty → "/api" (dev proxy). */
  readonly VITE_API_BASE_URL?: string;
  /** ChannelTalk web SDK plugin key. Empty → the web SDK is not booted. */
  readonly VITE_CHANNEL_TALK_PLUGIN_KEY?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
