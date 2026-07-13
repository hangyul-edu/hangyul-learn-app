import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Screen } from "../components/layout/Screen";
import { Badge, Button, Card } from "../components/ui/kit";
import { ConfirmDialog, Sheet } from "../components/ui/Modal";
import { TextField } from "../components/ui/Field";
import { Async, EmptyState, SkeletonList } from "../components/ui/states";
import { payApi } from "../api/endpoints";
import { useToast } from "../hooks/toast";
import { errorMessage } from "../lib/http";
import type { PaymentMethod } from "../lib/types";

export function PaymentMethods() {
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["payment-methods"], queryFn: payApi.methods });
  const [addOpen, setAddOpen] = useState(false);
  const [intentUrl, setIntentUrl] = useState<string | null>(null);
  const [intentId, setIntentId] = useState<string | null>(null);
  const [authKey, setAuthKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ["payment-methods"] });

  async function startAdd() {
    setBusy(true);
    try {
      const res = await payApi.cardIntent(window.location.origin + "/account/payment");
      setIntentId(res.intent_id);
      setIntentUrl(res.widget.success_url);
      setAuthKey("");
      setAddOpen(true);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function confirmAdd() {
    if (!intentId || !authKey.trim()) return;
    setBusy(true);
    try {
      await payApi.cardConfirm(intentId, authKey.trim());
      toast.success("카드를 등록했어요");
      setAddOpen(false);
      refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title="결제 수단" back right={<button className="input-affix__btn" style={{ position: "static" }} onClick={startAdd}>＋ 추가</button>}>
      <Async loading={q.isLoading} error={q.error} data={q.data} onRetry={() => q.refetch()} isEmpty={(d) => (d.methods?.length ?? 0) === 0} empty={<EmptyState emoji="💳" title="등록된 카드가 없어요" text="구독 결제를 위한 카드를 추가해 보세요." action={<Button size="sm" loading={busy} onClick={startAdd}>카드 추가</Button>} />} skeleton={<SkeletonList rows={2} height={72} />}>
        {(d) => (
          <div className="stack" style={{ gap: 10 }}>
            {d.methods.map((m: PaymentMethod) => (
              <Card key={m.method_id} className="row">
                <div style={{ width: 44, height: 30, borderRadius: 6, background: "var(--ink)", color: "#fff", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 800 }}>
                  {(m.brand ?? "CARD").slice(0, 4).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{m.display_name || m.masked_card_number || "카드"}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{m.issuer ?? m.provider}{m.last_four ? ` · **** ${m.last_four}` : ""}</div>
                </div>
                {m.is_default ? (
                  <Badge tone="brand">기본</Badge>
                ) : (
                  <Button size="sm" variant="ghost" onClick={async () => { try { await payApi.setDefault(m.method_id); refresh(); } catch (e) { toast.error(errorMessage(e)); } }}>기본으로</Button>
                )}
                <button className="topbar__btn" onClick={() => setRemoveId(m.method_id)}>🗑️</button>
              </Card>
            ))}
          </div>
        )}
      </Async>

      <Sheet open={addOpen} onClose={() => !busy && setAddOpen(false)} title="카드 등록">
        <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
          결제창에서 카드 정보를 입력한 뒤 발급되는 인증키(authKey)를 붙여넣어 등록을 완료해요.
        </p>
        {intentUrl && (
          <a className="btn btn--secondary btn--block" href={intentUrl} target="_blank" rel="noreferrer" style={{ marginBottom: 12 }}>
            결제창 열기 ↗
          </a>
        )}
        <TextField label="인증키 (authKey)" placeholder="결제창에서 발급된 키" value={authKey} onChange={(e) => setAuthKey(e.target.value)} />
        <div style={{ height: 12 }} />
        <Button block loading={busy} disabled={!authKey.trim()} onClick={confirmAdd}>등록 완료</Button>
      </Sheet>

      <ConfirmDialog open={!!removeId} emoji="🗑️" title="카드를 삭제할까요?" danger confirmLabel="삭제" loading={busy}
        onCancel={() => setRemoveId(null)}
        onConfirm={async () => { setBusy(true); try { await payApi.remove(removeId!); refresh(); setRemoveId(null); } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); } }}
      />
    </Screen>
  );
}
