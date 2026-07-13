import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Screen } from "../components/layout/Screen";
import { Button } from "../components/ui/kit";
import { Field, PasswordField, TextField } from "../components/ui/Field";
import { VerifyStep } from "./VerifyStep";
import { authApi } from "../api/endpoints";
import { useAuth } from "../hooks/auth";
import { useToast } from "../hooks/toast";
import { errorMessage } from "../lib/http";
import { NATIONALITIES } from "../lib/format";

/* ------------------------- Password ------------------------- */
export function ChangePassword() {
  const nav = useNavigate();
  const toast = useToast();
  const { hardSignOut } = useAuth();
  const [cur, setCur] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await authApi.changePassword(cur, pw, pw2);
      toast.success("비밀번호를 변경했어요. 다시 로그인해 주세요.");
      hardSignOut();
      nav("/login", { replace: true });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title="비밀번호 변경" back>
      <div className="stack" style={{ gap: 14 }}>
        <p className="muted">보안을 위해 변경 후 모든 기기에서 다시 로그인해야 해요.</p>
        <PasswordField label="현재 비밀번호" value={cur} onChange={(e) => setCur(e.target.value)} />
        <PasswordField label="새 비밀번호" hint="영문·숫자·특수문자 포함 8자 이상" value={pw} onChange={(e) => setPw(e.target.value)} />
        <PasswordField label="새 비밀번호 확인" error={pw2 && pw !== pw2 ? "일치하지 않아요" : null} value={pw2} onChange={(e) => setPw2(e.target.value)} />
        <Button size="lg" block loading={busy} disabled={!cur || !pw || pw !== pw2} onClick={submit}>변경하기</Button>
      </div>
    </Screen>
  );
}

/* ------------------------- Phone ------------------------- */
export function ChangePhone() {
  const nav = useNavigate();
  const toast = useToast();
  const { me, setMe } = useAuth();
  const [step, setStep] = useState(0);
  const [country, setCountry] = useState(me?.nationality ?? "KR");
  const [localPhone, setLocalPhone] = useState("");
  const dial = useMemo(() => NATIONALITIES.find((n) => n.code === country)?.dial ?? "+82", [country]);
  const e164 = useMemo(() => `${dial}${localPhone.replace(/^0+/, "").replace(/\D/g, "")}`, [dial, localPhone]);

  return (
    <Screen title="휴대폰 번호 변경" back>
      {step === 0 ? (
        <div className="stack" style={{ gap: 14 }}>
          <p className="muted">새 번호로 인증번호를 보내 소유를 확인해요.</p>
          <Field label="새 휴대폰 번호">
            <div style={{ display: "flex", gap: 8 }}>
              <select className="input" style={{ width: 120 }} value={country} onChange={(e) => setCountry(e.target.value)}>
                {NATIONALITIES.map((n) => (
                  <option key={n.code} value={n.code}>{n.flag} {n.dial}</option>
                ))}
              </select>
              <input className="input" inputMode="numeric" placeholder="01012345678" value={localPhone} onChange={(e) => setLocalPhone(e.target.value)} />
            </div>
          </Field>
          <Button size="lg" block disabled={!localPhone} onClick={() => setStep(1)}>인증번호 받기</Button>
        </div>
      ) : (
        <VerifyStep
          channel="phone"
          target={e164}
          start={() => authApi.startPhone(e164, "change_phone")}
          confirm={authApi.confirmPhone}
          onDone={async (token) => {
            try {
              await authApi.changePhone(e164, token, country);
              if (me) setMe({ ...me, phone: e164, nationality: country });
              toast.success("휴대폰 번호를 변경했어요");
              nav(-1);
            } catch (e) {
              toast.error(errorMessage(e));
            }
          }}
        />
      )}
    </Screen>
  );
}

/* ------------------------- Email ------------------------- */
export function ChangeEmail() {
  const nav = useNavigate();
  const toast = useToast();
  const { me, setMe } = useAuth();
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState("");

  return (
    <Screen title="이메일 변경" back>
      {step === 0 ? (
        <div className="stack" style={{ gap: 14 }}>
          <p className="muted">새 이메일로 인증번호를 보내 소유를 확인해요.</p>
          <TextField label="새 이메일" type="email" placeholder="new@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button size="lg" block disabled={!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)} onClick={() => setStep(1)}>인증번호 받기</Button>
        </div>
      ) : (
        <VerifyStep
          channel="email"
          target={email}
          start={() => authApi.startEmailChange(email.trim())}
          confirm={authApi.confirmEmailChange}
          onDone={async (token) => {
            try {
              const res = await authApi.changeEmail(email.trim(), token);
              if (me) setMe({ ...me, email: res.email ?? email.trim() });
              toast.success("이메일을 변경했어요");
              nav(-1);
            } catch (e) {
              toast.error(errorMessage(e));
            }
          }}
        />
      )}
    </Screen>
  );
}
