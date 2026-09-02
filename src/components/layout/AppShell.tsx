import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { NavHome, NavLecture, NavFlag, NavMedal, NavMore } from "../brand/HomeIcons";
import { useTranslation, type TranslationKey } from "../../i18n";

/**
 * Bottom tab bar — Figma `navi_user` (KO 1825:26629 / EN 1825:28553).
 *
 * Five equal 75px cells across the 375pt frame; the label sits 3px under a 24px
 * icon. Label type is Caption 4 in Korean but a step smaller in English, where
 * the words are longer — `.bottomnav` reads that off the document language.
 */
type TabId = "home" | "lecture" | "personalized" | "league" | "more";
const TABS: { id: TabId; to: string; label: TranslationKey; icon: (a: boolean) => JSX.Element }[] = [
  { id: "home", to: "/home", label: "nav.home", icon: (a) => <NavHome active={a} /> },
  { id: "lecture", to: "/courses", label: "nav.classes", icon: (a) => <NavLecture active={a} /> },
  { id: "personalized", to: "/recommend", label: "nav.practice", icon: (a) => <NavFlag active={a} /> },
  { id: "league", to: "/league", label: "nav.league", icon: (a) => <NavMedal active={a} /> },
  { id: "more", to: "/profile", label: "nav.more", icon: (a) => <NavMore active={a} /> },
];

export function AppShell() {
  const nav = useNavigate();
  const loc = useLocation();
  const { t } = useTranslation();

  const active = (to: string) => loc.pathname === to || loc.pathname.startsWith(to + "/");

  return (
    <>
      <Outlet />
      <nav className="bottomnav">
        {TABS.map((tab) => {
          const on = active(tab.to);
          return (
            <button
              key={tab.id}
              className={`bottomnav__item ${on ? "is-active" : ""}`}
              onClick={() => nav(tab.to)}
              aria-current={on ? "page" : undefined}
            >
              <span className="bottomnav__icon">{tab.icon(on)}</span>
              {t(tab.label)}
            </button>
          );
        })}
      </nav>
    </>
  );
}
