import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { http } from "../../lib/http";
import { NavHome, NavLecture, NavFlag, NavMedal, NavMore } from "../brand/HomeIcons";

type TabId = "home" | "lecture" | "personalized" | "league" | "more";
const TABS: { id: TabId; to: string; label: string; icon: (a: boolean) => JSX.Element }[] = [
  { id: "home", to: "/home", label: "홈", icon: (a) => <NavHome active={a} /> },
  { id: "lecture", to: "/courses", label: "강의", icon: (a) => <NavLecture active={a} /> },
  { id: "personalized", to: "/recommend", label: "맞춤 학습", icon: (a) => <NavFlag active={a} /> },
  { id: "league", to: "/league", label: "리그", icon: (a) => <NavMedal active={a} /> },
  { id: "more", to: "/profile", label: "더보기", icon: (a) => <NavMore active={a} /> },
];

export function AppShell() {
  const nav = useNavigate();
  const loc = useLocation();

  const { data: unread } = useQuery({
    queryKey: ["notif-unread"],
    queryFn: () => http.get<{ has_unread: boolean }>("/notifications/unread"),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const active = (to: string) => loc.pathname === to || loc.pathname.startsWith(to + "/");

  return (
    <>
      <Outlet />
      <nav className="bottomnav">
        {TABS.map((t) => {
          const on = active(t.to);
          return (
            <button
              key={t.id}
              className={`bottomnav__item ${on ? "is-active" : ""}`}
              onClick={() => nav(t.to)}
              aria-current={on ? "page" : undefined}
            >
              <span className="bottomnav__icon">{t.icon(on)}</span>
              {t.label}
              {t.id === "more" && unread?.has_unread && <span className="bottomnav__badge" />}
            </button>
          );
        })}
      </nav>
    </>
  );
}
