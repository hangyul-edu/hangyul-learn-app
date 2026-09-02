import type { ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation, type TranslationKey } from "../i18n";
import { POLICIES, type PolicyId } from "../lib/policies";
import { DetailHeader } from "../components/DetailHeader";

/* ------------------------------- header --------------------------------- */
/** Borderless More-section app bar (back chevron + centered title), matching
 *  the notification-settings / friend-management headers. */
export function PolicyHeader({ title }: { title: ReactNode }) {
  return (
    <DetailHeader title={title} />
  );
}

/* ------------------------------- detail --------------------------------- */
/** Renders the body of a legal document. Reused by the route screen and the
 *  sign-up agreement sheet so both stay in sync. */
export function PolicyBody({ id }: { id: PolicyId }) {
  const { t } = useTranslation();
  const doc = POLICIES[id];
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
                  {block}
                </p>
              );
            }
            if ("bullets" in block) {
              return (
                <ul key={i} className="policy__list">
                  {block.bullets.map((b) => (
                    <li key={b} className="policy__bullet">
                      {b}
                    </li>
                  ))}
                </ul>
              );
            }
            return (
              <table key={i} className="policy__table">
                <thead>
                  <tr>
                    {block.table.headers.map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.table.rows.map((row, r) => (
                    <tr key={r}>
                      {row.map((cell, c) => (
                        <td key={c}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            );
          })}
        </section>
      ))}
    </div>
  );
}

/** Standalone /policy/:doc detail screen. */
export function Policy() {
  const { doc } = useParams<{ doc: string }>();
  const id = (doc && doc in POLICIES ? doc : "terms") as PolicyId;
  return (
    <div className="screen pol">
      <PolicyHeader title={POLICIES[id].title} />
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

/** Figma TRM-001 lists seven lines; the app previously omitted the mail-order
 *  registration number and the contact number. */
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
      <PolicyHeader title={t("policy.title")} />
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
