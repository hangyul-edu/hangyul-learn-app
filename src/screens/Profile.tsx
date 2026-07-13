import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { TopBar } from "../components/layout/Screen";
import { Avatar, Badge, Card } from "../components/ui/kit";
import { ConfirmDialog } from "../components/ui/Modal";
import { useAuth } from "../hooks/auth";

const AVATAR_EMOJI: Record<string, string> = { AVATAR_01: "🦊", AVATAR_02: "🐨", AVATAR_03: "🐣" };

function MenuRow({ icon, label, onClick, danger }: { icon: string; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button className="listrow" onClick={onClick}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <div className="listrow__main">
        <div className="listrow__title" style={danger ? { color: "var(--danger)" } : undefined}>{label}</div>
      </div>
      <span className="listrow__chev">›</span>
    </button>
  );
}

export function Profile() {
  const nav = useNavigate();
  const { me, logout } = useAuth();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const isPremium = me?.membership?.is_premium;

  return (
    <div className="screen">
      <TopBar title="내 정보" right={<button className="topbar__btn" onClick={() => nav("/settings")}>⚙️</button>} />
      <div className="screen__body screen__body--nav">
        <Card className="row" padLg style={{ marginBottom: 18 }} onClick={() => nav("/profile/edit")}>
          <Avatar
            size={64}
            name={me?.nickname}
            url={me?.profile_image_type === "CUSTOM" ? me?.profile_image_url : null}
            emoji={me?.profile_image_type === "AVATAR" ? AVATAR_EMOJI[me?.avatar_key ?? ""] : undefined}
          />
          <div style={{ flex: 1 }}>
            <div className="row" style={{ gap: 8 }}>
              <span style={{ fontWeight: 900, fontSize: 19 }}>{me?.nickname ?? me?.name}</span>
              {isPremium ? <Badge tone="premium">👑 프리미엄</Badge> : <Badge>무료</Badge>}
            </div>
            <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>{me?.email}</div>
          </div>
          <span className="listrow__chev">›</span>
        </Card>

        <div className="stack" style={{ gap: 8 }}>
          <MenuRow icon="👑" label="멤버십 · 구독" onClick={() => nav("/subscription")} />
          <MenuRow icon="⚡" label="포인트 내역" onClick={() => nav("/points")} />
          <MenuRow icon="🔖" label="저장 · 복습" onClick={() => nav("/saved")} />
          <div style={{ height: 6 }} />
          <MenuRow icon="🔐" label="계정 관리" onClick={() => nav("/account")} />
          <MenuRow icon="⚙️" label="설정" onClick={() => nav("/settings")} />
          <MenuRow icon="💬" label="고객센터 · FAQ" onClick={() => nav("/support")} />
          <div style={{ height: 6 }} />
          <MenuRow icon="🚪" label="로그아웃" onClick={() => setLogoutOpen(true)} danger />
        </div>

        <div className="center dim" style={{ fontSize: 11.5, marginTop: 24 }}>한글 · Hangyul</div>
      </div>

      <ConfirmDialog
        open={logoutOpen}
        emoji="👋"
        title="로그아웃 할까요?"
        confirmLabel="로그아웃"
        onCancel={() => setLogoutOpen(false)}
        onConfirm={() => {
          setLogoutOpen(false);
          void logout();
        }}
      />
    </div>
  );
}
