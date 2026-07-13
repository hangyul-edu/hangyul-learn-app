import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Screen } from "../components/layout/Screen";
import { Button, CheckLine } from "../components/ui/kit";
import { PasswordField, TextField } from "../components/ui/Field";
import { SocialRow } from "./SocialRow";
import { authApi } from "../api/endpoints";
import { useLoginFlow } from "../hooks/loginFlow";
import { ApiError, errorMessage } from "../lib/http";

export function Login() {
  const nav = useNavigate();
  const completeLogin = useLoginFlow();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [autoLogin, setAutoLogin] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!email.trim() || !password) {
      setErr("이메일과 비밀번호를 입력해 주세요.");
      return;
    }
    setBusy(true);
    try {
      const token = await authApi.login(email.trim(), password, autoLogin);
      await completeLogin(token, autoLogin);
    } catch (e2) {
      setErr(e2 instanceof ApiError && e2.status === 401 ? "이메일 또는 비밀번호가 올바르지 않아요." : errorMessage(e2));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title="로그인" back>
      <form className="stack" onSubmit={submit} style={{ gap: 16 }}>
        <h2 style={{ fontSize: 22, marginTop: 4 }}>다시 만나서 반가워요 👋</h2>
        <TextField
          label="이메일"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <PasswordField
          label="비밀번호"
          autoComplete="current-password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {err && <div className="field__error">⚠ {err}</div>}
        <CheckLine checked={autoLogin} onToggle={() => setAutoLogin((v) => !v)}>
          자동 로그인 유지
        </CheckLine>
        <Button size="lg" block loading={busy} type="submit">
          로그인
        </Button>
        <button type="button" className="btn btn--ghost" style={{ background: "transparent" }} onClick={() => nav("/forgot")}>
          비밀번호 · 이메일을 잊으셨나요?
        </button>
      </form>

      <div className="row" style={{ margin: "22px 0 14px" }}>
        <div className="divider" style={{ flex: 1 }} />
        <span className="dim" style={{ fontSize: 12 }}>소셜 계정으로</span>
        <div className="divider" style={{ flex: 1 }} />
      </div>
      <SocialRow />
    </Screen>
  );
}
