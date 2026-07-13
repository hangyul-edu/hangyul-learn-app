import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { http } from "../../lib/http";

const TABS = [
  { to: "/home", icon: "🏠", label: "홈" },
  { to: "/learn", icon: "📚", label: "학습" },
  { to: "/league", icon: "🏆", label: "리그" },
  { to: "/social", icon: "👥", label: "친구" },
  { to: "/profile", icon: "🙂", label: "내 정보" },
];

export function AppShell() {
  const nav = useNavigate();
  const loc = useLocation();

  // Small unread badge on the profile/home tab area — polled lightly.
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
        {TABS.map((t) => (
          <button
            key={t.to}
            className={`bottomnav__item ${active(t.to) ? "is-active" : ""}`}
            onClick={() => nav(t.to)}
          >
            <span className="bottomnav__icon">{t.icon}</span>
            {t.label}
            {t.to === "/profile" && unread?.has_unread && <span className="bottomnav__badge" />}
          </button>
        ))}
      </nav>
    </>
  );
}
