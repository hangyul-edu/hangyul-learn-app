import { useCallback, useEffect, useRef, useState } from "react";
import { useBlocker, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "../components/ui/kit";
import { UnsavedChangesModal } from "../components/UnsavedChangesModal";
import { LanguageSavedModal } from "../components/LanguageSavedModal";
import { LoadingState } from "../components/ui/states";
import { settingsApi } from "../api/endpoints";
import { useAuth } from "../hooks/auth";
import { useToast } from "../hooks/toast";
import { NetworkError } from "../lib/http";
import { SUPPORTED_LANGUAGES, normalizeLanguage, type AppLanguage } from "../lib/language";
import { useI18n } from "../i18n";
import { DetailHeader } from "../components/DetailHeader";


export function LanguageSettings() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const { me, setMe } = useAuth();
  // `t` renders in the CURRENT app language; `setLanguage` switches the whole
  // app once a save is confirmed by the server.
  const { t, setLanguage } = useI18n();

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

  // Shown only after the backend confirms the save; gates the return navigation
  // on the user tapping 확인.
  const [savedOpen, setSavedOpen] = useState(false);

  const save = useMutation({
    mutationFn: (lang: AppLanguage) => settingsApi.setLanguage(lang),
    onSuccess: (res) => {
      // Reconcile with the authoritative server value, then apply app-wide:
      // update the authenticated-user cache + the language query cache. This
      // also makes the persisted value equal the pending one, so the form is no
      // longer dirty and the unsaved-changes guard won't fire.
      const applied = normalizeLanguage(res.app_language);
      if (me) setMe({ ...me, app_language: applied });
      // Switch the app now that the server has accepted it. This is the only
      // place the display language changes: chrome above stays in the previous
      // language until this point, matching the design's post-save modal.
      setLanguage(applied);
      qc.setQueryData(["settings-language"], { app_language: applied });
      setSavedOpen(true); // success feedback; navigation waits for 확인
    },
    onError: (e) => {
      // Keep the previous global language and the pending selection for retry.
      // Server errors (validation included) get one fixed message, never the
      // raw payload.
      toast.error(t(e instanceof NetworkError ? "common.networkError" : "languageSettings.errorToast"));
    },
  });

  function onSave() {
    if (pending === null || save.isPending) return; // single-flight, no partial state
    save.mutate(pending); // idempotent server-side, so a no-change save is a safe no-op
  }

  // Unsaved-change guard. Dirty = the pending selection differs from the
  // persisted value (comparing actual values, so reverting to the original
  // clears it; a successful save updates the persisted cache and clears it too).
  const leavingRef = useRef(false); // set on a deliberate exit (save / 나가기)
  const dirty = pending !== null && persisted !== null && pending !== persisted;

  // Block every in-app exit path while dirty — header back, browser/hardware
  // back, swipe-back, and programmatic pop — via the data router. The modal is
  // driven by the blocker's state; the pending navigation is held until the user
  // confirms 나가기.
  const blocker = useBlocker(
    useCallback(
      ({
        currentLocation,
        nextLocation,
      }: {
        currentLocation: { pathname: string };
        nextLocation: { pathname: string };
      }) => dirty && !leavingRef.current && currentLocation.pathname !== nextLocation.pathname,
      [dirty],
    ),
  );

  const loading = persisted === null || pending === null;

  // Leave to the parent (More) page via an explicit in-app route rather than a
  // history pop. A route navigation is always same-document, so the router's
  // unsaved-changes blocker can reliably intercept it and show the confirmation
  // modal first — a cross-document history back (e.g. after a reload) cannot be
  // blocked and would navigate away immediately. This also never triggers a
  // full-document reload or the browser's native unload prompt.
  const goBack = () => nav("/profile");

  return (
    <div className="screen lang">
      <DetailHeader title={t("languageSettings.title")} onBack={goBack} />

      <div className="lang__body">
        {loading ? (
          <LoadingState />
        ) : (
          <div className="lang__list" role="radiogroup" aria-label={t("languageSettings.title")}>
            {SUPPORTED_LANGUAGES.map(({ code, nativeLabel }) => {
              const selected = pending === code;
              return (
                <button
                  key={code}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={selected ? `${nativeLabel}, ${t("languageSettings.selected")}` : nativeLabel}
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
          aria-label={t("languageSettings.saveA11y")}
        >
          {t("languageSettings.save")}
        </Button>
      </div>

      <UnsavedChangesModal
        open={blocker.state === "blocked"}
        onContinue={() => blocker.reset?.()}
        onLeave={() => {
          leavingRef.current = true; // draft discarded; proceed with the blocked nav
          blocker.proceed?.();
        }}
      />

      <LanguageSavedModal
        open={savedOpen}
        title={t("languageSettings.savedModalTitle")}
        description={t("languageSettings.savedModalDesc")}
        confirmLabel={t("common.confirm")}
        onConfirm={() => {
          // Close once, then return to the previous screen (the current
          // post-save flow). No re-save, no reload; the form is already clean.
          setSavedOpen(false);
          leavingRef.current = true;
          nav("/profile");
        }}
      />
    </div>
  );
}
