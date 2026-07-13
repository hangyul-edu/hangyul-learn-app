import { useState } from "react";
import { Button } from "../components/ui/kit";
import { Sheet } from "../components/ui/Modal";
import { TextArea } from "../components/ui/Field";
import { authApi } from "../api/endpoints";
import { useToast } from "../hooks/toast";
import { useLoginFlow } from "../hooks/loginFlow";
import { errorMessage } from "../lib/http";
import type { SocialProvider } from "../lib/types";

const PROVIDERS: { id: SocialProvider; label: string; emoji: string; bg: string; color: string }[] = [
  { id: "google", label: "Google", emoji: "🇬", bg: "#fff", color: "#3c4043" },
  { id: "apple", label: "Apple", emoji: "", bg: "#111", color: "#fff" },
  { id: "kakao", label: "Kakao", emoji: "💬", bg: "#FEE500", color: "#3c1e1e" },
];

/**
 * Social sign-in. A production build wires each provider's native SDK to obtain
 * an `id_token`; here we accept the provider's id_token directly so the flow can
 * be exercised against the backend's social-login endpoint.
 */
export function SocialRow() {
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

  return (
    <>
      <div className="grid-3">
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            className="btn"
            style={{ background: p.bg, color: p.color, border: "1px solid var(--border)", height: 52 }}
            onClick={() => {
              setProvider(p.id);
              setToken("");
            }}
          >
            <span style={{ fontSize: 18, fontWeight: 900 }}>{p.emoji || ""}</span>
            <span style={{ fontSize: 13 }}>{p.label}</span>
          </button>
        ))}
      </div>

      <Sheet open={!!provider} onClose={() => !busy && setProvider(null)} title={`${provider ?? ""} 계정으로 계속하기`}>
        <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>
          {provider} 로그인을 완료하려면 제공자의 <b>ID 토큰</b>이 필요해요. 모바일 앱에서는 자동으로
          처리되며, 여기서는 발급받은 토큰을 붙여넣어 로그인할 수 있어요.
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
    </>
  );
}
