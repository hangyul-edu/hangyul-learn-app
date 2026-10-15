import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, Sheet } from "../components/ui/Modal";
import { Button } from "../components/ui/kit";
import { TextField } from "../components/ui/Field";
import { SkeletonList } from "../components/ui/states";
import { payApi } from "../api/endpoints";
import { useMySubscription } from "../api/queries";
import { useToast } from "../hooks/toast";
import { currencyLabel, currencyMismatchText, paymentErrorMessage } from "../lib/paymentErrors";
import { InternationalCardSheet } from "../components/InternationalCardSheet";
import { useTranslation } from "../i18n";
import type { PaymentMethod, PaymentMethodList } from "../lib/types";
import { isPayLaunched } from "../lib/launch";
import { DetailHeader } from "../components/DetailHeader";
import { AddMethodButton, CardGlyph, EASY_PAY, MethodRow, PaymentResultModal, RecoveryNotice } from "./paymentMethods/parts";
import { METHODS_QK as QK, useRecoveryRetry } from "./paymentMethods/useRecoveryRetry";
import { useRegistration } from "./paymentMethods/useRegistration";

function cardName(m: PaymentMethod): string {
  if (m.issuer) return m.issuer;
  const paren = m.display_name.indexOf("(");
  return paren > 0 ? m.display_name.slice(0, paren).trim() : m.display_name;
}

/* Subscription states whose plan currency binds the default method — the
   server's _RENEWING_STATES plus the derived `trial_ending`. */
const RENEWING = new Set(["trial", "trial_ending", "active", "payment_pending", "payment_failed", "grace_period", "suspended"]);

/** 결제 수단 관리: methods on file, the primary choice, registration, and
 * recovering a failed automatic payment. */
export function PaymentMethods() {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: QK, queryFn: payApi.methods });
  const methods = q.data?.methods ?? [];
  const cards = methods.filter((m) => m.kind === "card");
  // The one kind of method this member may add (the server decides it from
  // their phone number): a domestic card — and the Korean wallets — for KRW,
  // an overseas card otherwise.
  const registration = q.data?.registration;
  const registerRegion = registration?.card_region ?? null;
  // Wallets charge KRW: offered to domestic members only (and launched); one
  // already on file always shows, so it can be seen and removed.
  const easyPay = EASY_PAY.filter(
    ({ provider }) =>
      (registerRegion === "domestic" && isPayLaunched(provider)) || methods.some((m) => m.provider === provider),
  );

  /* --- currency binding: a card charged in one currency pays only plans in it --- */
  const sub = useMySubscription().data;
  const liveCurrency = sub && RENEWING.has(sub.status) ? sub.plan_currency?.toUpperCase() ?? null : null;
  const currencyLocked = (m: PaymentMethod) =>
    !!liveCurrency && !!m.billing_currency && m.billing_currency.toUpperCase() !== liveCurrency;
  const methodTag = (m: PaymentMethod): string | null => {
    const region = m.card_region
      ? t(m.card_region === "international" ? "paymentMethods.regionInternational" : "paymentMethods.regionDomestic")
      : null;
    const currency = m.billing_currency?.toUpperCase() ?? null;
    if (region && currency) return t("paymentMethods.cardTag", { region, currency });
    return region ?? currency;
  };

  const [removeTarget, setRemoveTarget] = useState<PaymentMethod | null>(null);
  const cardsRef = useRef<HTMLElement>(null);
  const retryBtnRef = useRef<HTMLButtonElement>(null);
  const reg = useRegistration();
  const rec = useRecoveryRetry();
  const { retry } = rec;

  const invalidate = () => qc.invalidateQueries({ queryKey: QK });
  const scrollToCards = () => cardsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  /* --- primary selection (optimistic, single-flight, reconciled) --- */
  const setDefault = useMutation({
    mutationFn: (id: string) => payApi.setDefault(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: QK });
      const prev = qc.getQueryData<PaymentMethodList>(QK);
      // Keep `registration`: the add-card and wallet sections are drawn from it.
      qc.setQueryData<PaymentMethodList>(QK, (old) =>
        old ? { ...old, methods: old.methods.map((m) => ({ ...m, is_default: m.method_id === id })) } : old,
      );
      return { prev };
    },
    onError: (e, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(QK, ctx.prev);
      toast.error(paymentErrorMessage(e));
    },
    onSettled: invalidate,
  });

  function selectPrimary(m: PaymentMethod) {
    // A primary change mid-retry could invalidate the in-flight charge — block it.
    if (m.is_default || setDefault.isPending || retry.isPending) return;
    if (currencyLocked(m)) {
      // The server would refuse it (payment_method.currency_mismatch); say why up front.
      toast.error(currencyMismatchText(m.billing_currency, liveCurrency));
      return;
    }
    setDefault.mutate(m.method_id);
  }

  /* --- deletion / disconnect --- */
  const remove = useMutation({
    mutationFn: async (target: PaymentMethod) => {
      // Deleting the primary while another usable method remains: hand the
      // primary to it atomically (server soft-deletes the target). Only an
      // active method that can pay the live plan's currency qualifies — the
      // server refuses a revoked one (404) or another currency's (422).
      // Otherwise a plain delete, which the backend rejects (409) only when it
      // is the primary during an active subscription.
      const replacement = methods.find(
        (m) => m.method_id !== target.method_id && m.status === "active" && !currencyLocked(m),
      );
      if (target.is_default && replacement) {
        await payApi.replace(target.method_id, replacement.method_id);
      } else {
        await payApi.remove(target.method_id);
      }
    },
    onSuccess: () => {
      setRemoveTarget(null);
      invalidate();
    },
    onError: (e) => toast.error(paymentErrorMessage(e)), // keep the modal open
  });

  const primaryMethod = methods.find((m) => m.is_default && m.status === "active");
  function doRetry() {
    if (!rec.showNotice || !rec.canRetryNow || !rec.recovery?.outstanding_invoice_id) return;
    // Never charge against a stale method id: wait for a pending primary change.
    if (setDefault.isPending || retry.isPending) return;
    if (!primaryMethod) {
      toast.error(t("paymentMethods.selectFirst"));
      scrollToCards();
      return;
    }
    retry.mutate(rec.recovery.outstanding_invoice_id);
  }

  function closeFailure() {
    rec.closeFailure();
    scrollToCards();
    retryBtnRef.current?.focus();
  }

  const selectDisabled = setDefault.isPending;
  const addDisabled = !!reg.starting || retry.isPending;
  const selectionA11y = (name: string, selected: boolean) =>
    t("paymentMethods.defaultMethodA11y", {
      name,
      state: t(selected ? "paymentMethods.selected" : "paymentMethods.notSelected"),
    });

  return (
    <div className="screen pm">
      <DetailHeader title={t("paymentMethods.title")} />

      <div className="pm__scroll">
        {q.isLoading ? (
          <div className="pm__section"><SkeletonList rows={3} height={64} /></div>
        ) : q.isError ? (
          <div className="pm__state">
            <span>{t("paymentMethods.loadError")}</span>
            <button className="pm__retry" onClick={() => q.refetch()}>{t("common.retry")}</button>
          </div>
        ) : (
          <>
            {/* --- Failed automatic payment recovery notice --- */}
            {rec.showNotice && rec.recovery && (
              <RecoveryNotice
                recovery={rec.recovery}
                blockedText={rec.retryBlockedText}
                canRetry={rec.canRetryNow}
                paying={retry.isPending}
                busy={setDefault.isPending}
                onRetry={doRetry}
                retryBtnRef={retryBtnRef}
              />
            )}

            {/* --- Credit / debit cards --- */}
            <section className="pm__section" aria-label={t("paymentMethods.cardsSection")} ref={cardsRef}>
              <h2 className="pm__section-title">{t("paymentMethods.cardsSection")}</h2>
              <ul className="pm__list" role="list">
                {cards.map((m) => {
                  const tag = methodTag(m);
                  const locked = currencyLocked(m);
                  const name = tag ? `${m.display_name} ${tag}` : m.display_name;
                  return (
                    <li key={m.method_id}>
                      <MethodRow
                        selected={m.is_default}
                        locked={locked}
                        label={locked ? t("paymentMethods.currencyLockedA11y", { name }) : selectionA11y(name, m.is_default)}
                        deleteLabel={t("paymentMethods.deleteA11y", { name: m.display_name })}
                        onSelect={() => selectPrimary(m)}
                        onDelete={() => setRemoveTarget(m)}
                      >
                        <CardGlyph />
                        <div className="pm__row-main">
                          {/* 1332:22003 sets the name and the masked digits as one
                              run — no space before the parenthesis. */}
                          <span className="pm__row-name">{cardName(m)}</span>
                          {m.masked_card_number && <span className="pm__row-masked">({m.masked_card_number})</span>}
                          {/* Region + the only currency it can be charged in, so
                              two cards of the same issuer stay distinguishable. */}
                          {tag && <span className={`pm__row-tag ${m.card_region === "international" ? "is-intl" : ""}`}>{tag}</span>}
                        </div>
                      </MethodRow>
                    </li>
                  );
                })}
              </ul>

              {/* One flow per member, decided by the server from their phone
                  number: +82 → a Korean card in Toss's window (KRW); anyone
                  else → an overseas card in our own form (USD). */}
              {registerRegion === "domestic" && (
                <AddMethodButton
                  label={t("paymentMethods.addDomestic")}
                  sub={t("paymentMethods.addDomesticSub")}
                  a11yLabel={t("paymentMethods.addDomesticA11y")}
                  disabled={addDisabled}
                  onClick={reg.startDomesticCard}
                />
              )}
              {registerRegion === "international" && (
                <AddMethodButton
                  label={t("paymentMethods.addInternational")}
                  sub={t("paymentMethods.addInternationalSub", { currency: currencyLabel(registration?.currency, t) })}
                  a11yLabel={t("paymentMethods.addInternationalA11y")}
                  disabled={addDisabled}
                  onClick={reg.openIntl}
                />
              )}
            </section>

            {/* --- Easy payment: Korean wallets, KRW only — for members who
                register domestic cards, or to see/remove one already on file --- */}
            {easyPay.length > 0 && (
              <section className="pm__section" aria-label={t("paymentMethods.easyPaySection")}>
                <h2 className="pm__section-title">{t("paymentMethods.easyPaySection")}</h2>
                <ul className="pm__list pm__list--ez" role="list">
                  {easyPay.map(({ provider, labelKey, Logo }) => {
                    const connected = methods.find((m) => m.provider === provider);
                    return (
                      <li key={provider}>
                        {connected ? (
                          <MethodRow
                            className="pm__ez"
                            selected={connected.is_default}
                            locked={currencyLocked(connected)}
                            label={selectionA11y(t(labelKey), connected.is_default)}
                            deleteLabel={t("paymentMethods.disconnectA11y", { name: t(labelKey) })}
                            onSelect={() => selectPrimary(connected)}
                            onDelete={() => setRemoveTarget(connected)}
                          >
                            <div className="pm__row-main pm__row-main--logo"><Logo /></div>
                          </MethodRow>
                        ) : (
                          <div className="pm__row pm__row--connect pm__ez">
                            <div className="pm__row-main pm__row-main--logo"><Logo /></div>
                            <button
                              className="pm__connect"
                              onClick={() => reg.startWallet(provider as "toss_pay" | "naver_pay")}
                              disabled={addDisabled}
                              aria-label={t("paymentMethods.connectA11y", { name: t(labelKey) })}
                            >
                              {t("paymentMethods.connect")}
                            </button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {/* --- Notice --- */}
            <section className="pm__notice" aria-label={t("paymentMethods.noticeSection")}>
              <h2 className="pm__notice-title">{t("paymentMethods.noticeSection")}</h2>
              <ul className="pm__notice-body">
                <li>{t("paymentMethods.notice1")}</li>
                <li>{t("paymentMethods.notice2")}</li>
                <li>{t("paymentMethods.notice3")}</li>
                <li>{t("paymentMethods.notice4")}</li>
              </ul>
            </section>
          </>
        )}
      </div>

      {/* --- registration / connection sheet --- */}
      <Sheet open={!!reg.flow} onClose={reg.closeFlow} title={reg.flow?.title}>
        <p className="muted pm__flow-hint">{t("paymentMethods.flowHint")}</p>
        <TextField
          label={t("paymentMethods.authValueLabel")}
          placeholder={reg.flow?.placeholder}
          value={reg.token}
          onChange={(e) => reg.setToken(e.target.value)}
        />
        <div className="pm__flow-gap" />
        <Button block loading={reg.confirming} disabled={!reg.token.trim()} onClick={reg.confirmFlow}>
          {t("paymentMethods.registerDone")}
        </Button>
      </Sheet>

      {/* --- overseas-issued card: the app's own form --- */}
      <InternationalCardSheet
        open={reg.intlOpen && registerRegion === "international"}
        onClose={reg.closeIntl}
        onRegistered={reg.intlRegistered}
      />

      {/* --- deletion / disconnect confirmation --- */}
      <Dialog
        open={!!removeTarget}
        onClose={remove.isPending ? undefined : () => setRemoveTarget(null)}
        title={t("paymentMethods.deleteTitle")}
        text={t("paymentMethods.deleteText")}
      >
        <div className="pm__modal-actions">
          <button className="pm__modal-btn pm__modal-btn--cancel" disabled={remove.isPending} onClick={() => setRemoveTarget(null)}>
            {t("common.cancel")}
          </button>
          <button className="pm__modal-btn pm__modal-btn--delete" disabled={remove.isPending} onClick={() => removeTarget && remove.mutate(removeTarget)}>
            {t("paymentMethods.delete")}
          </button>
        </div>
      </Dialog>

      {rec.resultModal?.kind === "success" && (
        <PaymentResultModal variant="success" planName={rec.recovery?.plan_name} onConfirm={rec.confirmSuccess} />
      )}
      {rec.resultModal?.kind === "failure" && (
        <PaymentResultModal variant="failure" failureClass={rec.resultModal.failureClass} onConfirm={closeFailure} />
      )}

      {(selectDisabled || retry.isPending) && (
        <span className="pm__sr" role="status">{t(retry.isPending ? "paymentMethods.retryingStatus" : "paymentMethods.changingDefaultStatus")}</span>
      )}
    </div>
  );
}
