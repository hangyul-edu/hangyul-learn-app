import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Screen } from "../components/layout/Screen";
import { Button, Card } from "../components/ui/kit";
import { Dialog } from "../components/ui/Modal";
import { PasswordField } from "../components/ui/Field";
import { authApi } from "../api/endpoints";
import { useAuth } from "../hooks/auth";
import { useToast } from "../hooks/toast";
import { errorMessage } from "../lib/http";
import { maskPhone } from "../lib/format";

function Row({ icon, label, value, onClick }: { icon: string; label: string; value?: string; onClick: () => void }) {
  return (
    <button className="listrow" onClick={onClick}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <div className="listrow__main">
        <div className="listrow__title">{label}</div>
        {value && <div className="listrow__sub">{value}</div>}
      </div>
      <span className="listrow__chev">변경 ›</span>
    </button>
  );
}

export function Account() {
  const nav = useNavigate();
  const toast = useToast();
  const { me, hardSignOut } = useAuth();
  const [delOpen, setDelOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);

  async function del() {
    setBusy(true);
    try {
      await authApi.deleteAccount(pw || null);
      toast.success("계정이 삭제되었어요");
      hardSignOut();
      nav("/welcome", { replace: true });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title="계정 관리" back>
      <Card className="card--flat" style={{ background: "var(--surface-2)", marginBottom: 16 }}>
        <div className="row row--between" style={{ fontSize: 13.5, padding: "4px 0" }}>
          <span className="muted">이름</span>
          <span style={{ fontWeight: 700 }}>{me?.name}</span>
        </div>
      </Card>

      <div className="stack" style={{ gap: 8 }}>
        <Row icon="📧" label="이메일 변경" value={me?.email} onClick={() => nav("/account/email")} />
        <Row icon="📱" label="휴대폰 번호 변경" value={maskPhone(me?.phone)} onClick={() => nav("/account/phone")} />
        <Row icon="🔒" label="비밀번호 변경" onClick={() => nav("/account/password")} />
      </div>

      <div style={{ height: 30 }} />
      <button className="btn btn--danger btn--block" onClick={() => setDelOpen(true)}>
        회원 탈퇴
      </button>

      <Dialog open={delOpen} onClose={() => !busy && setDelOpen(false)} emoji="⚠️" title="정말 탈퇴할까요?" text="모든 학습 기록이 삭제되며 되돌릴 수 없어요.">
        <div className="stack" style={{ gap: 10 }}>
          <PasswordField placeholder="비밀번호 확인" value={pw} onChange={(e) => setPw(e.target.value)} />
          <Button variant="danger" block loading={busy} onClick={del}>탈퇴하기</Button>
          <Button variant="ghost" block disabled={busy} onClick={() => setDelOpen(false)}>취소</Button>
        </div>
      </Dialog>
    </Screen>
  );
}
