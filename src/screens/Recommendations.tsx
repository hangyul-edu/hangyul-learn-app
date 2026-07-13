import { useState } from "react";
import { Screen } from "../components/layout/Screen";
import { Button, Card } from "../components/ui/kit";
import { EmptyState } from "../components/ui/states";
import { TextField } from "../components/ui/Field";
import { recApi, sentenceApi } from "../api/endpoints";
import { useToast } from "../hooks/toast";
import { errorMessage } from "../lib/http";
import type { RecQuota, Sentence } from "../lib/types";

export function Recommendations() {
  const toast = useToast();
  const [prompt, setPrompt] = useState("");
  const [items, setItems] = useState<Sentence[] | null>(null);
  const [quota, setQuota] = useState<RecQuota | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  async function recommend() {
    setBusy(true);
    try {
      const res = await recApi.sentences(prompt.trim() ? { prompt: prompt.trim() } : {});
      setItems(res.items);
      setQuota(res.quota ?? null);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function play(id: string) {
    try {
      const { url } = await sentenceApi.audio(id);
      await new Audio(url).play();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }
  async function save(s: Sentence) {
    const on = saved[s.sentence_id];
    setSaved((m) => ({ ...m, [s.sentence_id]: !on }));
    try {
      if (on) await sentenceApi.unbookmark(s.sentence_id);
      else await sentenceApi.bookmark(s.sentence_id);
    } catch (e) {
      setSaved((m) => ({ ...m, [s.sentence_id]: on }));
      toast.error(errorMessage(e));
    }
  }

  return (
    <Screen title="AI 추천 문장" nav>
      <Card variant="soft" style={{ marginBottom: 16 }}>
        <div className="field__label" style={{ marginBottom: 8 }}>어떤 상황의 문장이 필요하세요?</div>
        <div style={{ display: "flex", gap: 8 }}>
          <TextField placeholder="예: 카페에서 주문하기 (선택)" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
          <Button style={{ height: 50, whiteSpace: "nowrap" }} loading={busy} onClick={recommend}>추천</Button>
        </div>
        {quota?.remaining_today != null && (
          <div className="dim" style={{ fontSize: 12, marginTop: 8 }}>오늘 남은 추천: {quota.remaining_today}회</div>
        )}
      </Card>

      {items === null ? (
        <EmptyState emoji="✨" title="맞춤 문장을 추천해드려요" text="원하는 상황을 입력하거나 그냥 추천 버튼을 눌러보세요." />
      ) : items.length === 0 ? (
        <EmptyState emoji="🤔" title="추천 결과가 없어요" text="다른 상황으로 다시 시도해 보세요." />
      ) : (
        <div className="stack" style={{ gap: 10 }}>
          {items.map((s) => (
            <Card key={s.sentence_id}>
              <div className="row row--between">
                <div style={{ flex: 1 }}>
                  <div className="hangul-lg" style={{ fontSize: 18 }}>{s.korean}</div>
                  {s.romanization && <div className="dim" style={{ fontSize: 13, marginTop: 2 }}>{s.romanization}</div>}
                  <div className="muted" style={{ fontSize: 13, marginTop: 3 }}>{s.translation}</div>
                </div>
                <div className="stack" style={{ gap: 6 }}>
                  <button className="topbar__btn" onClick={() => play(s.sentence_id)}>🔊</button>
                  <button className="topbar__btn" onClick={() => save(s)}>{saved[s.sentence_id] ? "🔖" : "📑"}</button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </Screen>
  );
}
