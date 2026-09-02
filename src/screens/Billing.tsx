import { useQuery } from "@tanstack/react-query";
import { useTranslation, type TranslationKey } from "../i18n";
import { Screen } from "../components/layout/Screen";
import { Badge } from "../components/ui/kit";
import { Async, EmptyState, SkeletonList } from "../components/ui/states";
import { billingApi } from "../api/endpoints";
import { formatMoney, localeFor } from "../lib/format";
import type { Invoice } from "../lib/types";

const STATUS: Record<string, { l: TranslationKey; tone?: "success" | "danger" }> = {
  paid: { l: "billing.paid", tone: "success" },
  open: { l: "billing.pending" },
  unpaid: { l: "billing.unpaid", tone: "danger" },
  refunded: { l: "billing.refunded" },
  void: { l: "billing.cancelled" },
};

export function Billing() {
  const { t, language } = useTranslation();
  const q = useQuery({ queryKey: ["invoices"], queryFn: () => billingApi.invoices() });
  return (
    <Screen title={t("billing.title")} back>
      <Async loading={q.isLoading} error={q.error} data={q.data} onRetry={() => q.refetch()} isEmpty={(d) => (d.invoices?.length ?? 0) === 0} empty={<EmptyState emoji="🧾" title={t("billing.empty")} text={t("billing.emptyDesc")} />} skeleton={<SkeletonList rows={4} height={64} />}>
        {(d) => (
          <div className="stack" style={{ gap: 8 }}>
            {d.invoices.map((inv: Invoice) => {
              const st = STATUS[inv.status];
              return (
                <div key={inv.invoice_id} className="card row">
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700 }}>{inv.plan_name}</div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                      {/* Billing dates follow the app language, not always Korean. */}
                      {new Date(inv.period_start).toLocaleDateString(localeFor(language))} ~ {new Date(inv.period_end).toLocaleDateString(localeFor(language))}
                    </div>
                  </div>
                  <div className="center">
                    <div style={{ fontWeight: 800 }}>{formatMoney(inv.total.amount_cents, inv.total.currency)}</div>
                    {/* The label is a catalog key — it has to go through t(). */}
                    <Badge tone={st?.tone}>{st ? t(st.l) : inv.status}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Async>
    </Screen>
  );
}
