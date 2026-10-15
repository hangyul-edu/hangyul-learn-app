import { useCallback, useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "../i18n";
import { useMutation, useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { supportApi } from "../api/endpoints";
import { useNoticesCopy } from "../lib/noticeCopy";
import { formatNoticeDetailDate } from "../lib/format";
import { ApiError, errorMessage } from "../lib/http";
import { Markdown } from "../lib/markdown";
import { Button } from "../components/ui/kit";
import { ErrorState } from "../components/ui/states";
import type { Notice, NoticeSummary } from "../lib/types";
import { BackChevronIcon } from "../components/brand/Glyphs";

type NoticesPage = { items: NoticeSummary[]; next_cursor: string | null };

export function NoticeDetail() {
  const { noticeId = "" } = useParams();
  const nav = useNavigate();
  const loc = useLocation();
  const qc = useQueryClient();
  // Notice bodies are server-localized, so the request language must be the
  // language the chrome is rendering in — that is the i18n layer's, which the
  // profile only seeds.
  const { language: lang } = useTranslation();
  const copy = useNoticesCopy();

  // Temporary placeholder metadata (title/date) from the list cache, shown only
  // while the full detail request is in flight — the body still comes from the
  // detail API (it may be omitted from list summaries in the future).
  const placeholderSummary = useMemo(() => {
    const lists = qc.getQueriesData<InfiniteData<NoticesPage>>({ queryKey: ["notices"] });
    for (const [, data] of lists) {
      for (const page of data?.pages ?? []) {
        const hit = page.items.find((n) => n.notice_id === noticeId);
        if (hit) return hit;
      }
    }
    return undefined;
  }, [qc, noticeId]);

  const detail = useQuery({
    queryKey: ["notice", noticeId, lang],
    queryFn: () => supportApi.notice(noticeId, lang),
    enabled: !!noticeId,
    // Temporary metadata (title/date) from the list cache while the body loads.
    placeholderData: placeholderSummary ? { ...placeholderSummary, body: "" } : undefined,
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 2,
  });

  // Mark the notice read once its detail successfully opens (and it was still
  // new). On success, immediately clear `is_new` in the cached list + detail so
  // the badge/highlight disappear right away, then reconcile with the server.
  const markRead = useMutation({
    mutationFn: (id: string) => supportApi.markNoticeRead(id),
    onSuccess: (_res, id) => {
      qc.setQueriesData<InfiniteData<NoticesPage>>({ queryKey: ["notices"] }, (old) =>
        old
          ? {
              ...old,
              pages: old.pages.map((p) => ({
                ...p,
                items: p.items.map((n) => (n.notice_id === id ? { ...n, is_new: false } : n)),
              })),
            }
          : old,
      );
      qc.setQueryData<Notice>(["notice", id, lang], (old) => (old ? { ...old, is_new: false } : old));
      qc.invalidateQueries({ queryKey: ["notices"] });
    },
  });

  const markedRef = useRef<string | null>(null);
  useEffect(() => {
    // Record the read as soon as the REAL detail (not the placeholder) has
    // loaded successfully. Deliberately NOT gated on `is_new`: a successful
    // view always records a read, so the flag reliably flips off regardless of
    // the client-side `is_new` value. The call is idempotent server-side, and
    // `markedRef` prevents duplicate calls within a mount / on rapid re-renders.
    if (detail.data && !detail.isPlaceholderData && markedRef.current !== noticeId) {
      markedRef.current = noticeId;
      markRead.mutate(noticeId);
    }
  }, [detail.data, detail.isPlaceholderData, noticeId, markRead]);

  const goToList = useCallback(() => nav("/more/notices"), [nav]);
  const goBack = useCallback(() => {
    // Deep link / refresh (no in-app history) → fall back to the list.
    if (loc.key === "default") goToList();
    else nav(-1);
  }, [loc.key, nav, goToList]);

  const notFound =
    !noticeId || (detail.error instanceof ApiError && detail.error.status === 404);
  const data = detail.data;
  const showBodySkeleton = detail.isLoading || detail.isPlaceholderData;

  return (
    <div className="ntc ntc--detail">
      <header className="ntc__dheader">
        <button className="ntc__back" onClick={goBack} aria-label={copy.back}>
          <BackChevronIcon size={27} />
        </button>
      </header>

      <div className="ntc__scroll">
        <div className="ntc__detail">
          {notFound ? (
            <div className="ntc__state">
              <EmptyNotFound
                title={copy.notFoundTitle}
                body={copy.notFoundBody}
                actionLabel={copy.backToList}
                onAction={goToList}
              />
            </div>
          ) : detail.isError ? (
            <div className="ntc__state">
              <ErrorState message={errorMessage(detail.error)} onRetry={() => detail.refetch()} />
            </div>
          ) : (
            <>
              {/* Metadata header */}
              {data ? (
                <>
                  <h1 className="ntc__detail-title">{data.title}</h1>
                  <div className="ntc__detail-date">{formatNoticeDetailDate(data.published_at)}</div>
                </>
              ) : (
                <>
                  <div className="skeleton" style={{ height: 28, width: "80%", borderRadius: 8 }} />
                  <div className="skeleton" style={{ height: 16, width: "34%", borderRadius: 6, marginTop: 12 }} />
                </>
              )}

              <div className="ntc__detail-divider" />

              {/* Body */}
              {data && !showBodySkeleton ? (
                <Markdown text={data.body} className="ntc__body" />
              ) : (
                <div className="ntc__body-skeleton" aria-hidden="true">
                  {[92, 80, 96, 70, 88, 60].map((w, i) => (
                    <div
                      key={i}
                      className="skeleton"
                      style={{ height: 15, width: `${w}%`, borderRadius: 6, marginBottom: 12 }}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyNotFound({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="state">
      <div className="state__emoji">🗒️</div>
      <div className="state__title">{title}</div>
      <div className="state__text">{body}</div>
      <Button variant="secondary" size="sm" onClick={onAction}>
        {actionLabel}
      </Button>
    </div>
  );
}
