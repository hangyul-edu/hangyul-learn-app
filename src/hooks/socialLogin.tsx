import { useState, type ReactNode } from "react";
import { Sheet } from "../components/ui/Modal";
import { TextArea } from "../components/ui/Field";
import { Button } from "../components/ui/kit";
import { authApi } from "../api/endpoints";
import { useToast } from "./toast";
import { useLoginFlow } from "./loginFlow";
import { errorMessage } from "../lib/http";
import type { SocialProvider } from "../lib/types";

const LABELS: Record<SocialProvider, string> = {
  google: "Google",
  apple: "Apple",
  kakao: "Kakao",
  facebook: "Facebook",
  line: "LINE",
};

/**
 * Social sign-in flow, shared by the auth landing and the login screen.
 *
 * A production mobile build wires each provider's native SDK to obtain an
 * `id_token`; on web we accept the provider's id_token directly so the flow can
 * be exercised against the backend's social-login endpoint. This is the single,
 * clearly-isolated integration point for every provider — the caller only
 * chooses which provider to `start()`.
 *
 * Returns `element` (the token sheet) which the caller must render once.
 */
export function useSocialLogin(): {
  start: (provider: SocialProvider) => void;
  busy: boolean;
  element: ReactNode;
} {
  const [provider, setProvider] = useState<SocialProvider | null>(null);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const completeLogin = useLoginFlow();

  async function submit() {
    if (!provider || !token.trim()) return;
    setBusy(true);
    try {
      const res = await authApi.social(provider, token.trim());
      await completeLogin(res, true);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const label = provider ? LABELS[provider] : "";
  const element = (
    <Sheet open={!!provider} onClose={() => !busy && setProvider(null)} title={`${label} 계정으로 계속하기`}>
      <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>
        {label} 로그인을 완료하려면 제공자의 <b>ID 토큰</b>이 필요해요. 모바일 앱에서는 자동으로 처리되며,
        여기서는 발급받은 토큰을 붙여넣어 로그인할 수 있어요.
      </p>
      <TextArea
        placeholder="eyJhbGciOi… (ID token)"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        style={{ minHeight: 96, fontFamily: "monospace", fontSize: 12 }}
      />
      <div style={{ height: 12 }} />
      <Button block loading={busy} disabled={!token.trim()} onClick={submit}>
        계속하기
      </Button>
    </Sheet>
  );

  return {
    start: (p: SocialProvider) => {
      setProvider(p);
      setToken("");
    },
    busy,
    element,
  };
}
