import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "../i18n";
import { onboardingApi } from "../api/endpoints";
import { OnboardingIntro } from "./OnboardingIntro";
import { OnboardingPurpose } from "./OnboardingPurpose";
import { OnboardingSpeaking } from "./OnboardingSpeaking";
import { OnboardingDailyGoal } from "./OnboardingDailyGoal";
import { OnboardingTopikTarget } from "./OnboardingTopikTarget";
import { useAuth } from "../hooks/auth";
import { useToast } from "../hooks/toast";
import { errorMessage } from "../lib/http";

type Purpose = "conversation" | "topik";

export function Onboarding() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { bootstrapMe } = useAuth();
  const toast = useToast();
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [purpose, setPurpose] = useState<Purpose | null>(null);
  const [speaking, setSpeaking] = useState<string | null>(null);
  const [topikTarget, setTopikTarget] = useState<string | null>(null);
  const [goal, setGoal] = useState(10);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      // Push reminders default on (the final screens no longer collect it).
      const body: Record<string, unknown> = { purpose, push_opt_in: true };
      if (purpose === "conversation") {
        body.speaking_level = speaking;
        body.daily_sentence_goal = goal;
      } else {
        body.topik_target = topikTarget;
        body.daily_question_goal = goal;
      }
      await onboardingApi.submit(body);
      // Refresh the profile so `next_step` flips to complete — this lets the
      // attendance gate record today's check-in now that onboarding is done.
      try {
        await bootstrapMe();
      } catch {
        /* non-blocking: /home will refresh me on next load */
      }
      nav("/home", { replace: true });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  // First show the onboarding introduction; its button transitions into the
  // question flow (no answer submitted, onboarding not marked complete).
  if (!started) return <OnboardingIntro onStart={() => setStarted(true)} />;

  // Step 0 — learning-purpose (track) selection, with its faithful layout. The
  // draft `purpose` and branch routing stay here; the screen only reads/sets it.
  if (step === 0)
    return (
      <OnboardingPurpose
        purpose={purpose}
        onSelect={setPurpose}
        onBack={() => setStarted(false)}
        onNext={() => setStep(1)}
        progress={(step + 1) / 3}
      />
    );

  // Step 1, conversation branch — Korean speaking-level question.
  if (step === 1 && purpose === "conversation")
    return (
      <OnboardingSpeaking
        value={speaking}
        onSelect={setSpeaking}
        onBack={() => setStep(0)}
        onNext={() => setStep(2)}
        progress={(step + 1) / 3}
      />
    );

  // Step 2, conversation branch — final question (daily sentence goal). The CTA
  // runs the existing submit(), which completes onboarding server-side.
  if (step === 2 && purpose === "conversation")
    return (
      <OnboardingDailyGoal
        value={goal}
        onSelect={setGoal}
        onBack={() => setStep(1)}
        onSubmit={submit}
        busy={busy}
        progress={(step + 1) / 3}
        heading={t("onboarding.sentenceHeading")}
        notice={t("onboarding.goalNoticeSentences")}
      />
    );

  // Step 1, TOPIK branch — target-grade question.
  if (step === 1 && purpose === "topik")
    return (
      <OnboardingTopikTarget
        value={topikTarget}
        onSelect={setTopikTarget}
        onBack={() => setStep(0)}
        onNext={() => setStep(2)}
        progress={(step + 1) / 3}
      />
    );

  // Step 2, TOPIK branch — final question (daily problem goal). Same screen as
  // the conversation final question with a branch-specific heading; the CTA runs
  // the existing submit(), which completes onboarding server-side.
  if (step === 2 && purpose === "topik")
    return (
      <OnboardingDailyGoal
        value={goal}
        onSelect={setGoal}
        onBack={() => setStep(1)}
        onSubmit={submit}
        busy={busy}
        progress={(step + 1) / 3}
        heading={t("onboarding.questionHeading")}
        notice={t("onboarding.goalNoticeQuestions")}
      />
    );

  // Every step/branch above returns its own screen; nothing else is reachable.
  return null;
}
