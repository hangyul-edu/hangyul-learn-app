import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { SkeletonList } from "../components/ui/states";
import { notifApi } from "../api/endpoints";
import { GROUP_LABEL_KEYS, bucketKey, bucketLabel, relativeTime } from "../lib/notifications";
import { useTranslation, type TranslationKey } from "../i18n";
import type { NotificationGroup, NotificationItem } from "../lib/types";
import { DetailHeader } from "../components/DetailHeader";

/* -------------------------------- config -------------------------------- */
type Filter = "all" | NotificationGroup;
const FILTERS: { v: Filter; l: TranslationKey; dot: string | null }[] = [
  { v: "all", l: "notifications.all", dot: null },
  { v: "learning", l: "notifications.learning", dot: "#f6c945" }, // yellow
  { v: "announcement", l: "notifications.notice", dot: "#a8e0b0" }, // pale green
  { v: "social", l: "notifications.social", dot: "#c9c2ef" }, // pale lavender
];
/* Badge fills/inks straight from cp_list_not (766:48573 / 48613 / 48657). */
const BADGE_BG: Record<NotificationGroup, string> = {
  learning: "#ffc420",
  announcement: "#e9f3dd",
  social: "#edecff",
};
const BADGE_FG: Record<NotificationGroup, string> = {
  learning: "#876300",
  announcement: "#133b07",
  social: "#0f0216",
};

function dedupe(list: NotificationItem[]): NotificationItem[] {
  const seen = new Set<string>();
  const out: NotificationItem[] = [];
  for (const n of list) {
    if (!seen.has(n.notification_id)) {
      seen.add(n.notification_id);
      out.push(n);
    }
  }
  return out;
}


// Pending "mark all read on leave" timer, coordinated at module scope so a
// StrictMode remount can cancel the fake-unmount's scheduled read-all.
let leaveReadAllTimer: ReturnType<typeof setTimeout> | null = null;

/* -------------------------------- screen -------------------------------- */
export function Notifications() {
  const { t } = useTranslation();
  const loc = useLocation();
  const qc = useQueryClient();
  const entry = (loc.state as { filter?: Filter } | null) ?? null;

  const [filter, setFilter] = useState<Filter>(entry?.filter ?? "all");
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [more, setMore] = useState<"idle" | "loading" | "error" | "done">("idle");
  const [reloadTick, setReloadTick] = useState(0);

  const seqRef = useRef(0);
  const moreLoadingRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);

  async function fetchPage(cur?: string) {
    const page = await notifApi.list({ group: filter === "all" ? undefined : filter, cursor: cur });
    const flat = (page.sections ?? []).flatMap((s) => s.items);
    return { items: (flat.length ? flat : page.items ?? []) as NotificationItem[], next: page.next_cursor ?? null };
  }

  // Reload page 1 on filter change / retry. Guards against stale responses so a
  // slow request for an old filter can never overwrite the current one.
  useEffect(() => {
    const mySeq = ++seqRef.current;
    setStatus("loading");
    setItems([]);
    setCursor(null);
    setMore("idle");
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    (async () => {
      try {
        const page = await fetchPage(undefined);
        if (mySeq !== seqRef.current) return;
        setItems(dedupe(page.items));
        setCursor(page.next);
        setMore(page.next ? "idle" : "done");
        setStatus("ready");
      } catch {
        if (mySeq === seqRef.current) setStatus("error");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, reloadTick]);

  async function loadMore() {
    if (moreLoadingRef.current || cursor == null) return;
    moreLoadingRef.current = true;
    const mySeq = seqRef.current;
    setMore("loading");
    try {
      const page = await fetchPage(cursor);
      if (mySeq !== seqRef.current) return;
      setItems((prev) => dedupe([...prev, ...page.items])); // append + dedupe by id
      setCursor(page.next);
      setMore(page.next ? "idle" : "done");
    } catch {
      if (mySeq === seqRef.current) setMore("error"); // keep existing items visible
    } finally {
      moreLoadingRef.current = false;
    }
  }

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const ob = new IntersectionObserver(
      (e) => { if (e[0].isIntersecting && more === "idle") void loadMore(); },
      { root: scrollRef.current, rootMargin: "300px" },
    );
    ob.observe(el);
    return () => ob.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [more, cursor, items.length]);

  // Mark everything read when the user LEAVES the page — NOT on enter — so the
  // unread highlight stays visible for the whole visit (product policy: there is
  // no per-item read). Scheduling via a module-level timer makes this safe under
  // React StrictMode's dev-only mount→unmount→mount double-invoke: the fake
  // unmount schedules the read-all, the immediate remount CANCELS it, so the
  // server is only marked read on a genuine leave. Otherwise the remount would
  // re-fetch the list as already-read and wipe the highlight.
  useEffect(() => {
    if (leaveReadAllTimer !== null) {
      clearTimeout(leaveReadAllTimer);
      leaveReadAllTimer = null;
    }
    return () => {
      leaveReadAllTimer = setTimeout(() => {
        leaveReadAllTimer = null;
        qc.setQueryData(["notif-unread"], { has_unread: false }); // clear bell dot
        notifApi
          .readAll()
          .catch(() => {
            /* best-effort */
          })
          .finally(() => qc.invalidateQueries({ queryKey: ["notif-unread"] }));
      }, 0);
    };
  }, [qc]);

  // Group the loaded (server-ordered, newest-first) items into date buckets,
  // recomputed only when the item list changes.
  const groups = useMemo(() => {
    const now = new Date();
    const out: { key: string; label: string; items: NotificationItem[] }[] = [];
    for (const n of items) {
      const key = bucketKey(n.created_at, now);
      const last = out[out.length - 1];
      if (last && last.key === key) last.items.push(n);
      else out.push({ key, label: bucketLabel(n.created_at, t, now), items: [n] });
    }
    return out;
  }, [items]);

  const filtered = filter !== "all";
  const emptyTitle = t(filtered ? "notifications.emptyFiltered" : "notifications.emptyAll");

  return (
    <div className="screen ntf">
      <DetailHeader title={t("notifications.title")} />

      <div className="ntf__filters" role="tablist" aria-label={t("notifications.categoriesA11y")}>
        {FILTERS.map((f) => {
          const active = filter === f.v;
          return (
            <button
              key={f.v}
              role="tab"
              aria-selected={active}
              aria-label={t("notifications.filterA11y", { name: t(f.l) })}
              className={`ntf__chip ${active ? "is-active" : ""}`}
              onClick={() => filter !== f.v && setFilter(f.v)}
            >
              {!active && f.dot && (
                <span className="ntf__chip-dot" style={{ background: f.dot }} aria-hidden="true" />
              )}
              {t(f.l)}
            </button>
          );
        })}
      </div>

      <div className="ntf__scroll" ref={scrollRef}>
        {status === "loading" ? (
          <div className="ntf__pad"><SkeletonList rows={5} height={84} /></div>
        ) : status === "error" ? (
          <div className="ntf__state">
            <span>{t("notifications.loadError")}</span>
            <button className="ntf__retry" onClick={() => setReloadTick((n) => n + 1)}>{t("common.retry")}</button>
          </div>
        ) : items.length === 0 ? (
          <div className="ntf__empty">
            <p className="ntf__empty-title">{emptyTitle}</p>
          </div>
        ) : (
          <div className="ntf__list">
            {groups.map((g) => (
              <section className="ntf__group" key={g.key} aria-label={g.label}>
                <h2 className="ntf__date">{g.label}</h2>
                <ul className="ntf__cards" role="list">
                  {g.items.map((n) => (
                    <li key={n.notification_id}>
                      {/* Informational only — non-interactive (no tap, no navigation). */}
                      <div
                        className={`ntf__card ${n.read ? "is-read" : "is-unread"}`}
                        role="article"
                        aria-label={t("notifications.cardA11y", {
                          newFlag: n.read ? "" : t("notifications.newPrefix"),
                          group: t(GROUP_LABEL_KEYS[n.group]),
                          readState: t(n.read ? "notifications.read" : "notifications.unread"),
                          title: n.title,
                          body: n.body ?? "",
                          time: relativeTime(n.created_at, t),
                        })}
                      >
                        <div className="ntf__card-top">
                          <span className="ntf__badge" style={{ background: BADGE_BG[n.group], color: BADGE_FG[n.group] }}>
                            {t(GROUP_LABEL_KEYS[n.group])}
                          </span>
                          <span className="ntf__time">{relativeTime(n.created_at, t)}</span>
                        </div>
                        <div className="ntf__card-text">
                          <div className="ntf__card-title">{n.title}</div>
                          {n.body && <div className="ntf__card-body">{n.body}</div>}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            <div className="ntf__foot" ref={sentinel}>
              {more === "loading" ? (
                <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
              ) : more === "error" ? (
                <button className="ntf__retry" onClick={() => { setMore("idle"); void loadMore(); }}>{t("notifications.loadMore")}</button>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
