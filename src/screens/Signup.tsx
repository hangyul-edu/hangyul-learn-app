import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TopBar } from "../components/layout/Screen";
import { Button, CheckLine } from "../components/ui/kit";
import { Field, PasswordField, TextField } from "../components/ui/Field";
import { VerifyStep } from "./VerifyStep";
import { authApi } from "../api/endpoints";
import { useLoginFlow } from "../hooks/loginFlow";
import { useToast } from "../hooks/toast";
import { errorMessage } from "../lib/http";
import { NATIONALITIES } from "../lib/format";

function passwordProblem(p: string): string | null {
  if (p.length < 8 || p.length > 64) return "8~64자로 입력해 주세요.";
  if (!/[a-zA-Z]/.test(p) || !/[0-9]/.test(p) || !/[^a-zA-Z0-9]/.test(p))
    return "영문·숫자·특수문자를 모두 포함해야 해요.";
  return null;
}
function emailValid(e: string) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
}

export function Signup() {
  const nav = useNavigate();
  const toast = useToast();
  const completeLogin = useLoginFlow();
  const [step, setStep] = useState(0); // 0 info, 1 phone, 2 email, 3 agree
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [country, setCountry] = useState("KR");
  const [localPhone, setLocalPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [phoneToken, setPhoneToken] = useState("");
  const [emailToken, setEmailToken] = useState("");

  const [agree, setAgree] = useState({ age: false, terms: false, privacy: false, third: false });
  const [marketing, setMarketing] = useState({ email_sms: false, service: false, ad: false });

  const dial = useMemo(() => NATIONALITIES.find((n) => n.code === country)?.dial ?? "+82", [country]);
  const e164 = useMemo(() => `${dial}${localPhone.replace(/^0+/, "").replace(/\D/g, "")}`, [dial, localPhone]);

  function validateInfo(): boolean {
    const e: Record<string, string> = {};
    if (name.trim().length < 1) e.name = "이름을 입력해 주세요.";
    if (localPhone.replace(/\D/g, "").length < 7) e.phone = "휴대폰 번호를 정확히 입력해 주세요.";
    if (!emailValid(email)) e.email = "올바른 이메일 형식이 아니에요.";
    const pw = passwordProblem(password);
    if (pw) e.password = pw;
    if (password !== confirm) e.confirm = "비밀번호가 일치하지 않아요.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  const allRequired = agree.age && agree.terms && agree.privacy && agree.third;

  async function submitSignup() {
    setBusy(true);
    try {
      const res = await authApi.signup({
        name: name.trim(),
        email: email.trim(),
        password,
        confirm_password: confirm,
        phone: e164,
        phone_verification_token: phoneToken,
        email_verification_token: emailToken,
        nationality: country,
        age_consent: agree.age,
        terms_accepted: agree.terms,
        privacy_accepted: agree.privacy,
        third_party_accepted: agree.third,
        marketing_opt_in: marketing.email_sms,
        service_notification_opt_in: marketing.service,
        ad_notification_opt_in: marketing.ad,
      });
      if (res.requires_login) {
        const token = await authApi.login(email.trim(), password, true);
        await completeLogin(token, true);
      }
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen">
      <TopBar back onBack={() => (step === 0 ? nav(-1) : setStep((s) => s - 1))} title="회원가입" />
      <div className="screen__body">
        <div className="progress" style={{ marginBottom: 20 }}>
          <div className="progress__bar" style={{ width: `${((step + 1) / 4) * 100}%` }} />
        </div>

        {step === 0 && (
          <div className="stack" style={{ gap: 15 }}>
            <h2 style={{ fontSize: 21 }}>계정 정보를 입력해요</h2>
            <TextField label="이름" placeholder="실명" value={name} error={errors.name} onChange={(e) => setName(e.target.value)} />
            <Field label="휴대폰 번호" error={errors.phone}>
              <div style={{ display: "flex", gap: 8 }}>
                <select className="input" style={{ width: 120 }} value={country} onChange={(e) => setCountry(e.target.value)}>
                  {NATIONALITIES.map((n) => (
                    <option key={n.code} value={n.code}>
                      {n.flag} {n.dial}
                    </option>
                  ))}
                </select>
                <input
                  className={`input ${errors.phone ? "input--invalid" : ""}`}
                  inputMode="numeric"
                  placeholder="01012345678"
                  value={localPhone}
                  onChange={(e) => setLocalPhone(e.target.value)}
                />
              </div>
            </Field>
            <TextField label="이메일" type="email" placeholder="you@example.com" value={email} error={errors.email} onChange={(e) => setEmail(e.target.value)} />
            <PasswordField label="비밀번호" hint="영문·숫자·특수문자 포함 8자 이상" placeholder="비밀번호" value={password} error={errors.password} onChange={(e) => setPassword(e.target.value)} />
            <PasswordField label="비밀번호 확인" placeholder="다시 입력" value={confirm} error={errors.confirm} onChange={(e) => setConfirm(e.target.value)} />
            <Button size="lg" block onClick={() => validateInfo() && setStep(1)}>
              다음
            </Button>
          </div>
        )}

        {step === 1 && (
          <VerifyStep
            channel="phone"
            target={e164}
            start={() => authApi.startPhone(e164, "signup")}
            confirm={authApi.confirmPhone}
            onDone={(t) => {
              setPhoneToken(t);
              toast.success("휴대폰 인증 완료!");
              setStep(2);
            }}
          />
        )}

        {step === 2 && (
          <VerifyStep
            channel="email"
            target={email}
            start={() => authApi.startEmail(email.trim())}
            confirm={authApi.confirmEmail}
            onDone={(t) => {
              setEmailToken(t);
              toast.success("이메일 인증 완료!");
              setStep(3);
            }}
          />
        )}

        {step === 3 && (
          <div className="stack" style={{ gap: 6 }}>
            <h2 style={{ fontSize: 21, marginBottom: 6 }}>약관에 동의해 주세요</h2>
            <div className="card" style={{ padding: "4px 8px" }}>
              <CheckLine
                round
                checked={allRequired && marketing.email_sms && marketing.service && marketing.ad}
                onToggle={() => {
                  const all = allRequired && marketing.email_sms && marketing.service && marketing.ad;
                  setAgree({ age: !all, terms: !all, privacy: !all, third: !all });
                  setMarketing({ email_sms: !all, service: !all, ad: !all });
                }}
              >
                <b>전체 동의</b>
              </CheckLine>
              <div className="divider" />
              <CheckLine round checked={agree.age} onToggle={() => setAgree((a) => ({ ...a, age: !a.age }))}>
                (필수) 만 14세 이상이에요
              </CheckLine>
              <CheckLine round checked={agree.terms} onToggle={() => setAgree((a) => ({ ...a, terms: !a.terms }))}>
                (필수) 서비스 이용약관 동의
              </CheckLine>
              <CheckLine round checked={agree.privacy} onToggle={() => setAgree((a) => ({ ...a, privacy: !a.privacy }))}>
                (필수) 개인정보 처리방침 동의
              </CheckLine>
              <CheckLine round checked={agree.third} onToggle={() => setAgree((a) => ({ ...a, third: !a.third }))}>
                (필수) 제3자 정보제공 동의
              </CheckLine>
              <div className="divider" />
              <CheckLine round checked={marketing.email_sms} onToggle={() => setMarketing((m) => ({ ...m, email_sms: !m.email_sms }))}>
                (선택) 이메일·SMS 마케팅 수신
              </CheckLine>
              <CheckLine round checked={marketing.service} onToggle={() => setMarketing((m) => ({ ...m, service: !m.service }))}>
                (선택) 서비스 알림 수신
              </CheckLine>
              <CheckLine round checked={marketing.ad} onToggle={() => setMarketing((m) => ({ ...m, ad: !m.ad }))}>
                (선택) 광고성 푸시 알림 수신
              </CheckLine>
            </div>
            <div style={{ height: 8 }} />
            <Button size="lg" block loading={busy} disabled={!allRequired} onClick={submitSignup}>
              가입 완료
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
