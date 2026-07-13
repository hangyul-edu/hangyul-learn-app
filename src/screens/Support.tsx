import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Screen } from "../components/layout/Screen";
import { Segmented } from "../components/ui/kit";
import { Async, EmptyState, SkeletonList } from "../components/ui/states";
import { TextField } from "../components/ui/Field";
import { supportApi } from "../api/endpoints";
import { timeAgo } from "../lib/format";

export function Support() {
  const [tab, setTab] = useState<"faq" | "notice">("faq");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const faqs = useQuery({ queryKey: ["faqs", q], queryFn: () => supportApi.faqs({ q: q.trim() || undefined }), enabled: tab === "faq" });
  const notices = useQuery({ queryKey: ["notices"], queryFn: () => supportApi.notices(), enabled: tab === "notice" });

  return (
    <Screen title="고객센터" back>
      <div style={{ marginBottom: 14 }}>
        <Segmented value={tab} onChange={setTab} options={[{ value: "faq", label: "자주 묻는 질문" }, { value: "notice", label: "공지사항" }]} />
      </div>

      {tab === "faq" && (
        <>
          <div style={{ marginBottom: 12 }}>
            <TextField placeholder="🔍 궁금한 점을 검색하세요" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Async loading={faqs.isLoading} error={faqs.error} data={faqs.data} onRetry={() => faqs.refetch()} isEmpty={(d) => d.items.length === 0} empty={<EmptyState emoji="💭" title="검색 결과가 없어요" text="다른 검색어를 입력해 보세요." />} skeleton={<SkeletonList rows={6} height={56} />}>
            {(d) => (
              <div className="stack" style={{ gap: 8 }}>
                {d.items.map((f) => (
                  <div key={f.faq_id} className="card" onClick={() => setOpenId(openId === f.faq_id ? null : f.faq_id)} style={{ cursor: "pointer" }}>
                    <div className="row row--between">
                      <span style={{ fontWeight: 700, fontSize: 14.5, flex: 1 }}>{f.question}</span>
                      <span className="listrow__chev">{openId === f.faq_id ? "⌄" : "›"}</span>
                    </div>
                    {openId === f.faq_id && <div className="muted" style={{ fontSize: 13.5, lineHeight: 1.6, marginTop: 10, whiteSpace: "pre-wrap" }}>{f.answer}</div>}
                  </div>
                ))}
              </div>
            )}
          </Async>
        </>
      )}

      {tab === "notice" && (
        <Async loading={notices.isLoading} error={notices.error} data={notices.data} onRetry={() => notices.refetch()} isEmpty={(d) => d.items.length === 0} empty={<EmptyState emoji="📢" title="공지사항이 없어요" />} skeleton={<SkeletonList rows={5} />}>
          {(d) => (
            <div className="stack" style={{ gap: 8 }}>
              {d.items.map((n) => (
                <div key={n.notice_id} className="card" onClick={() => setOpenId(openId === n.notice_id ? null : n.notice_id)} style={{ cursor: "pointer" }}>
                  <div style={{ fontWeight: 700 }}>{n.title}</div>
                  <div className="dim" style={{ fontSize: 12, marginTop: 3 }}>{timeAgo(n.published_at || n.created_at)}</div>
                  {openId === n.notice_id && <div className="muted" style={{ fontSize: 13.5, lineHeight: 1.6, marginTop: 10, whiteSpace: "pre-wrap" }}>{n.body}</div>}
                </div>
              ))}
            </div>
          )}
        </Async>
      )}
    </Screen>
  );
}
