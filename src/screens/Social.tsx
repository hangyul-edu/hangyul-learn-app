import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TopBar } from "../components/layout/Screen";
import { Avatar, Button, Segmented } from "../components/ui/kit";
import { Async, EmptyState, SkeletonList } from "../components/ui/states";
import { TextField } from "../components/ui/Field";
import { friendApi } from "../api/endpoints";
import { useToast } from "../hooks/toast";
import { errorMessage } from "../lib/http";
import { NATIONALITIES } from "../lib/format";
import type { Friend } from "../lib/types";

export function Social() {
  const toast = useToast();
  const qc = useQueryClient();
  // Optional deep-link to a specific tab, e.g. `/social?tab=find` opens the
  // friend-search/add flow directly (used by Friend League's 친구 추가).
  const [params] = useSearchParams();
  const initialTab = params.get("tab");
  const [tab, setTab] = useState<"friends" | "requests" | "find">(
    initialTab === "find" || initialTab === "requests" ? initialTab : "friends",
  );

  const friends = useQuery({ queryKey: ["friends"], queryFn: friendApi.list, enabled: tab === "friends" });
  const received = useQuery({ queryKey: ["friend-requests"], queryFn: friendApi.received, enabled: tab === "requests" });

  const friendList = friends.data?.items ?? friends.data?.friends ?? [];
  const reqList = received.data?.items ?? [];

  async function act(fn: () => Promise<unknown>, msg: string, keys: string[]) {
    try {
      await fn();
      toast.success(msg);
      keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <div className="screen">
      <TopBar title="친구" />
      <div className="screen__body screen__body--nav">
        <div style={{ marginBottom: 14 }}>
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: "friends", label: "친구" },
              { value: "requests", label: `요청${reqList.length ? ` ${reqList.length}` : ""}` },
              { value: "find", label: "친구 찾기" },
            ]}
          />
        </div>

        {tab === "friends" && (
          <Async loading={friends.isLoading} error={friends.error} data={friends.data} onRetry={() => friends.refetch()} isEmpty={() => friendList.length === 0} empty={<EmptyState emoji="👋" title="아직 친구가 없어요" text="친구를 추가해 함께 리그에서 경쟁해 보세요." action={<Button size="sm" onClick={() => setTab("find")}>친구 찾기</Button>} />} skeleton={<SkeletonList rows={5} />}>
            {() => (
              <div className="stack" style={{ gap: 8 }}>
                {friendList.map((f) => (
                  <div key={f.user_id} className="listrow" style={{ cursor: "default" }}>
                    <Avatar name={f.nickname} url={f.profile_image_url} />
                    <div className="listrow__main">
                      <div className="listrow__title">{f.nickname ?? "회원"}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Async>
        )}

        {tab === "requests" && (
          <Async loading={received.isLoading} error={received.error} data={received.data} onRetry={() => received.refetch()} isEmpty={() => reqList.length === 0} empty={<EmptyState emoji="📭" title="받은 요청이 없어요" />} skeleton={<SkeletonList rows={4} />}>
            {() => (
              <div className="stack" style={{ gap: 8 }}>
                {reqList.map((r) => (
                  <div key={r.request_id} className="card row">
                    <Avatar name={r.nickname} url={r.profile_image_url} />
                    <div style={{ flex: 1, fontWeight: 700 }}>{r.nickname ?? "회원"}</div>
                    <Button size="sm" onClick={() => act(() => friendApi.accept(r.request_id), "친구가 되었어요!", ["friend-requests", "friends"])}>수락</Button>
                    <Button size="sm" variant="ghost" onClick={() => act(() => friendApi.reject(r.request_id), "요청을 거절했어요", ["friend-requests"])}>거절</Button>
                  </div>
                ))}
              </div>
            )}
          </Async>
        )}

        {tab === "find" && <FindFriends onAdded={() => qc.invalidateQueries({ queryKey: ["friend-requests"] })} />}
      </div>
    </div>
  );
}

function FindFriends({ onAdded }: { onAdded: () => void }) {
  const toast = useToast();
  const [country, setCountry] = useState("KR");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<Friend | null | "none">(null);
  const dial = useMemo(() => NATIONALITIES.find((n) => n.code === country)?.dial ?? "+82", [country]);

  async function search() {
    setBusy(true);
    setFound(null);
    try {
      const e164 = `${dial}${phone.replace(/^0+/, "").replace(/\D/g, "")}`;
      const res = await friendApi.searchPhone(e164);
      setFound(res.user ?? (res.found ? (res as unknown as Friend) : "none"));
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function add(userId: string) {
    try {
      await friendApi.request(userId);
      toast.success("친구 요청을 보냈어요");
      onAdded();
      setFound(null);
      setPhone("");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <div className="stack" style={{ gap: 14 }}>
      <p className="muted">휴대폰 번호로 친구를 찾아 요청을 보낼 수 있어요.</p>
      <div style={{ display: "flex", gap: 8 }}>
        <select className="input" style={{ width: 120 }} value={country} onChange={(e) => setCountry(e.target.value)}>
          {NATIONALITIES.map((n) => (
            <option key={n.code} value={n.code}>{n.flag} {n.dial}</option>
          ))}
        </select>
        <TextField placeholder="01012345678" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <Button block loading={busy} disabled={!phone} onClick={search}>검색</Button>

      {found === "none" && <EmptyState emoji="🔍" title="일치하는 회원이 없어요" text="번호를 다시 확인해 주세요." />}
      {found && found !== "none" && (
        <div className="card row">
          <Avatar name={found.nickname} url={found.profile_image_url} />
          <div style={{ flex: 1, fontWeight: 700 }}>{found.nickname ?? "회원"}</div>
          <Button size="sm" onClick={() => add(found.user_id)}>친구 요청</Button>
        </div>
      )}
    </div>
  );
}
