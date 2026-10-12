import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { LogoutModal } from "../components/LogoutModal";
import { WithdrawModal } from "../components/WithdrawModal";
import { WithdrawPasswordModal } from "../components/WithdrawPasswordModal";
import { WithdrawReauthModal } from "../components/WithdrawReauthModal";
import { startSocialReauth, takePendingReauth, type PendingReauth } from "../hooks/socialLogin";
import { FailModal } from "../components/FailModal";
import { SuccessModal } from "../components/SuccessModal";
import { ProfilePlaceholder, avatarBg, characterArtSrc, characterArtStyle, type AvatarKey } from "../components/brand/ProfileAssets";
import icChevron from "../assets/brand/ic-16-chevron.svg";
/* MOR-001's own nickname chevron, exported from ic_16_arrow 1:5563 — 6x10.5,
   right-pointing, stroked #262C31. Not the 6.5x11.5 ic-16-chevron above. */
import icNickArrow from "../assets/brand/ic-16-arrow-right-dark.svg";
import subTrialRibbon from "../assets/brand/sub-trial-ribbon.svg";
import icStarCheck from "../assets/brand/ic-star-check.svg";
import icBell from "../assets/brand/ic-24-bell-dark.svg";
import statTotalDays from "../assets/brand/stat-total-days.svg";
import statBestStreak from "../assets/brand/stat-best-streak.svg";
import statCurrentStreak from "../assets/brand/stat-current-streak.svg";
import { subApi, dashboardApi, authApi } from "../api/endpoints";
import { http, errorMessage, ApiError, NetworkError } from "../lib/http";
import { useAuth } from "../hooks/auth";
import type { Me, SocialProvider } from "../lib/types";
import { useTranslation, type TranslationKey } from "../i18n";
import { formatLongDate } from "../lib/format";
import { hasLiveSubscription, isTrialStatus } from "../lib/subscription";

/**
 * More menu — Figma MOR-005, English frame 893:33108.
 *
 * The English frame is the current one: its eight entries and their order match
 * the routes the app ships. The Korean frame (1:5697) is stale, listing nine
 * entries including 오프라인 동영상 학습 and 1:1 문의하기 for features that do not
 * exist, so it is not used for structure.
 *
 * Rendered as plain Body 6 rows with a 34px gap and no chevron or divider.
 */
const MENU: { label: TranslationKey; to: string }[] = [
  { label: "more.account", to: "/account" },
  { label: "more.payment", to: "/account/payment" },
  { label: "more.language", to: "/settings/language" },
  { label: "more.notifications", to: "/settings" },
  { label: "more.friends", to: "/social" },
  { label: "more.announcements", to: "/more/notices" },
  { label: "more.faq", to: "/faq" },
  { label: "more.terms", to: "/policy" },
];

/**
 * The More-page avatar. `me` (from /users/me, which EditProfile writes through
 * `setMe`) is the single source of truth, so whatever was picked in Profile
 * Management shows here — there is no separate default kept on this screen.
 * The character is ink-centred and per-character sized for the 60px disc, the
 * same way the AME-006 picker does it.
 */
function ProfileAvatar({ me }: { me: Me | null }) {
  if (me?.profile_image_type === "CUSTOM" && me.profile_image_url)
    return <img className="more__avatar-img" src={me.profile_image_url} alt="" />;
  if (me?.profile_image_type === "AVATAR" && me.avatar_key) {
    const key = me.avatar_key as AvatarKey;
    return <img src={characterArtSrc(key)} alt="" style={characterArtStyle(key, MORE_AVATAR)} />;
  }
  return <ProfilePlaceholder />;
}

/** Figma 1:5560 — the More page draws the avatar disc at 60px. */
const MORE_AVATAR = 60;

/** A character carries its own tint; only the no-image state uses the Gray 2 disc. */
function avatarDiscStyle(me: Me | null) {
  return me?.profile_image_type === "AVATAR" && me.avatar_key
    ? { background: avatarBg(me.avatar_key as AvatarKey) }
    : undefined;
}

/**
 * Stat icons — the real emoji artwork exported from MOR-001_더보기메인
 * (📒 노트 1:5569, 🌤️ 작은 구름 뒤의 태양 1:5587, 🏅 스포츠 메달 1:5604).
 * Rendered at Figma's 16px.
 */
const STAT_ART: Record<StatKind, string> = {
  total: statTotalDays,
  best: statBestStreak,
  current: statCurrentStreak,
};

type StatKind = "total" | "best" | "current";

function StatIcon({ kind }: { kind: StatKind }) {
  return <img className="more__stat-icon" src={STAT_ART[kind]} alt="" aria-hidden="true" />;
}

export function Profile() {
  const { t, language } = useTranslation();
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
  // Accounts without a password (social sign-up) confirm by signing in again.
  const [methodsLoading, setMethodsLoading] = useState(false);
  const [reauthOpen, setReauthOpen] = useState(false);
  const [reauthProviders, setReauthProviders] = useState<SocialProvider[]>([]);
  const [reauthError, setReauthError] = useState<string | null>(null);
  // Which confirmation step the failure modal's 확인 returns to.
  const [failReturn, setFailReturn] = useState<"password" | "reauth" | null>(null);
  const pendingRan = useRef(false);

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

  // 확인 on the logout-success modal: the single terminal action, run once.
  function finishLogout() {
    if (logoutFinishedRef.current) return;
    logoutFinishedRef.current = true;
    // hardSignOut clears tokens, current-user, and every user-scoped query cache.
    hardSignOut();
    nav("/welcome", { replace: true });
  }

  // First warning modal's 탈퇴: ask the server how this account confirms a
  // deletion (read-only), then advance to the password step — or, for an
  // account created by social login, to the provider re-authentication step.
  async function toConfirmStep() {
    if (methodsLoading) return;
    setMethodsLoading(true);
    try {
      const methods = await authApi.deletionMethods();
      setWithdrawOpen(false);
      if (methods.has_password) {
        setPwError(null);
        setPwOpen(true);
      } else {
        setReauthProviders(methods.web_providers);
        setReauthError(null);
        setReauthOpen(true);
      }
    } catch {
      setWithdrawOpen(false);
      setFailReturn(null);
      setWithdrawFailOpen(true);
    } finally {
      setMethodsLoading(false);
    }
  }

  /** User-safe text for a failed re-authentication. */
  function reauthErrorText(e: unknown): string {
    if (e instanceof ApiError) {
      if (e.code === "auth.social_identity_mismatch") return t("withdrawReauth.mismatch");
      if (e.code.startsWith("auth.reauthentication_")) return t("withdrawReauth.expired");
      return errorMessage(e);
    }
    return t("withdrawReauth.failed");
  }

  function socialErrorText(code: string): string {
    if (code === "cancelled") return t("withdrawReauth.cancelled");
    if (code === "provider_unavailable") return t("withdrawReauth.providerUnavailable");
    if (code === "invalid_state") return t("withdrawReauth.expired");
    return t("withdrawReauth.failed");
  }

  async function reopenReauth(error: string | null) {
    try {
      setReauthProviders((await authApi.deletionMethods()).web_providers);
    } catch {
      /* keep what we have; the error below still explains */
    }
    setReauthError(error);
    setReauthOpen(true);
  }

  // Back from the provider (`/auth/complete` stored the outcome): finish the
  // deletion with the single-use re-authentication code, or explain why not.
  async function withdrawWithReauth(pending: PendingReauth) {
    if ("error" in pending) {
      await reopenReauth(socialErrorText(pending.error));
      return;
    }
    setReauthError(null);
    setReauthOpen(true);
    setWithdrawing(true);
    try {
      await authApi.deleteAccount(pending);
      setWithdrawing(false);
      setReauthOpen(false);
      setDoneOpen(true);
    } catch (e) {
      setWithdrawing(false);
      if (isTemporaryFailure(e)) {
        setReauthOpen(false);
        setFailReturn("reauth");
        setWithdrawFailOpen(true);
        // The code was single use; a retry needs a fresh sign-in.
        void authApi
          .deletionMethods()
          .then((m) => setReauthProviders(m.web_providers))
          .catch(() => undefined);
      } else {
        await reopenReauth(reauthErrorText(e));
      }
    }
  }

  useEffect(() => {
    if (pendingRan.current) return;
    pendingRan.current = true;
    const pending = takePendingReauth();
    if (pending) void withdrawWithReauth(pending);
    // Intentionally once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      await authApi.deleteAccount({ password });
      setWithdrawing(false);
      setPwOpen(false); // no stacking under the completion modal
      setDoneOpen(true);
    } catch (e) {
      setWithdrawing(false);
      if (isTemporaryFailure(e)) {
        // Replace the password modal with the failure modal (one interactive
        // layer). Account + session untouched; the user can retry from 확인.
        setPwOpen(false);
        setFailReturn("password");
        setWithdrawFailOpen(true);
      } else {
        setPwError(errorMessage(e)); // inline wrong-password / validation feedback
      }
    }
  }

  // 확인 on the completion modal: the single terminal action, run once.
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

  const nickname = me?.nickname ?? me?.name ?? t("home.defaultNickname");
  // MOR-001_더보기메인 (1:5582) shows 총 학습일 / "Total Study Days" here.
  const totalDays = streak.data?.total_days;
  const best = streak.data?.best;
  const current = streak.data?.current;

  // Subscription state is authoritative from /subscriptions/me — trial vs paid
  // vs none is derived from the server status, never from UI copy.
  const s = sub.data;
  const subState: "trial" | "paid" | "none" = isTrialStatus(s?.status)
    ? "trial"
    : hasLiveSubscription(s)
      ? "paid"
      : "none";
  const planName = s?.plan_name || t("more.planFallback");
  // MOR-001 prints the date in the app language, not always in Korean.
  const nextBilling = formatLongDate(s?.current_period_end, language);
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
            aria-label={t(hasUnread ? "home.notificationsUnread" : "home.notifications")}
          >
            {/* MOR-001 ic_24_bell (1:5627), the real export — same glyph as the
                Home bell but stroked Gray 7 instead of #FFD04A. Was a pair of
                hand-drawn paths at 26px with a 1.7 stroke. */}
            <img className="more__bell-ic" src={icBell} alt="" aria-hidden="true" width={24} height={24} />
            {hasUnread && <span className="more__bell-dot" aria-hidden="true" />}
          </button>
        </header>

        {/* Profile summary card */}
        <section className="more__profile">
          <div className="more__avatar" style={avatarDiscStyle(me)}>
            <ProfileAvatar me={me} />
          </div>
          <button className="more__nick" onClick={() => nav("/profile/edit")} aria-label={t("more.editProfile")}>
            <span className="more__nick-name">{nickname}</span>
            <img className="more__nick-arrow" src={icNickArrow} alt="" aria-hidden="true" />
          </button>

          <div className="more__divider" />

          <div className="more__stats">
            <div className="more__stat">
              <StatIcon kind="total" />
              <span className="more__stat-label">{t("more.totalStudyDays")}</span>
              <span className="more__stat-val">
                {totalDays != null ? t("more.daysSuffix", { n: totalDays }) : "-"}
              </span>
            </div>
            <div className="more__stat">
              <StatIcon kind="best" />
              <span className="more__stat-label">{t("more.bestStreak")}</span>
              <span className="more__stat-val">
                {best != null ? t("more.daysSuffix", { n: best }) : "-"}
              </span>
            </div>
            <div className="more__stat">
              <StatIcon kind="current" />
              <span className="more__stat-label">{t("more.currentStreak")}</span>
              <span className="more__stat-val">
                {current != null ? t("more.daysSuffix", { n: current }) : "-"}
              </span>
            </div>
          </div>
        </section>

        {/* Subscription plan card — one component, server-driven states.
            No-subscription state has TWO separate targets: the status row (→
            Subscription Management) and the 구독하기 CTA (→ plan selection). They
            are sibling buttons, so a CTA tap never triggers the row's action. */}
        <section className={`more__sub more__sub--${cardVariant}`} aria-label={t("more.myPlan")}>
          <span className="more__sub-label">{t("more.myPlan")}</span>
          {sub.isLoading ? (
            <div className="more__sub-skeleton" aria-hidden="true" />
          ) : sub.isError ? (
            <div className="more__sub-errrow" role="status">
              <span className="more__sub-empty">{t("more.subLoadError")}</span>
              <button className="more__sub-retry" onClick={() => sub.refetch()}>{t("common.retry")}</button>
            </div>
          ) : subState === "none" ? (
            <>
              <button
                className="more__sub-plan more__sub-emptyrow"
                onClick={() => nav("/subscription")}
                aria-label={t("more.noPlanA11y")}
              >
                <span className="more__sub-title-row">
                  <span className="more__sub-empty">{t("more.noPlan")}</span>
                  <img className="more__sub-chevron" src={icChevron} alt="" aria-hidden="true" />
                </span>
              </button>
              <button
                className="more__sub-cta"
                onClick={() => nav("/subscription/start")}
                aria-label={t("more.subscribeA11y")}
              >
                {t("more.subscribe")}
              </button>
            </>
          ) : (
            <button
              className="more__sub-plan"
              onClick={() => nav("/subscription")}
              aria-label={t("accountFlow.nextBillingA11y", {
                plan: planName,
                billing: nextBilling ? t("accountFlow.nextBillingSuffix", { date: nextBilling }) : "",
              })}
            >
              {subState === "trial" && (
                <span className="more__sub-ribbon">
                  <img className="more__sub-ribbon-art" src={subTrialRibbon} alt="" aria-hidden="true" />
                  <span className="more__sub-ribbon-row">
                    <img className="more__sub-ribbon-check" src={icStarCheck} alt="" aria-hidden="true" />
                    <span className="more__sub-ribbon-text">{t("more.freeTrial")}</span>
                  </span>
                </span>
              )}
              <span className="more__sub-title-row">
                <span className="more__sub-title">{planName}</span>
                <img className="more__sub-chevron" src={icChevron} alt="" aria-hidden="true" />
              </span>
              {nextBilling && (
                <span className="more__sub-billing">
                  <span>{t("more.nextBilling")}</span>
                  <span>{nextBilling}</span>
                </span>
              )}
            </button>
          )}
        </section>

        {/* Menu — plain rows, no cards/icons/chevrons */}
        <nav className="more__menu">
          {MENU.map((m) => (
            <button key={m.to} className="more__menu-row" onClick={() => nav(m.to)}>
              {t(m.label)}
            </button>
          ))}
        </nav>

        <div className="more__account-actions">
          <button className="more__muted-action" onClick={() => setWithdrawOpen(true)}>
            {t("more.withdraw")}
          </button>
          <button className="more__muted-action" onClick={() => setLogoutOpen(true)}>
            {t("more.logout")}
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
        title={t("accountFlow.logoutDoneTitle")}
        description={t("accountFlow.logoutDoneDesc")}
        onClose={finishLogout}
      />

      <WithdrawModal
        open={withdrawOpen}
        loading={methodsLoading}
        onCancel={() => setWithdrawOpen(false)}
        onConfirm={toConfirmStep}
      />

      <WithdrawReauthModal
        open={reauthOpen}
        loading={withdrawing}
        providers={reauthProviders}
        error={reauthError}
        onCancel={() => {
          if (withdrawing) return;
          setReauthOpen(false);
          setReauthError(null);
        }}
        onSelect={(provider) => void startSocialReauth(provider)}
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
        title={t("accountFlow.withdrawFailTitle")}
        description={
          <>
            {t("accountFlow.temporaryError")}
            <br />
            {t("accountFlow.tryAgainLater")}
          </>
        }
        onClose={() => {
          setWithdrawFailOpen(false);
          if (failReturn === "password") setPwOpen(true);
          else if (failReturn === "reauth") setReauthOpen(true);
        }}
      />

      {/* Logout failed (temporary). 확인 just closes → user stays signed in on More. */}
      <FailModal
        open={logoutFailOpen}
        title={t("accountFlow.logoutFailTitle")}
        description={
          <>
            {t("accountFlow.temporaryError")}
            <br />
            {t("accountFlow.tryAgainLater")}
          </>
        }
        onClose={() => setLogoutFailOpen(false)}
      />

      <SuccessModal
        open={doneOpen}
        title={t("accountFlow.withdrawDoneTitle")}
        description={
          <>
            {t("accountFlow.withdrawDoneLine1")}
            <br />
            {t("accountFlow.withdrawDoneLine2")}
          </>
        }
        onClose={finishWithdrawal}
      />
    </div>
  );
}
