import { CloseIcon } from "../brand/Glyphs";

/** A member's nickname, or `fallback` when they have none. */
export const nameOf = (u: { nickname?: string | null }, fallback: string) => u.nickname ?? fallback;

export const SearchIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
    <path d="M20 20l-3.2-3.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export function SheetHeader({ title, closeLabel, onClose }: { title: string; closeLabel: string; onClose: () => void }) {
  return (
    <div className="afs__header">
      <h2 className="afs__title">{title}</h2>
      <button className="afs__close" aria-label={closeLabel} onClick={onClose}>
        <CloseIcon size={26} color="#262c31" />
      </button>
    </div>
  );
}

export function InfoBox({ lines }: { lines: string[] }) {
  return (
    <ul className="afs__info">
      {lines.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  );
}
