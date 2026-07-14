import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/auth";
import { NATIONALITIES, formatPhone } from "../lib/format";

/**
 * Account Management ("계정관리") — read-only summary of account-level identity
 * (name / phone / email) plus a password-change entry point. Each credential is
 * mutated only through its own existing verified flow (/account/phone, email,
 * password); this screen never edits values in place and has no Save button.
 * Profile image + nickname are intentionally NOT here (see Profile Edit).
 */
export function Account() {
  const nav = useNavigate();
  const { me } = useAuth();

  const country = NATIONALITIES.find((n) => n.code === (me?.nationality ?? "KR")) ?? NATIONALITIES[0];

  return (
    <div className="screen acct">
      <div className="acct__scroll">
        <div className="acct__inner">
          <header className="acct__header">
            <button className="acct__back" onClick={() => nav(-1)} aria-label="뒤로">
              <svg width="27" height="27" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <h1 className="acct__title">계정관리</h1>
          </header>

          {/* Name — read-only */}
          <div className="acct__label" id="acct-name-label">이름</div>
          <div className="acct__field" role="textbox" aria-readonly="true" aria-labelledby="acct-name-label">
            {me?.name ?? "-"}
          </div>

          {/* Phone — country + read-only number + change */}
          <div className="acct__label" id="acct-phone-label">휴대폰번호</div>
          <div className="acct__row">
            <button
              className="acct__country"
              onClick={() => nav("/account/phone")}
              aria-label={`국가 ${country.label}, 번호 변경으로 이동`}
            >
              <span className="acct__flag" aria-hidden="true">{country.flag}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 9l6 6 6-6" stroke="#9aa0a7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <div className="acct__field acct__field--flex" role="textbox" aria-readonly="true" aria-labelledby="acct-phone-label">
              {formatPhone(me?.phone)}
            </div>
            <button className="acct__action" onClick={() => nav("/account/phone")}>번호 변경</button>
          </div>

          {/* Email — read-only + change */}
          <div className="acct__label" id="acct-email-label">이메일</div>
          <div className="acct__row">
            <div className="acct__field acct__field--flex" role="textbox" aria-readonly="true" aria-labelledby="acct-email-label">
              {me?.email ?? "-"}
            </div>
            <button className="acct__action" onClick={() => nav("/account/email")}>변경하기</button>
          </div>

          {/* Password — outlined full-width action */}
          <div className="acct__label">비밀번호</div>
          <button className="acct__pw" onClick={() => nav("/account/password")}>비밀번호 변경</button>
        </div>
      </div>
    </div>
  );
}
