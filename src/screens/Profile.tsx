import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { LogoutModal } from "../components/LogoutModal";
import { WithdrawModal } from "../components/WithdrawModal";
import { WithdrawPasswordModal } from "../components/WithdrawPasswordModal";
import { FailModal } from "../components/FailModal";
import { SuccessModal } from "../components/SuccessModal";
import { CharacterArt, ProfilePlaceholder, type AvatarKey } from "../components/brand/ProfileAssets";
import { ChevronRight } from "../components/brand/HomeIcons";
import { subApi, dashboardApi, authApi } from "../api/endpoints";
import { http, errorMessage, ApiError, NetworkError } from "../lib/http";
import { useAuth } from "../hooks/auth";
import type { Me } from "../lib/types";

const MENU: { label: string; to: string }[] = [
  { label: "계정 관리", to: "/account" },
  { label: "결제수단 관리", to: "/account/payment" },
  { label: "언어 설정", to: "/settings/language" },
  { label: "알림 설정", to: "/settings" },
  { label: "친구 관리", to: "/social" },
  { label: "공지 사항", to: "/more/notices" },
  { label: "FAQ", to: "/faq" },
  { label: "약관 및 정책", to: "/policy" },
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
function StatIcon({ kind }: { kind: "total" | "best" | "current" }) {
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
  // "total" — stacked layers implying accumulated study days.
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3l9 4.5-9 4.5-9-4.5L12 3z" stroke="#9AA0A7" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M3 12l9 4.5 9-4.5M3 16.5l9 4.5 9-4.5" stroke="#9AA0A7" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Profile() {
  const nav = useNavigate();
  const { me, revokeSession, hardSignOut } = useAuth();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutDoneOpen, setLogoutDoneOpen] = useState(false);
  const [logoutFailOpen, setLogoutFailOpen] = useState(false);
  const logoutFinishedRef = useRef(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [withdrawFailOpen, setWithdrawFailOpen] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);
  const finishedRef = useRef(false);

  // Logout modal's 로그아웃: revoke the session server-side, then show the success
  // modal. Local cleanup (hardSignOut) is deferred until the user dismisses it —
  // the background More screen stays frozen behind the overlay in the meantime.
  // revokeSession resolves on success AND on an already-expired session (4xx,
  // normalized as logged out); it throws only for temporary failures (5xx /
  // network) → we keep the user signed in and show the failure modal.
  async function doLogout() {
    if (loggingOut) return; // guard duplicate taps / requests
    setLoggingOut(true);
    try {
      await revokeSession();
      setLoggingOut(false);
      setLogoutOpen(false); // no stacking under the success modal
      setLogoutDoneOpen(true);
    } catch {
      setLoggingOut(false);
      setLogoutOpen(false); // replace confirmation with the failure modal
      setLogoutFailOpen(true);
    }
  }

  // X / 확인 on the logout-success modal: identical terminal action, run once.
  function finishLogout() {
    if (logoutFinishedRef.current) return;
    logoutFinishedRef.current = true;
    // hardSignOut clears tokens, current-user, and every user-scoped query cache.
    hardSignOut();
    nav("/welcome", { replace: true });
  }

  // First warning modal's 탈퇴: NO api — just advance to the password step.
  function toPasswordStep() {
    setWithdrawOpen(false);
    setPwError(null);
    setPwOpen(true);
  }

  // A temporary / unexpected failure (network, timeout, 5xx, unknown) gets the
  // dedicated failure modal; a 4xx (wrong password / validation) stays inline in
  // the password modal. We never assume success on an ambiguous error, so a lost
  // response biases to "failure → retry" (never a false completion modal).
  function isTemporaryFailure(e: unknown): boolean {
    if (e instanceof NetworkError) return true;
    if (e instanceof ApiError) return e.status >= 500;
    return true; // unknown, non-ApiError → treat as retryable
  }

  // Password step's 탈퇴: server verifies the password and withdraws atomically.
  // On terminal success we show the completion modal (still a frozen, overlay-
  // blocked background) and defer local cleanup until the user dismisses it.
  async function withdraw(password: string) {
    if (withdrawing) return; // guard duplicate taps on the irreversible request
    setWithdrawing(true);
    setPwError(null);
    try {
      await authApi.deleteAccount(password);
      setWithdrawing(false);
      setPwOpen(false); // no stacking under the completion modal
      setDoneOpen(true);
    } catch (e) {
      setWithdrawing(false);
      if (isTemporaryFailure(e)) {
        // Replace the password modal with the failure modal (one interactive
        // layer). Account + session untouched; the user can retry from 확인.
        setPwOpen(false);
        setWithdrawFailOpen(true);
      } else {
        setPwError(errorMessage(e)); // inline wrong-password / validation feedback
      }
    }
  }

  // X / 확인 on the completion modal: identical terminal action, run once.
  function finishWithdrawal() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    // hardSignOut clears tokens, current-user, and every user-scoped query cache.
    hardSignOut();
    nav("/welcome", { replace: true });
  }

  const sub = useQuery({ queryKey: ["sub-me"], queryFn: subApi.mine });
  const streak = useQuery({ queryKey: ["streak"], queryFn: dashboardApi.streak });
  const unread = useQuery({
    queryKey: ["notif-unread"],
    queryFn: () => http.get<{ has_unread: boolean }>("/notifications/unread"),
    staleTime: 30_000,
  });

  const nickname = me?.nickname ?? me?.name ?? "회원";
  // Separate Conversation/TOPIK levels make a single "learning level" ambiguous,
  // so the More page shows total learning days instead.
  const totalDays = streak.data?.total_days;
  const best = streak.data?.best;
  const current = streak.data?.current;

  // Subscription state is authoritative from /subscriptions/me — trial vs paid
  // vs none is derived from the server status, never from UI copy.
  const s = sub.data;
  const subState: "trial" | "paid" | "none" = s?.status === "trial" ? "trial" : s?.is_premium ? "paid" : "none";
  const nextBilling = fmtDate(s?.current_period_end ?? s?.trial_end);
  // While loading or on error the state is unknown — render a neutral (paid-style)
  // card, never the orange no-subscription CTA.
  const cardVariant = sub.isLoading || sub.isError ? "paid" : subState;
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
              <StatIcon kind="total" />
              <span className="more__stat-label">총 학습일</span>
              <span className="more__stat-val">{totalDays != null ? `${totalDays}일` : "-"}</span>
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

        {/* Subscription plan card — one component, server-driven states.
            No-subscription state has TWO separate targets: the status row (→
            Subscription Management) and the 구독하기 CTA (→ plan selection). They
            are sibling buttons, so a CTA tap never triggers the row's action. */}
        <section className={`more__sub more__sub--${cardVariant}`} aria-label="이용 구독 플랜">
          <span className="more__sub-label">이용 구독 플랜</span>
          {sub.isLoading ? (
            <div className="more__sub-skeleton" aria-hidden="true" />
          ) : sub.isError ? (
            <div className="more__sub-errrow" role="status">
              <span className="more__sub-empty">구독 정보를 불러오지 못했어요</span>
              <button className="more__sub-retry" onClick={() => sub.refetch()}>다시 시도</button>
            </div>
          ) : subState === "none" ? (
            <>
              <button
                className="more__sub-plan more__sub-emptyrow"
                onClick={() => nav("/subscription")}
                aria-label="이용 중인 구독 플랜이 없어요. 구독 관리로 이동"
              >
                <span className="more__sub-title-row">
                  <span className="more__sub-empty">이용 중인 구독 플랜이 없어요</span>
                  <ChevronRight size={18} color="#9AA0A7" />
                </span>
              </button>
              <button
                className="more__sub-cta"
                onClick={() => nav("/subscription", { state: { openPlans: true } })}
                aria-label="구독하기, 요금제와 가격 보기"
              >
                구독하기
              </button>
            </>
          ) : (
            <button
              className="more__sub-plan"
              onClick={() => nav("/subscription")}
              aria-label={`${s?.plan_name ?? "구독 플랜"}${nextBilling ? `, 다음 결제일 ${nextBilling}` : ""}. 구독 관리로 이동`}
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

      <LogoutModal
        open={logoutOpen}
        loading={loggingOut}
        onCancel={() => !loggingOut && setLogoutOpen(false)}
        onConfirm={doLogout}
      />

      <SuccessModal
        open={logoutDoneOpen}
        title="로그아웃됐습니다"
        description="학습 기록 및 데이터는 계정에 안전하게 보관됩니다"
        closeAriaLabel="로그아웃 완료 창 닫기"
        onClose={finishLogout}
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

      {/* 확인 returns to the password step in a clean, retry-ready state; no API,
          no logout, no navigation. */}
      <FailModal
        open={withdrawFailOpen}
        title="탈퇴에 실패했어요"
        description={
          <>
            일시적인 오류가 발생했어요
            <br />
            잠시 후 다시 시도해 주세요
          </>
        }
        onClose={() => {
          setWithdrawFailOpen(false);
          setPwOpen(true);
        }}
      />

      {/* Logout failed (temporary). 확인 just closes → user stays signed in on More. */}
      <FailModal
        open={logoutFailOpen}
        title="로그아웃에 실패했어요"
        description={
          <>
            일시적인 오류가 발생했어요
            <br />
            잠시 후 다시 시도해 주세요
          </>
        }
        onClose={() => setLogoutFailOpen(false)}
      />

      <SuccessModal
        open={doneOpen}
        title="탈퇴가 완료됐습니다"
        description={
          <>
            그동안 이용해 주셔서 감사합니다
            <br />
            더 나은 서비스로 다시 찾아뵙겠습니다
          </>
        }
        closeAriaLabel="탈퇴 완료 창 닫기"
        onClose={finishWithdrawal}
      />
    </div>
  );
}
