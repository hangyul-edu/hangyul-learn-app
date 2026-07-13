import { useQuery } from "@tanstack/react-query";
import { Screen } from "../components/layout/Screen";
import { Badge } from "../components/ui/kit";
import { Async, EmptyState, SkeletonList } from "../components/ui/states";
import { billingApi } from "../api/endpoints";
import { formatMoney } from "../lib/format";
import type { Invoice } from "../lib/types";

const STATUS: Record<string, { l: string; tone?: "success" | "danger" }> = {
  paid: { l: "결제 완료", tone: "success" },
  open: { l: "대기 중" },
  unpaid: { l: "미결제", tone: "danger" },
  refunded: { l: "환불됨" },
  void: { l: "취소됨" },
};

export function Billing() {
  const q = useQuery({ queryKey: ["invoices"], queryFn: () => billingApi.invoices() });
  return (
    <Screen title="결제 내역" back>
      <Async loading={q.isLoading} error={q.error} data={q.data} onRetry={() => q.refetch()} isEmpty={(d) => (d.invoices?.length ?? 0) === 0} empty={<EmptyState emoji="🧾" title="결제 내역이 없어요" text="구독을 시작하면 여기에 표시돼요." />} skeleton={<SkeletonList rows={4} height={64} />}>
        {(d) => (
          <div className="stack" style={{ gap: 8 }}>
            {d.invoices.map((inv: Invoice) => {
              const st = STATUS[inv.status] ?? { l: inv.status };
              return (
                <div key={inv.invoice_id} className="card row">
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700 }}>{inv.plan_name}</div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                      {new Date(inv.period_start).toLocaleDateString("ko-KR")} ~ {new Date(inv.period_end).toLocaleDateString("ko-KR")}
                    </div>
                  </div>
                  <div className="center">
                    <div style={{ fontWeight: 800 }}>{formatMoney(inv.total.amount_cents, inv.total.currency)}</div>
                    <Badge tone={st.tone}>{st.l}</Badge>
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
