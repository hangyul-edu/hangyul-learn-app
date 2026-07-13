/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the Hangyul API, e.g. "https://api.hangyul.app". Empty → "/api" (dev proxy). */
  readonly VITE_API_BASE_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
