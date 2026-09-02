import { useState } from "react";
import { useTranslation } from "../i18n";
import { Screen } from "../components/layout/Screen";
import { Button, Card } from "../components/ui/kit";
import { EmptyState } from "../components/ui/states";
import { TextField } from "../components/ui/Field";
import { recApi, sentenceApi } from "../api/endpoints";
import { useToast } from "../hooks/toast";
import { errorMessage } from "../lib/http";
import type { RecQuota, Sentence } from "../lib/types";

export function Recommendations() {
  const { t } = useTranslation();
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
    <Screen title={t("recommend.title")} back>
      <Card variant="soft" style={{ marginBottom: 16 }}>
        <div className="field__label" style={{ marginBottom: 8 }}>{t("recommend.prompt")}</div>
        <div style={{ display: "flex", gap: 8 }}>
          <TextField placeholder={t("recommend.placeholder")} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
          <Button style={{ height: 50, whiteSpace: "nowrap" }} loading={busy} onClick={recommend}>{t("recommend.cta")}</Button>
        </div>
        {quota?.remaining_today != null && (
          <div className="dim" style={{ fontSize: 12, marginTop: 8 }}>{t("courses.quotaRemaining", { n: quota.remaining_today })}</div>
        )}
      </Card>

      {items === null ? (
        <EmptyState emoji="✨" title={t("recommend.heading")} text={t("recommend.hint")} />
      ) : items.length === 0 ? (
        <EmptyState emoji="🤔" title={t("recommend.empty")} text={t("recommend.emptyDesc")} />
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
