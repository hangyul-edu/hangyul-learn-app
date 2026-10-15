import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "../../i18n";
import { authApi } from "../../api/endpoints";
import { useAuth } from "../../hooks/auth";
import { useToast } from "../../hooks/toast";
import { errorMessage } from "../../lib/http";
import { passwordProblem } from "../../lib/validation";
import { Spinner } from "../../components/ui/Spinner";
import { BackChevronIcon } from "../../components/brand/Glyphs";

/**
 * Password change — single screen matching the reference. Reuses the
 * authenticated `changePassword(current, new, confirm)` API. The current-password
 * field is the re-authentication factor; on success the backend revokes sessions,
 * so we clear all fields and follow the existing hard sign-out → /login flow.
 * Passwords live only in screen-local state — never persisted, logged, or cached.
 */
export function ChangePassword() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const toast = useToast();
  const { hardSignOut } = useAuth();
  const [cur, setCur] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);

  // The shared policy that mirrors the backend: 8–64 chars, letter + number + special.
  const policyOk = passwordProblem(pw) === null;
  const matches = pw2.length > 0 && pw === pw2;
  const differs = pw.length > 0 && pw !== cur;
  const canSubmit = cur.length > 0 && policyOk && matches && differs && !busy;

  // Compact single-line feedback (most relevant issue only, stable height).
  const msg =
    pw2.length > 0 && pw !== pw2
      ? t("accountChanges.passwordMismatch")
      : pw.length > 0 && !policyOk
        ? t("accountChanges.passwordWeak")
        : cur.length > 0 && pw.length > 0 && pw === cur
          ? t("accountChanges.passwordSameAsCurrent")
          : "";

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    try {
      await authApi.changePassword(cur, pw, pw2);
      // Clear sensitive state before leaving.
      setCur("");
      setPw("");
      setPw2("");
      toast.success(t("accountChanges.passwordChanged"));
      hardSignOut();
      nav("/login", { replace: true });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen setupp pwch">
      <div className="setupp__scroll">
        <div className="setupp__inner">
          <button className="setupp__back" onClick={() => nav(-1)} aria-label={t("common.back")}>
            <BackChevronIcon size={27} />
          </button>

          <h1 className="setupp__title">{t("accountChanges.passwordTitle")}</h1>

          <label className="setupp__label" htmlFor="pwch-cur">{t("accountChanges.currentPassword")}</label>
          <input
            id="pwch-cur"
            className="pwch__field"
            type="password"
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect="off"
            placeholder={t("accountChanges.currentPasswordPlaceholder")}
            value={cur}
            onChange={(e) => setCur(e.target.value)}
          />

          <label className="setupp__label" htmlFor="pwch-new">{t("accountChanges.newPassword")}</label>
          <input
            id="pwch-new"
            className="pwch__field"
            type="password"
            autoComplete="new-password"
            autoCapitalize="none"
            autoCorrect="off"
            placeholder={t("accountChanges.newPasswordPlaceholder")}
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />

          <label className="setupp__label" htmlFor="pwch-confirm">{t("accountChanges.confirmPassword")}</label>
          <input
            id="pwch-confirm"
            className="pwch__field"
            type="password"
            autoComplete="new-password"
            autoCapitalize="none"
            autoCorrect="off"
            placeholder={t("accountChanges.confirmPasswordPlaceholder")}
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
          />

          <p className="pwch__msg" role="status" aria-live="polite">{msg}</p>

          <div className="setupp__spacer" />

          <button
            type="button"
            className="pwch__submit"
            onClick={submit}
            disabled={!canSubmit}
            aria-disabled={!canSubmit}
            aria-label={t(canSubmit ? "accountChanges.change" : "accountChanges.passwordBlockedA11y")}
          >
            {busy ? <Spinner size={22} stroke={2.5} /> : t("accountChanges.change")}
          </button>
        </div>
      </div>
    </div>
  );
}

