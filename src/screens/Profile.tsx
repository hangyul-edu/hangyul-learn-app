import { useNavigate } from "react-router-dom";
import icBell from "../assets/brand/ic-24-bell-dark.svg";
import { useAuth } from "../hooks/auth";
import { useTranslation, type TranslationKey } from "../i18n";
import { useUnreadNotifications } from "../api/queries";
import { AccountFlowModals } from "./profile/AccountFlowModals";
import { PlanCard } from "./profile/PlanCard";
import { ProfileSummary } from "./profile/ProfileSummary";
import { useLogoutFlow } from "./profile/useLogoutFlow";
import { useWithdrawFlow } from "./profile/useWithdrawFlow";

/**
 * More menu — Figma MOR-005, English frame 893:33108.
 *
 * The English frame is the current one: its eight entries and their order match
 * the routes the app ships. The Korean frame (1:5697) is stale, listing nine
 * entries including ones for features the app does not have, so it is not
 * used for structure.
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

export function Profile() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { me } = useAuth();
  const logout = useLogoutFlow();
  const withdraw = useWithdrawFlow();
  const hasUnread = !!useUnreadNotifications().data?.has_unread;

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

        <ProfileSummary me={me} />

        <PlanCard />

        {/* Menu — plain rows, no cards/icons/chevrons */}
        <nav className="more__menu">
          {MENU.map((m) => (
            <button key={m.to} className="more__menu-row" onClick={() => nav(m.to)}>
              {t(m.label)}
            </button>
          ))}
        </nav>

        <div className="more__account-actions">
          <button className="more__muted-action" onClick={withdraw.open}>
            {t("more.withdraw")}
          </button>
          <button className="more__muted-action" onClick={logout.open}>
            {t("more.logout")}
          </button>
        </div>
      </div>

      <AccountFlowModals logout={logout} withdraw={withdraw} />
    </div>
  );
}
