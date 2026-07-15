import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "../components/ui/kit";
import { LoadingState } from "../components/ui/states";
import { settingsApi } from "../api/endpoints";
import { useAuth } from "../hooks/auth";
import { useToast } from "../hooks/toast";
import { ApiError, NetworkError } from "../lib/http";
import {
  LANGUAGE_SETTINGS_COPY,
  SUPPORTED_LANGUAGES,
  normalizeLanguage,
  type AppLanguage,
} from "../lib/language";

const BackChevron = () => (
  <svg width="27" height="27" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function LanguageSettings() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const { me, setMe } = useAuth();

  // Authoritative current language from the backend, seeded from the
  // authenticated-user cache so the correct card shows immediately (no flash of
  // a wrong default). Unsupported values clamp to the default (en).
  const langQ = useQuery({
    queryKey: ["settings-language"],
    queryFn: settingsApi.language,
    initialData: me?.app_language ? { app_language: me.app_language } : undefined,
  });
  const persisted: AppLanguage | null = langQ.data ? normalizeLanguage(langQ.data.app_language) : null;

  // Pending selection — applied only on Save; initialized once the persisted
  // value is known and never auto-changes the global app language.
  const [pending, setPending] = useState<AppLanguage | null>(null);
  useEffect(() => {
    if (pending === null && persisted !== null) setPending(persisted);
  }, [pending, persisted]);

  // Screen chrome is localized in the CURRENT (persisted) app language, not the
  // pending selection — the app language changes only after Save.
  const copy = LANGUAGE_SETTINGS_COPY[persisted ?? "en"];

  const save = useMutation({
    mutationFn: (lang: AppLanguage) => settingsApi.setLanguage(lang),
    onSuccess: (res) => {
      // Reconcile with the authoritative server value, then apply app-wide:
      // update the authenticated-user cache + the language query cache.
      const applied = normalizeLanguage(res.app_language);
      if (me) setMe({ ...me, app_language: applied });
      qc.setQueryData(["settings-language"], { app_language: applied });
      qc.invalidateQueries({ queryKey: ["settings"] }); // derived explanation/AI language
      toast.success(LANGUAGE_SETTINGS_COPY[applied].savedToast);
      nav(-1);
    },
    onError: (e) => {
      // Keep the previous global language and the pending selection for retry.
      const msg = e instanceof NetworkError
        ? copy.networkErrorToast
        : e instanceof ApiError && e.status === 422
          ? copy.errorToast // validation — safe generic message, no raw payload
          : copy.errorToast;
      toast.error(msg);
    },
  });

  function onSave() {
    if (pending === null || save.isPending) return; // single-flight, no partial state
    save.mutate(pending); // idempotent server-side, so a no-change save is a safe no-op
  }

  const loading = persisted === null || pending === null;

  return (
    <div className="screen lang">
      <header className="acct__header">
        <button className="acct__back" onClick={() => nav(-1)} aria-label={copy.back}>
          <BackChevron />
        </button>
        <h1 className="acct__title">{copy.title}</h1>
      </header>

      <div className="lang__body">
        {loading ? (
          <LoadingState />
        ) : (
          <div className="lang__list" role="radiogroup" aria-label={copy.title}>
            {SUPPORTED_LANGUAGES.map(({ code, nativeLabel }) => {
              const selected = pending === code;
              return (
                <button
                  key={code}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={`${nativeLabel}${selected ? ", 선택됨" : ""}`}
                  className={`lang__card ${selected ? "is-selected" : ""}`}
                  disabled={save.isPending}
                  onClick={() => setPending(code)}
                >
                  {nativeLabel}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="lang__foot">
        <Button
          block
          loading={save.isPending}
          disabled={loading}
          onClick={onSave}
          aria-label={copy.saveA11y}
        >
          {copy.save}
        </Button>
      </div>
    </div>
  );
}
