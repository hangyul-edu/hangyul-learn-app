import { useNavigate } from "react-router-dom";
import { DailyLearningSun } from "./DailyLearningSun";

/** The header's streak count beside today's sun; opens the streak calendar. */
export function StreakChip({ days, label, className }: { days: number | null | undefined; label: string; className?: string }) {
  const nav = useNavigate();
  return (
    <button className={className ? `plearn__streak ${className}` : "plearn__streak"} onClick={() => nav("/streak")} aria-label={label}>
      <DailyLearningSun size={14} />
      <span>{days ?? "-"}</span>
    </button>
  );
}
