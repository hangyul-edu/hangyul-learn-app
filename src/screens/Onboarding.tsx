import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { TopBar } from "../components/layout/Screen";
import { Button, CheckLine, OptionCard } from "../components/ui/kit";
import { onboardingApi } from "../api/endpoints";
import { OnboardingIntro } from "./OnboardingIntro";
import { OnboardingPurpose } from "./OnboardingPurpose";
import { OnboardingSpeaking } from "./OnboardingSpeaking";
import { OnboardingDailyGoal } from "./OnboardingDailyGoal";
import { OnboardingTopikTarget } from "./OnboardingTopikTarget";
import { useToast } from "../hooks/toast";
import { errorMessage } from "../lib/http";

type Purpose = "conversation" | "topik";
const GOALS = [5, 10, 20, 30, 40];

export function Onboarding() {
  const nav = useNavigate();
  const toast = useToast();
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [purpose, setPurpose] = useState<Purpose | null>(null);
  const [speaking, setSpeaking] = useState<string | null>(null);
  const [topikTarget, setTopikTarget] = useState<string | null>(null);
  const [goal, setGoal] = useState(10);
  const [push, setPush] = useState(true);
  const [busy, setBusy] = useState(false);

  const canNext =
    (step === 0 && purpose) ||
    (step === 1 && (purpose === "conversation" ? speaking : topikTarget)) ||
    step === 2;

  async function submit() {
    setBusy(true);
    try {
      const body: Record<string, unknown> = { purpose, push_opt_in: push };
      if (purpose === "conversation") {
        body.speaking_level = speaking;
        body.daily_sentence_goal = goal;
      } else {
        body.topik_target = topikTarget;
        body.daily_question_goal = goal;
      }
      await onboardingApi.submit(body);
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

  return (
    <div className="screen">
      <TopBar back onBack={() => setStep((s) => s - 1)} title="시작하기" />
      <div className="screen__body">
        <div className="progress" style={{ marginBottom: 22 }}>
          <div className="progress__bar" style={{ width: `${((step + 1) / 3) * 100}%` }} />
        </div>

        {step === 0 && (
          <div className="stack">
            <h2 style={{ fontSize: 22 }}>무엇을 배우고 싶으세요?</h2>
            <p className="muted" style={{ marginTop: -6 }}>선택한 목표가 홈 화면 맨 위에 표시돼요. 둘 다 언제든 학습할 수 있어요.</p>
            <OptionCard selected={purpose === "conversation"} onClick={() => setPurpose("conversation")} emoji="💬" title="회화 · 일상 대화" sub="자연스러운 한국어 문장 말하기" />
            <OptionCard selected={purpose === "topik"} onClick={() => setPurpose("topik")} emoji="📝" title="TOPIK 시험 준비" sub="급수별 문제로 실력 다지기" />
          </div>
        )}

        {step === 2 && (
          <div className="stack" style={{ gap: 16 }}>
            <h2 style={{ fontSize: 22 }}>하루 목표를 정해요</h2>
            <p className="muted" style={{ marginTop: -8 }}>
              하루 {purpose === "topik" ? "문제" : "문장"} 개수예요. 무료 회원은 5개로 시작하고, 나중에 바꿀 수 있어요.
            </p>
            <div className="grid-3">
              {GOALS.map((g) => (
                <OptionCard key={g} selected={goal === g} onClick={() => setGoal(g)} title={`${g}개`} />
              ))}
            </div>
            <div className="card" style={{ padding: "2px 8px" }}>
              <CheckLine round checked={push} onToggle={() => setPush((p) => !p)}>
                학습 리마인더 알림 받기 (권장)
              </CheckLine>
            </div>
          </div>
        )}

        <div style={{ height: 20 }} />
        {step < 2 ? (
          <Button size="lg" block disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
            다음
          </Button>
        ) : (
          <Button size="lg" block loading={busy} onClick={submit}>
            학습 시작하기 🚀
          </Button>
        )}
      </div>
    </div>
  );
}
