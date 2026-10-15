import { useNavigate, useParams } from "react-router-dom";
import { useTranslation, type TranslationKey } from "../i18n";
import { isPolicyId, policyDoc, TERMS_OF_SERVICE, type PolicyId } from "../lib/policies";
import { DetailHeader } from "../components/DetailHeader";
import { Sheet } from "../components/ui/Modal";

/* ------------------------------- detail --------------------------------- */
/** Email addresses, without swallowing the sentence-ending period after the
 *  final label ("…@talkhangyul.com." must not link the trailing dot). */
const EMAIL = /([\w.+-]+@[\w-]+(?:\.[\w-]+)+)/g;

/** TRM-003 sets its support addresses as underlined mailto links. The frames
 *  are inconsistent about which occurrences are linked — the Korean leaves §2
 *  and §6 as plain text — so every address is linked here instead. */
function Linkified({ text }: { text: string }) {
  const pieces = text.split(EMAIL);
  if (pieces.length === 1) return <>{text}</>;
  return (
    <>
      {pieces.map((piece, i) =>
        // `split` with one capture group puts the matches at the odd indices.
        i % 2 === 1 ? (
          <a key={i} className="policy__link" href={`mailto:${piece}`}>
            {piece}
          </a>
        ) : (
          piece
        ),
      )}
    </>
  );
}

/** A legal document in a bottom sheet over the screen that cites it (the
 *  signup agreements, the LINE email consent); closed while `id` is null. */
export function PolicySheet({ id, onClose }: { id: PolicyId | null; onClose: () => void }) {
  const { language } = useTranslation();
  return (
    <Sheet open={id !== null} onClose={onClose} title={id ? policyDoc(language, id).title : ""}>
      {id && <PolicyBody id={id} />}
    </Sheet>
  );
}

/** Renders the body of a legal document. Reused by the route screen and the
 *  sign-up agreement sheet so both stay in sync. */
export function PolicyBody({ id }: { id: PolicyId }) {
  const { t, language } = useTranslation();
  const doc = policyDoc(language, id);
  return (
    <div className="policy">
      {doc.intro && <p className="policy__intro">{doc.intro}</p>}
      {doc.updated && (
        <p className="policy__updated">{t("policy.effectiveDate", { date: doc.updated })}</p>
      )}
      {doc.sections.map((s) => (
        <section key={s.heading} className="policy__section">
          <h3 className="policy__heading">{s.heading}</h3>
          {s.body.map((block, i) => {
            if (typeof block === "string") {
              return (
                <p key={i} className="policy__para">
                  <Linkified text={block} />
                </p>
              );
            }
            return (
              <ul key={i} className="policy__list">
                {block.bullets.map((b) => (
                  <li key={b} className="policy__bullet">
                    <Linkified text={b} />
                  </li>
                ))}
              </ul>
            );
          })}
        </section>
      ))}
      {doc.closing && <p className="policy__closing">{doc.closing}</p>}
    </div>
  );
}

/** Standalone /policy/:doc detail screen. */
export function Policy() {
  const { language } = useTranslation();
  const { doc } = useParams<{ doc: string }>();
  const id: PolicyId = isPolicyId(doc) ? doc : TERMS_OF_SERVICE;
  return (
    <div className="screen pol">
      <DetailHeader title={policyDoc(language, id).title} />
      <div className="screen__body pol__body">
        <PolicyBody id={id} />
      </div>
    </div>
  );
}

/* ------------------------------- list page ------------------------------ */
const LIST_ITEMS: { id: PolicyId; label: TranslationKey }[] = [
  { id: "terms-of-use", label: "policy.termsOfUse" },
  { id: "purchase-privacy", label: "policy.privacy" },
  { id: "refund", label: "policy.refund" },
];

/** The seven business-information lines Figma TRM-001 lists, in its order. */
const BUSINESS_LINES: TranslationKey[] = [
  "policy.bizCeo",
  "policy.bizEmail",
  "policy.bizRegNo",
  "policy.bizAddress",
  "policy.bizMailOrder",
  "policy.bizPhone",
  "policy.bizCopyright",
];

/** /policy — Terms & Policies landing (약관 및 정책). */
export function PolicyList() {
  const { t } = useTranslation();
  const nav = useNavigate();
  return (
    <div className="screen pol">
      <DetailHeader title={t("policy.title")} />
      <div className="screen__body pol__list-body">
        <nav className="pol__menu" aria-label={t("policy.title")}>
          {LIST_ITEMS.map((item) => (
            <button key={item.id} className="pol__item" onClick={() => nav(`/policy/${item.id}`)}>
              {t(item.label)}
            </button>
          ))}
        </nav>

        <section className="pol__biz" aria-label={t("policy.businessTitle")}>
          <div className="pol__biz-title">{t("policy.businessTitle")}</div>
          {BUSINESS_LINES.map((line) => (
            <div className="pol__biz-line" key={line}>
              {t(line)}
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
