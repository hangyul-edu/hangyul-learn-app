import { useEffect, useState } from "react";
import { useTranslation } from "../../i18n";

/** Remaining time until a season's end (from real backend timing), or null when
 *  it has already elapsed so the caller can show the "ending soon" wording. */
function countdown(endsAt: string, now = Date.now()): { d: number; h: number; m: number } | null {
  const ms = new Date(endsAt).getTime() - now;
  if (Number.isNaN(ms) || ms <= 0) return null;
  const mins = Math.floor(ms / 60000);
  return { d: Math.floor(mins / 1440), h: Math.floor((mins % 1440) / 60), m: mins % 60 };
}

/** The season's live countdown, re-ticked once a minute while on screen. */
export function SeasonTimer({ endsAt }: { endsAt: string }) {
  const { t } = useTranslation();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  const left = countdown(endsAt, now);
  return <p className="lg__timer">{left ? t("league.timeLeft", { time: t("league.countdown", left) }) : t("league.endingSoon")}</p>;
}
