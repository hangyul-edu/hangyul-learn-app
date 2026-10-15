import { useNavigate } from "react-router-dom";
import { useTranslation } from "../i18n";
import { useAuth } from "../hooks/auth";
import { formatPhone } from "../lib/format";
import { DetailHeader } from "../components/DetailHeader";

/**
 * Account Management ("계정관리") — read-only summary of account-level identity
 * (name / phone / email) plus a password-change entry point. Each credential is
 * mutated only through its own existing verified flow (/account/phone, email,
 * password); this screen never edits values in place and has no Save button.
 * Profile image + nickname are intentionally NOT here (see Profile Edit).
 */
export function Account() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { me } = useAuth();

  return (
    <div className="screen acct">
      <div className="acct__scroll">
        <DetailHeader title={t("account.title")} />
        <div className="acct__inner">

          {/* Name — read-only */}
          {/* The name row is the only one MOR-002 leaves as an unmodified
              cp_D_01_inputFields instance, so its label keeps the component's
              own Medium 13 / 1.4 / Gray 7 rather than the Caption 2 / Gray 5 the
              other three are overridden to. Confirmed in the render: this label
              samples 38,44,49 where the others sample 119,128,136. */}
          <div className="acct__label acct__label--name" id="acct-name-label">{t("account.name")}</div>
          <div className="acct__field" role="textbox" aria-readonly="true" aria-labelledby="acct-name-label">
            {me?.name ?? "-"}
          </div>

          {/* Phone — read-only number + change (editing lives on /account/phone) */}
          <div className="acct__label" id="acct-phone-label">{t("account.phone")}</div>
          <div className="acct__row">
            <div className="acct__field acct__field--flex" role="textbox" aria-readonly="true" aria-labelledby="acct-phone-label">
              {formatPhone(me?.phone)}
            </div>
            <button className="acct__action" onClick={() => nav("/account/phone")}>{t("account.changePhone")}</button>
          </div>

          {/* Email — read-only + change */}
          <div className="acct__label" id="acct-email-label">{t("account.email")}</div>
          <div className="acct__row">
            <div className="acct__field acct__field--flex" role="textbox" aria-readonly="true" aria-labelledby="acct-email-label">
              {/* A social sign-up without an email: never its placeholder. */}
              {me ? (me.email ?? t("common.notRegistered")) : "-"}
            </div>
            <button className="acct__action" onClick={() => nav("/account/email")}>{t("account.change")}</button>
          </div>

          {/* Password — outlined full-width action */}
          <div className="acct__label">{t("account.password")}</div>
          <button className="acct__pw" onClick={() => nav("/account/password")}>{t("account.changePassword")}</button>
        </div>
      </div>
    </div>
  );
}
