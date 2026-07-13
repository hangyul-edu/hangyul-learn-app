import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Screen } from "../components/layout/Screen";
import { Button, Segmented } from "../components/ui/kit";
import { Field, PasswordField, TextField } from "../components/ui/Field";
import { VerifyStep } from "./VerifyStep";
import { FindEmail } from "./FindEmail";
import { authApi } from "../api/endpoints";
import { useToast } from "../hooks/toast";
import { errorMessage } from "../lib/http";
import { NATIONALITIES } from "../lib/format";

type Mode = "email" | "password";

export function Forgot() {
  const nav = useNavigate();
  const toast = useToast();
  const location = useLocation();
  const initialMode: Mode = (location.state as { mode?: Mode } | null)?.mode === "password" ? "password" : "email";
  const [mode, setMode] = useState<Mode>(initialMode);
  const [step, setStep] = useState(0);
  const [emailIn, setEmailIn] = useState("");
  const [country, setCountry] = useState("KR");
  const [localPhone, setLocalPhone] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);

  const dial = useMemo(() => NATIONALITIES.find((n) => n.code === country)?.dial ?? "+82", [country]);
  const e164 = useMemo(() => `${dial}${localPhone.replace(/^0+/, "").replace(/\D/g, "")}`, [dial, localPhone]);

  function reset() {
    setStep(0);
    setResetToken("");
    setPw("");
    setPw2("");
  }

  // The email-recovery flow has its own faithful full-screen layout; the
  // password-reset flow below is unchanged. All hooks above run either way.
  if (mode === "email") return <FindEmail />;

  return (
    <Screen title="계정 찾기" back>
      <div style={{ marginBottom: 18 }}>
        <Segmented
          value={mode}
          onChange={(m) => {
            setMode(m);
            reset();
          }}
          options={[
            { value: "email", label: "이메일 찾기" },
            { value: "password", label: "비밀번호 재설정" },
          ]}
        />
      </div>

      {step === 0 && (
        <div className="stack" style={{ gap: 14 }}>
          <p className="muted">가입한 이메일과 휴대폰 번호를 확인한 뒤 새 비밀번호를 설정해요.</p>
          <TextField label="이메일" type="email" placeholder="you@example.com" value={emailIn} onChange={(e) => setEmailIn(e.target.value)} />
          <Field label="휴대폰 번호">
            <div style={{ display: "flex", gap: 8 }}>
              <select className="input" style={{ width: 120 }} value={country} onChange={(e) => setCountry(e.target.value)}>
                {NATIONALITIES.map((n) => (
                  <option key={n.code} value={n.code}>
                    {n.flag} {n.dial}
                  </option>
                ))}
              </select>
              <input className="input" inputMode="numeric" placeholder="01012345678" value={localPhone} onChange={(e) => setLocalPhone(e.target.value)} />
            </div>
          </Field>
          <Button
            size="lg"
            block
            disabled={!emailIn.trim() || !localPhone}
            onClick={() => setStep(1)}
          >
            인증번호 받기
          </Button>
        </div>
      )}

      {step === 1 && (
        <VerifyStep
          channel="phone"
          target={e164}
          start={() => authApi.startPhone(e164, "reset_password")}
          confirm={authApi.confirmPhone}
          onDone={async (token) => {
            setBusy(true);
            try {
              const res = await authApi.resetVerify(emailIn.trim(), token);
              setResetToken(res.reset_token);
              setStep(2);
            } catch (e) {
              toast.error(errorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
          cta={busy ? "확인 중…" : "확인"}
        />
      )}

      {step === 2 && (
        <div className="stack" style={{ gap: 14 }}>
          <h2 style={{ fontSize: 20 }}>새 비밀번호 설정</h2>
          <PasswordField label="새 비밀번호" hint="영문·숫자·특수문자 포함 8자 이상" value={pw} onChange={(e) => setPw(e.target.value)} />
          <PasswordField label="새 비밀번호 확인" error={pw2 && pw !== pw2 ? "일치하지 않아요" : null} value={pw2} onChange={(e) => setPw2(e.target.value)} />
          <Button
            size="lg"
            block
            loading={busy}
            disabled={!pw || pw !== pw2}
            onClick={async () => {
              setBusy(true);
              try {
                await authApi.resetPassword(resetToken, pw, pw2);
                toast.success("비밀번호를 변경했어요");
                nav("/login", { replace: true });
              } catch (e) {
                toast.error(errorMessage(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            비밀번호 변경
          </Button>
        </div>
      )}
    </Screen>
  );
}
