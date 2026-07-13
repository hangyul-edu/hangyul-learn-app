import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Screen } from "../components/layout/Screen";
import { Button } from "../components/ui/kit";
import { PasswordField } from "../components/ui/Field";
import { authApi } from "../api/endpoints";
import { useToast } from "../hooks/toast";
import { errorMessage } from "../lib/http";

/**
 * New-password step of the password-reset flow. Consumes the short-lived
 * reset-authorization token issued by FindPassword (passed via navigation
 * state, never persisted) and calls the existing reset API. On success it
 * replaces the stack to the login screen so Back can't return to the consumed
 * form.
 */
export function ResetPassword() {
  const nav = useNavigate();
  const toast = useToast();
  const location = useLocation();
  const resetToken = (location.state as { reset_token?: string } | null)?.reset_token;

  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);

  // Opened without a valid reset token → back to the lookup form.
  if (!resetToken) return <Navigate to="/forgot" state={{ mode: "password" }} replace />;

  async function submit() {
    if (busy || !pw || pw !== pw2) return;
    setBusy(true);
    try {
      await authApi.resetPassword(resetToken!, pw, pw2);
      toast.success("비밀번호를 변경했어요");
      nav("/login", { replace: true });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title="비밀번호 재설정" back>
      <div className="stack" style={{ gap: 14 }}>
        <h2 style={{ fontSize: 20 }}>새 비밀번호 설정</h2>
        <PasswordField
          label="새 비밀번호"
          hint="영문·숫자·특수문자 포함 8자 이상"
          autoComplete="new-password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
        />
        <PasswordField
          label="새 비밀번호 확인"
          autoComplete="new-password"
          error={pw2 && pw !== pw2 ? "일치하지 않아요" : null}
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
        />
        <Button size="lg" block loading={busy} disabled={!pw || pw !== pw2} onClick={submit}>
          비밀번호 변경
        </Button>
      </div>
    </Screen>
  );
}
