import { useMemo, useRef } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { billingApi } from "../../api/endpoints";
import { SkeletonList } from "../../components/ui/states";
import { Spinner } from "../../components/ui/Spinner";
import { useLoadMoreSentinel } from "../../hooks/useLoadMoreSentinel";
import { useTranslation } from "../../i18n";
import { uniqueBy } from "../../lib/collections";
import { formatLongDate, formatMoney, formatYmd } from "../../lib/format";

/** 결제 정보: the payment history, cursor-paged as it scrolls (the cool-gray
 * region to the bottom). */
export function InvoiceList() {
  const { t, language } = useTranslation();
  /** Bound to the active language so dates re-render when it changes. */
  const longDate = (iso?: string | null) => formatLongDate(iso, language);
  const inv = useInfiniteQuery({
    queryKey: ["invoices-inf"],
    queryFn: ({ pageParam }) => billingApi.invoices(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });
  const rows = useMemo(
    () => uniqueBy((inv.data?.pages ?? []).flatMap((page) => page.invoices ?? []), (it) => it.invoice_id),
    [inv.data],
  );

  // Load the next page when the sentinel nears the viewport (single flight).
  const sentinel = useRef<HTMLDivElement>(null);
  useLoadMoreSentinel(
    sentinel,
    { enabled: !!inv.hasNextPage && !inv.isFetchingNextPage, onHit: () => void inv.fetchNextPage(), rootMargin: "240px" },
    [inv.hasNextPage, inv.isFetchingNextPage],
  );

  return (
    <div className="subm__pay">
      <h2 className="subm__h">{t("subscription.billingHeading")}</h2>

      {inv.isLoading ? (
        <SkeletonList rows={4} height={58} />
      ) : inv.isError && rows.length === 0 ? (
        <div className="subm__err">
          <span>{t("subscription.billingLoadError")}</span>
          <button className="subm__retry" onClick={() => inv.refetch()}>{t("common.retry")}</button>
        </div>
      ) : rows.length === 0 ? (
        <p className="subm__empty-pay">{t("subscription.noBilling")}</p>
      ) : (
        <>
          {/* 624:9871 — the date/description pair sits in its own group, 71
              from the amount, mirroring the row layout below. */}
          <div className="subm__thead" role="row" aria-hidden="true">
            <span className="subm__thgroup">
              <span className="subm__th">{t("subscription.colDate")}</span>
              <span className="subm__th subm__th--desc">{t("subscription.colDescription")}</span>
            </span>
            <span className="subm__th subm__th--amt">{t("subscription.colAmount")}</span>
          </div>
          <ul className="subm__plist" role="list">
            {rows.map((r) => (
              <li
                key={r.invoice_id}
                className="subm__prow"
                aria-label={t("subscription.invoiceA11y", {
                  date: longDate(r.paid_at ?? r.period_start),
                  plan: r.plan_name,
                  from: longDate(r.period_start),
                  to: longDate(r.period_end),
                  amount: formatMoney(r.total.amount_cents, r.total.currency),
                })}
              >
                {/* 624:9876 — date + description are one group 19 apart; the
                    amount trails it by 66, not flushed to the right edge. */}
                <div className="subm__pmain">
                  <span className="subm__pdate">{formatYmd(r.paid_at ?? r.period_start, "/", { shortYear: true })}</span>
                  <div className="subm__pdesc">
                    <div className="subm__pname">{r.plan_name}</div>
                    <div className="subm__pperiod">
                      {formatYmd(r.period_start, "/")}
                      <br />- {formatYmd(r.period_end, "/")}
                    </div>
                  </div>
                </div>
                <span className="subm__pamt">{formatMoney(r.total.amount_cents, r.total.currency)}</span>
              </li>
            ))}
          </ul>

          <div className="subm__foot" ref={sentinel}>
            {inv.isFetchingNextPage ? (
              <Spinner size={22} stroke={2.5} />
            ) : inv.isFetchNextPageError ? (
              <button className="subm__retry" onClick={() => inv.fetchNextPage()}>{t("subscription.loadMore")}</button>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
