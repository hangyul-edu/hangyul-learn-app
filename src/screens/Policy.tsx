import type { ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { POLICIES, type PolicyId } from "../lib/policies";

/* ------------------------------- header --------------------------------- */
/** Borderless More-section app bar (back chevron + centered title), matching
 *  the notification-settings / friend-management headers. */
export function PolicyHeader({ title }: { title: ReactNode }) {
  const nav = useNavigate();
  return (
    <header className="pol__header">
      <button className="pol__back" onClick={() => nav(-1)} aria-label="뒤로 가기">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M15 5l-7 7 7 7" stroke="#272c30" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <h1 className="pol__title">{title}</h1>
    </header>
  );
}

/* ------------------------------- detail --------------------------------- */
/** Renders the body of a legal document. Reused by the route screen and the
 *  sign-up agreement sheet so both stay in sync. */
export function PolicyBody({ id }: { id: PolicyId }) {
  const doc = POLICIES[id];
  return (
    <div className="policy">
      {doc.intro && <p className="policy__intro">{doc.intro}</p>}
      {doc.updated && <p className="policy__updated">시행일 {doc.updated}</p>}
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
const LIST_ITEMS: { id: PolicyId; label: string }[] = [
  { id: "terms-of-use", label: "이용약관" },
  { id: "purchase-privacy", label: "개인정보처리 방침" },
  { id: "refund", label: "구독 해지 및 환불 정책" },
];

const BUSINESS_LINES = [
  "대표이사: 유재희",
  "이메일: support@talkhangyul.com",
  "사업자등록번호: 403-87-03380",
  "주소: 서울특별시 도봉구 우이천로38길 39",
  "Copyright © 2025 HanGyul. All Rights Reserved.",
];

/** /policy — Terms & Policies landing (약관 및 정책). */
export function PolicyList() {
  const nav = useNavigate();
  return (
    <div className="screen pol">
      <PolicyHeader title="약관 및 정책" />
      <div className="screen__body pol__list-body">
        <nav className="pol__menu" aria-label="약관 및 정책">
          {LIST_ITEMS.map((item) => (
            <button key={item.id} className="pol__item" onClick={() => nav(`/policy/${item.id}`)}>
              {item.label}
            </button>
          ))}
        </nav>

        <section className="pol__biz" aria-label="사업자 정보">
          <div className="pol__biz-title">사업자 정보</div>
          {BUSINESS_LINES.map((line) => (
            <div className="pol__biz-line" key={line}>
              {line}
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
