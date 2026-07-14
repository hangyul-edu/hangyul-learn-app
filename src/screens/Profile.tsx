import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ConfirmDialog } from "../components/ui/Modal";
import { WithdrawModal } from "../components/WithdrawModal";
import { WithdrawPasswordModal } from "../components/WithdrawPasswordModal";
import { CharacterArt, ProfilePlaceholder, type AvatarKey } from "../components/brand/ProfileAssets";
import { ChevronRight } from "../components/brand/HomeIcons";
import { subApi, dashboardApi, authApi } from "../api/endpoints";
import { http, errorMessage } from "../lib/http";
import { useAuth } from "../hooks/auth";
import type { Me } from "../lib/types";

const MENU: { label: string; to: string }[] = [
  { label: "계정 관리", to: "/account" },
  { label: "결제수단 관리", to: "/account/payment" },
  { label: "언어 설정", to: "/settings" },
  { label: "알림 설정", to: "/settings" },
  { label: "친구 관리", to: "/social" },
  { label: "공지 사항", to: "/support" },
  { label: "FAQ", to: "/support" },
  { label: "약관 및 정책", to: "/policy/terms" },
];

function ProfileAvatar({ me }: { me: Me | null }) {
  if (me?.profile_image_type === "CUSTOM" && me.profile_image_url)
    return <img className="more__avatar-img" src={me.profile_image_url} alt="" />;
  if (me?.profile_image_type === "AVATAR" && me.avatar_key)
    return <CharacterArt variant={me.avatar_key as AvatarKey} fill="100%" />;
  return <ProfilePlaceholder />;
}

function fmtDate(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
}

/** Small muted stat icons for the profile summary row. */
function StatIcon({ kind }: { kind: "level" | "best" | "current" }) {
  if (kind === "best")
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 3c1 3-2 4-2 7a2 2 0 0 0 4 0c2 1.5 3 3.5 3 6a5 5 0 0 1-10 0c0-4 3-6 5-13z" stroke="#9AA0A7" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    );
  if (kind === "current")
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="4" y="5" width="16" height="15" rx="3" stroke="#9AA0A7" strokeWidth="1.6" />
        <path d="M8 3v4M16 3v4M9 14l2 2 4-4" stroke="#9AA0A7" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3l2.5 5.2 5.5.6-4 3.9 1 5.6L12 21l-5-2.7 1-5.6-4-3.9 5.5-.6L12 3z" stroke="#9AA0A7" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

export function Profile() {
  const nav = useNavigate();
  const { me, logout, hardSignOut } = useAuth();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  // First warning modal's 탈퇴: NO api — just advance to the password step.
  function toPasswordStep() {
    setWithdrawOpen(false);
    setPwError(null);
    setPwOpen(true);
  }

  // Password step's 탈퇴: server verifies the password and withdraws atomically.
  async function withdraw(password: string) {
    if (withdrawing) return; // guard duplicate taps on the irreversible request
    setWithdrawing(true);
    setPwError(null);
    try {
      await authApi.deleteAccount(password);
      // hardSignOut clears tokens, current-user, and every user-scoped query cache.
      hardSignOut();
      nav("/welcome", { replace: true });
    } catch (e) {
      setPwError(errorMessage(e)); // stay on the modal; account untouched, allow retry
      setWithdrawing(false);
    }
  }

  const sub = useQuery({ queryKey: ["sub-me"], queryFn: subApi.mine });
  const streak = useQuery({ queryKey: ["streak"], queryFn: dashboardApi.streak });
  const dash = useQuery({ queryKey: ["dashboard"], queryFn: dashboardApi.summary });
  const unread = useQuery({
    queryKey: ["notif-unread"],
    queryFn: () => http.get<{ has_unread: boolean }>("/notifications/unread"),
    staleTime: 30_000,
  });

  const nickname = me?.nickname ?? me?.name ?? "회원";
  const level = dash.data?.tracks.length ? Math.max(...dash.data.tracks.map((t) => t.level)) : null;
  const best = streak.data?.best;
  const current = streak.data?.current;

  // Subscription state is authoritative from /subscriptions/me — trial vs paid
  // vs none is derived from the server status, never from UI copy.
  const s = sub.data;
  const subState: "trial" | "paid" | "none" = s?.status === "trial" ? "trial" : s?.is_premium ? "paid" : "none";
  const nextBilling = fmtDate(s?.current_period_end ?? s?.trial_end);
  const hasUnread = !!unread.data?.has_unread;

  return (
    <div className="screen more">
      <div className="screen__body screen__body--nav more__body">
        <header className="more__header">
          <button
            className="more__bell"
            onClick={() => nav("/notifications")}
            aria-label={hasUnread ? "알림, 새 알림 있음" : "알림"}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 9a6 6 0 0 1 12 0c0 4 1.2 5.6 2 6.5.5.6.1 1.5-.7 1.5H4.7c-.8 0-1.2-.9-.7-1.5C4.8 14.6 6 13 6 9z" stroke="#272C30" strokeWidth="1.7" strokeLinejoin="round" />
              <path d="M9.5 20a2.5 2.5 0 0 0 5 0" stroke="#272C30" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
            {hasUnread && <span className="more__bell-dot" aria-hidden="true" />}
          </button>
        </header>

        {/* Profile summary card */}
        <section className="more__profile">
          <div className="more__avatar">
            <ProfileAvatar me={me} />
          </div>
          <button className="more__nick" onClick={() => nav("/profile/edit")} aria-label="프로필 변경">
            <span className="more__nick-name">{nickname}</span>
            <ChevronRight size={20} color="#9AA0A7" />
          </button>

          <div className="more__divider" />

          <div className="more__stats">
            <div className="more__stat">
              <StatIcon kind="level" />
              <span className="more__stat-label">학습 레벨</span>
              <span className="more__stat-val">{level != null ? `Lv. ${level}` : "-"}</span>
            </div>
            <div className="more__stat">
              <StatIcon kind="best" />
              <span className="more__stat-label">최고 연속일</span>
              <span className="more__stat-val">{best != null ? `${best}일` : "-"}</span>
            </div>
            <div className="more__stat">
              <StatIcon kind="current" />
              <span className="more__stat-label">현재 연속 출석일</span>
              <span className="more__stat-val">{current != null ? `${current}일` : "-"}</span>
            </div>
          </div>
        </section>

        {/* Subscription plan card — one component, three server-driven states */}
        <section className={`more__sub more__sub--${subState}`} aria-label="이용 구독 플랜">
          <span className="more__sub-label">이용 구독 플랜</span>
          {subState === "none" ? (
            <>
              <p className="more__sub-empty">이용 중인 구독 플랜이 없어요.</p>
              <button className="more__sub-cta" onClick={() => nav("/subscription")}>
                구독하기
              </button>
            </>
          ) : (
            <button
              className="more__sub-plan"
              onClick={() => nav(subState === "paid" ? "/account/billing" : "/subscription")}
            >
              {subState === "trial" && <span className="more__sub-ribbon">무료체험중</span>}
              <span className="more__sub-title-row">
                <span className="more__sub-title">{s?.plan_name ?? "구독 플랜"}</span>
                <ChevronRight size={18} color={subState === "trial" ? "#8D734F" : "#9AA0A7"} />
              </span>
              {nextBilling && (
                <span className="more__sub-billing">
                  다음 결제일 <b>{nextBilling}</b>
                </span>
              )}
            </button>
          )}
        </section>

        {/* Menu — plain rows, no cards/icons/chevrons */}
        <nav className="more__menu">
          {MENU.map((m) => (
            <button key={m.label} className="more__menu-row" onClick={() => nav(m.to)}>
              {m.label}
            </button>
          ))}
        </nav>

        <div className="more__account-actions">
          <button className="more__muted-action" onClick={() => setWithdrawOpen(true)}>
            탈퇴하기
          </button>
          <button className="more__muted-action" onClick={() => setLogoutOpen(true)}>
            로그아웃
          </button>
        </div>
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

      <WithdrawModal
        open={withdrawOpen}
        loading={false}
        onCancel={() => setWithdrawOpen(false)}
        onConfirm={toPasswordStep}
      />

      <WithdrawPasswordModal
        open={pwOpen}
        loading={withdrawing}
        error={pwError}
        onCancel={() => {
          if (withdrawing) return;
          setPwOpen(false);
          setPwError(null);
        }}
        onSubmit={withdraw}
      />
    </div>
  );
}
