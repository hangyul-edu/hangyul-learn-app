import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TopBar } from "../components/layout/Screen";
import { Avatar, Button, Card } from "../components/ui/kit";
import { Async, SkeletonList } from "../components/ui/states";
import { gameApi } from "../api/endpoints";
import { useToast } from "../hooks/toast";
import { errorMessage } from "../lib/http";
import { TIER_COLOR, TIER_LABEL } from "../lib/format";

export function League() {
  const nav = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();

  const mine = useQuery({ queryKey: ["league-me"], queryFn: gameApi.myLeague });
  const seasons = useQuery({ queryKey: ["seasons"], queryFn: gameApi.seasons });
  const seasonId = seasons.data?.current?.season_id ?? seasons.data?.items?.[0]?.season_id;
  const rankings = useQuery({
    queryKey: ["rankings", seasonId],
    queryFn: () => gameApi.rankings(seasonId!),
    enabled: !!seasonId,
  });
  const att = useQuery({ queryKey: ["attendance"], queryFn: gameApi.attendanceStatus });

  async function checkIn() {
    try {
      const r = await gameApi.checkIn();
      toast.success(`출석 완료! ⚡ +${r.points_awarded ?? 0}`);
      qc.invalidateQueries({ queryKey: ["attendance"] });
      qc.invalidateQueries({ queryKey: ["points"] });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  const tier = mine.data?.tier ?? "green";

  return (
    <div className="screen">
      <TopBar title="리그" right={<button className="topbar__btn" onClick={() => nav("/points")}>⚡</button>} />
      <div className="screen__body screen__body--nav">
        <Async loading={mine.isLoading} error={mine.error} data={mine.data} onRetry={() => mine.refetch()} skeleton={<SkeletonList rows={2} height={90} />}>
          {(m) => (
            <div className="stack" style={{ gap: 16 }}>
              <Card padLg style={{ textAlign: "center", background: `linear-gradient(135deg, ${TIER_COLOR[tier]}22, #fff)` }}>
                <div style={{ fontSize: 44 }}>🏆</div>
                <div style={{ fontWeight: 900, fontSize: 20, color: TIER_COLOR[tier] }}>{TIER_LABEL[tier] ?? "리그"}</div>
                <div className="row" style={{ justifyContent: "center", gap: 22, marginTop: 12 }}>
                  <div className="center">
                    <div className="big-num" style={{ fontSize: 26 }}>{m.rank ?? "-"}</div>
                    <div className="dim" style={{ fontSize: 12 }}>순위</div>
                  </div>
                  <div className="center">
                    <div className="big-num" style={{ fontSize: 26 }}>{m.season_points}</div>
                    <div className="dim" style={{ fontSize: 12 }}>포인트</div>
                  </div>
                  <div className="center">
                    <div className="big-num" style={{ fontSize: 26 }}>{m.participants}</div>
                    <div className="dim" style={{ fontSize: 12 }}>참가자</div>
                  </div>
                </div>
              </Card>

              {!att.data?.checked_in_today && (
                <Card variant="soft" className="row">
                  <span style={{ fontSize: 26 }}>📅</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800 }}>오늘 출석하고 포인트 받기</div>
                    <div className="muted" style={{ fontSize: 12.5 }}>연속 {att.data?.consecutive_days ?? 0}일째</div>
                  </div>
                  <Button size="sm" onClick={checkIn}>출석</Button>
                </Card>
              )}

              <div className="section-title">이번 주 순위</div>
              <Async loading={rankings.isLoading} error={rankings.error} data={rankings.data} onRetry={() => rankings.refetch()} skeleton={<SkeletonList rows={6} height={56} />}>
                {(r) => (
                  <div className="stack" style={{ gap: 8 }}>
                    {(r.entries ?? []).map((e) => (
                      <div key={e.user_id} className="card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 12, background: e.is_me ? "var(--brand-50)" : undefined, borderColor: e.is_me ? "var(--brand-200)" : undefined }}>
                        <div className="big-num" style={{ width: 26, fontSize: 16, color: e.rank <= 3 ? "var(--brand-600)" : "var(--ink-3)" }}>{e.rank}</div>
                        <Avatar name={e.nickname} size={36} />
                        <div style={{ flex: 1, fontWeight: 700, fontSize: 14 }}>
                          {e.nickname ?? "회원"} {e.is_me && <span className="badge badge--brand" style={{ marginLeft: 4 }}>나</span>}
                        </div>
                        <div className="big-num" style={{ fontSize: 16 }}>{e.points}</div>
                      </div>
                    ))}
                  </div>
                )}
              </Async>
            </div>
          )}
        </Async>
      </div>
    </div>
  );
}
