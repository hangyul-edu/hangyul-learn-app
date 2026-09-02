import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "../i18n";
import type { AppLanguage } from "../lib/language";
import jamoO from "../assets/brand/lang-jamo-o.svg";
import jamoB from "../assets/brand/lang-jamo-b.svg";
import jamoG from "../assets/brand/lang-jamo-g.svg";
import jamoR from "../assets/brand/lang-jamo-r.svg";

/**
 * First-run language chooser — Figma AME-001 (KO 1:12486 / EN 784:53343).
 *
 * Shown once, before /welcome, while `loadStoredLanguage()` is still null: two
 * 257-tall cards over four loose jamo shapes, and a cp_tab 시작하기 that commits
 * the choice. Picking a card only previews it; nothing is persisted until the
 * button is pressed, so a back-swipe leaves the app exactly as it was.
 *
 * The card faces stay Korean in both language frames — they name the *language*,
 * not the UI, so they are literals here rather than catalog entries.
 */
export function LanguagePicker() {
  const { t, language, setLanguage } = useTranslation();
  const nav = useNavigate();
  const [picked, setPicked] = useState<AppLanguage>(language);

  return (
    <div className="screen langpick">
      {/* ㄱ / ㄴ / ㅂ / ㅇ scattered behind the cards (1:12489 / 96 / 525). */}
      <img className="langpick__jamo langpick__jamo--r" src={jamoR} alt="" aria-hidden="true" />
      <img className="langpick__jamo langpick__jamo--b" src={jamoB} alt="" aria-hidden="true" />
      <img className="langpick__jamo langpick__jamo--o" src={jamoO} alt="" aria-hidden="true" />

      <h1 className="langpick__title">{t("languagePicker.title")}</h1>

      <div className="langpick__cards" role="radiogroup" aria-label={t("languagePicker.title")}>
        <button
          type="button"
          role="radio"
          aria-checked={picked === "en"}
          aria-label="English"
          className={`langpick__card langpick__card--en ${picked === "en" ? "is-on" : ""}`}
          onClick={() => setPicked("en")}
        >
          {/* The ㄱ hook hangs off this card's top-left corner (1:12516). */}
          <span className="langpick__hook" aria-hidden="true">
            <span className="langpick__hook-inner">
              <img src={jamoG} alt="" />
            </span>
          </span>
          <span className="langpick__glyph">abc</span>
          <span className="langpick__name">
            영어
            <br />
            (English)
          </span>
        </button>

        <button
          type="button"
          role="radio"
          aria-checked={picked === "ko"}
          aria-label="한국어"
          className={`langpick__card langpick__card--ko ${picked === "ko" ? "is-on" : ""}`}
          onClick={() => setPicked("ko")}
        >
          <span className="langpick__glyph">가나다</span>
          <span className="langpick__name">
            한국어
            <br />
            (Korean)
          </span>
        </button>
      </div>

      <div className="langpick__foot">
        <button
          className="langpick__cta"
          onClick={() => {
            setLanguage(picked);
            nav("/welcome", { replace: true });
          }}
        >
          {t("languagePicker.start")}
        </button>
      </div>
    </div>
  );
}
