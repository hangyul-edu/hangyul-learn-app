import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Screen } from "../components/layout/Screen";
import { Button, Segmented } from "../components/ui/kit";
import { Dialog } from "../components/ui/Modal";
import { Field, PasswordField, TextField } from "../components/ui/Field";
import { VerifyStep } from "./VerifyStep";
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
  const [name, setName] = useState("");
  const [emailIn, setEmailIn] = useState("");
  const [country, setCountry] = useState("KR");
  const [localPhone, setLocalPhone] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [foundEmail, setFoundEmail] = useState<string | null>(null);

  const dial = useMemo(() => NATIONALITIES.find((n) => n.code === country)?.dial ?? "+82", [country]);
  const e164 = useMemo(() => `${dial}${localPhone.replace(/^0+/, "").replace(/\D/g, "")}`, [dial, localPhone]);

  function reset() {
    setStep(0);
    setResetToken("");
    setFoundEmail(null);
    setPw("");
    setPw2("");
  }

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
          <p className="muted">
            {mode === "email"
              ? "가입 시 등록한 이름과 휴대폰 번호로 이메일을 찾을 수 있어요."
              : "가입한 이메일과 휴대폰 번호를 확인한 뒤 새 비밀번호를 설정해요."}
          </p>
          {mode === "email" ? (
            <TextField label="이름" placeholder="실명" value={name} onChange={(e) => setName(e.target.value)} />
          ) : (
            <TextField label="이메일" type="email" placeholder="you@example.com" value={emailIn} onChange={(e) => setEmailIn(e.target.value)} />
          )}
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
            disabled={mode === "email" ? !name.trim() || !localPhone : !emailIn.trim() || !localPhone}
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
          start={() => authApi.startPhone(e164, mode === "email" ? "recover_email" : "reset_password")}
          confirm={authApi.confirmPhone}
          onDone={async (token) => {
            setBusy(true);
            try {
              if (mode === "email") {
                const res = await authApi.recoverEmail(token, name.trim());
                setFoundEmail(res.email);
              } else {
                const res = await authApi.resetVerify(emailIn.trim(), token);
                setResetToken(res.reset_token);
                setStep(2);
              }
            } catch (e) {
              toast.error(errorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
          cta={busy ? "확인 중…" : "확인"}
        />
      )}

      {step === 2 && mode === "password" && (
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

      <Dialog open={!!foundEmail} onClose={() => nav("/login")} emoji="📧" title="이메일을 찾았어요" text="아래 이메일로 로그인해 주세요.">
        <div className="card card--soft" style={{ fontWeight: 800, fontSize: 18, marginBottom: 16 }}>{foundEmail}</div>
        <Button block onClick={() => nav("/login", { replace: true })}>
          로그인하러 가기
        </Button>
      </Dialog>
    </Screen>
  );
}
