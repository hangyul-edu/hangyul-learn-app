import { useTranslation, type Translate } from "../../i18n";
import { Spinner } from "../../components/ui/Spinner";
import type { Quiz, SavedSentenceItem } from "../../lib/types";
import { quizTitle, type Source } from "./config";
import icBookmarkFilled from "../../assets/brand/ic-24-bookmark-filled.svg";
import svPlay from "../../assets/brand/sv-play.svg";
import icTrash from "../../assets/brand/ic-trash.svg";

/** The row's trailing control: out of 오답 (a bin) or un-찜 (the filled bookmark). */
function RemoveButton({ source, onRemove }: { source: Source; onRemove: () => void }) {
  const { t } = useTranslation();
  return (
    <button className="rev__action" onClick={onRemove} aria-label={t(source === "wrong" ? "saved.removeFromWrong" : "saved.unbookmark")}>
      {source === "wrong" ? (
        /* 537:9628's delete control (572:23443) exports as one 12x14 path. */
        <img className="rev__action-ic" src={icTrash} alt="" aria-hidden="true" />
      ) : (
        /* TAL-044's saved control (674:10241) is a real ic_24_text instance. */
        <img className="rev__action-bm" src={icBookmarkFilled} alt="" aria-hidden="true" />
      )}
    </button>
  );
}

/** The orange button that opens the single-item review. */
function ReviewButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className="rev__play" onClick={onClick} aria-label={label}>
      <img src={svPlay} alt="" aria-hidden="true" />
    </button>
  );
}

export function SentenceRow({
  item,
  source,
  playing,
  loadingAudio,
  onToggleAudio,
  onReview,
  onRemove,
}: {
  item: SavedSentenceItem;
  source: Source;
  playing: boolean;
  loadingAudio: boolean;
  onToggleAudio: () => void;
  onReview: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  return (
    <li className="rev__row">
      <div className="rev__main">
        <div className="rev__ko">
          <span className="rev__ko-text">{item.korean}</span>
          <button
            className={`rev__speaker ${playing ? "is-playing" : ""}`}
            onClick={onToggleAudio}
            aria-label={t(playing ? "saved.stopSentenceA11y" : "saved.playSentenceA11y", { sentence: item.korean })}
          >
            {loadingAudio ? (
              <Spinner size={15} stroke={2} />
            ) : (
              /* Masked, not an <img>: the export is stroked #5ECECE, and the
                 glyph has to switch between the idle and playing colours. */
              <span className="rev__speaker-ic" aria-hidden="true" />
            )}
          </button>
        </div>
        <div className="rev__tr">{item.translation}</div>
      </div>
      <ReviewButton label={t("saved.reviewSentenceA11y", { sentence: item.korean })} onClick={onReview} />
      <RemoveButton source={source} onRemove={onRemove} />
    </li>
  );
}

export function QuizRow({
  item,
  source,
  t,
  onReview,
  onRemove,
}: {
  item: Quiz;
  source: Source;
  t: Translate;
  onReview: () => void;
  onRemove: () => void;
}) {
  const title = quizTitle(item, t);
  return (
    <li className="rev__row">
      <div className="rev__main">
        <div className="rev__qtitle">{title}</div>
        <div className="rev__qprompt">{item.prompt}</div>
      </div>
      <ReviewButton label={t("saved.reviewQuestionA11y", { title })} onClick={onReview} />
      <RemoveButton source={source} onRemove={onRemove} />
    </li>
  );
}

/** The header's pick-one menus (the mode, the sort): a backdrop that closes
 * it and the radio items. */
export function PickMenu<T extends string>({
  className,
  options,
  value,
  label,
  onPick,
  onClose,
}: {
  className: string;
  options: T[];
  value: T;
  label: (option: T) => string;
  onPick: (option: T) => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="rev__backdrop" onClick={onClose} />
      <div className={`rev__menu ${className}`} role="menu">
        {options.map((o) => (
          <button
            key={o}
            role="menuitemradio"
            aria-checked={o === value}
            className={`rev__menu-item ${o === value ? "is-active" : ""}`}
            onClick={() => onPick(o)}
          >
            {label(o)}
          </button>
        ))}
      </div>
    </>
  );
}
