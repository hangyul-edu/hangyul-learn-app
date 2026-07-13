import { useEffect, useRef, useState } from "react";
import { Button } from "../components/ui/kit";
import { PinInput } from "../components/ui/Field";
import { useToast } from "../hooks/toast";
import { errorMessage } from "../lib/http";
import { secondsUntil } from "../lib/format";
import type { VerificationStart } from "../lib/types";

/**
 * Reusable "send a code → enter the 6-digit code" step. Auto-sends on mount,
 * shows a resend cooldown, and calls onDone with the resulting verification_token.
 */
export function VerifyStep({
  channel,
  target,
  start,
  confirm,
  onDone,
  cta = "확인",
}: {
  channel: "phone" | "email";
  target: string;
  start: () => Promise<VerificationStart>;
  confirm: (verification_id: string, code: string) => Promise<{ verification_token: string }>;
  onDone: (token: string) => void;
  cta?: string;
}) {
  const toast = useToast();
  const [vid, setVid] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const started = useRef(false);

  async function send() {
    setSending(true);
    setCode("");
    try {
      const res = await start();
      setVid(res.verification_id);
      setCooldown(secondsUntil(res.resend_available_at) || 60);
      toast.success(channel === "phone" ? "인증번호를 문자로 보냈어요" : "인증번호를 이메일로 보냈어요");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSending(false);
    }
  }

  // Auto-send once on mount.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void send();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cooldown ticker.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  async function doConfirm() {
    if (!vid || code.length < 4) return;
    setConfirming(true);
    try {
      const res = await confirm(vid, code);
      onDone(res.verification_token);
    } catch (e) {
      toast.error(errorMessage(e));
      setCode("");
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div>
        <h2 style={{ fontSize: 21 }}>인증번호 입력</h2>
        <p className="muted" style={{ marginTop: 6, fontSize: 14 }}>
          <b style={{ color: "var(--ink)" }}>{target}</b> 로 보낸 6자리 코드를 입력해 주세요.
        </p>
      </div>
      <div className="card" style={{ display: "flex", justifyContent: "center", padding: "22px 12px" }}>
        <PinInput value={code} onChange={setCode} />
      </div>
      <div className="row row--between" style={{ padding: "0 2px" }}>
        <span className="dim" style={{ fontSize: 13 }}>코드를 받지 못하셨나요?</span>
        <button
          type="button"
          className="input-affix__btn"
          style={{ position: "static", padding: 0, color: cooldown > 0 ? "var(--ink-3)" : "var(--brand-600)" }}
          disabled={cooldown > 0 || sending}
          onClick={send}
        >
          {sending ? "전송 중…" : cooldown > 0 ? `재전송 ${cooldown}초` : "재전송"}
        </button>
      </div>
      <Button size="lg" block loading={confirming} disabled={code.length < 6} onClick={doConfirm}>
        {cta}
      </Button>
    </div>
  );
}
