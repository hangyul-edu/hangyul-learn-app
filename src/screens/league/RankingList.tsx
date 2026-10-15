import { useEffect, useRef } from "react";
import { useTranslation } from "../../i18n";
import { MedalIcon, RankAvatar, withSelfProfile } from "../../components/brand/RankBits";
import { useAuthOptional } from "../../hooks/auth";
import type { RankingEntry } from "../../lib/types";

/** The regular league's standings, scrolled to the member's own row. */
export function RankingList({ entries, meId }: { entries: RankingEntry[]; meId?: string }) {
  const { t } = useTranslation();
  // The standings endpoint can lag a profile change, so the signed-in user's own
  // avatar comes from /users/me instead of from their ranking row.
  const me = useAuthOptional()?.me ?? null;
  const meRef = useRef<HTMLLIElement>(null);
  const anchored = useRef(false);
  // Initial scroll anchors around the current user's row (once per fresh load).
  useEffect(() => {
    if (anchored.current || !meRef.current) return;
    anchored.current = true;
    meRef.current.scrollIntoView({ block: "center" });
  }, [entries]);

  return (
    <ul className="lg__ranks" role="list">
      {entries.map((e) => {
        const isMe = e.user_id === meId;
        const medal = e.rank <= 3;
        return (
          <li
            key={e.user_id}
            ref={isMe ? meRef : undefined}
            className={`lg__rank ${isMe ? "is-me" : ""}`}
            aria-current={isMe ? "true" : undefined}
            aria-label={t("league.rankRowA11y", {
              rank: e.rank,
              name: e.nickname ?? t("league.defaultNickname"),
              me: isMe ? t("league.meSuffix") : "",
              points: e.points,
            })}
          >
            <span className="lg__rank-no">{e.rank}</span>
            <RankAvatar entry={withSelfProfile(e, me)} />
            <span className="lg__rank-name">
              {e.nickname ?? t("league.defaultNickname")}
            </span>
            {medal && <MedalIcon rank={e.rank} />}
            <span className="lg__rank-pts">{e.points}P</span>
          </li>
        );
      })}
    </ul>
  );
}
