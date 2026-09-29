import {
  createBrowserRouter,
  createRoutesFromElements,
  Navigate,
  Outlet,
  Route,
  RouterProvider,
  useLocation,
} from "react-router-dom";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { useAuth } from "./hooks/auth";
import { useI18n } from "./i18n";
import { AppShell } from "./components/layout/AppShell";

import { Splash } from "./screens/Splash";
import { Welcome } from "./screens/Welcome";
import { Login } from "./screens/Login";
import { AuthComplete } from "./screens/AuthComplete";
import { Signup } from "./screens/Signup";
import { Forgot } from "./screens/Forgot";
import { SetupProfile } from "./screens/SetupProfile";
import { Onboarding } from "./screens/Onboarding";
import { Home } from "./screens/Home";
import { Learn } from "./screens/Learn";
import { Conversation } from "./screens/Conversation";
import { Topik } from "./screens/Topik";
import { QuizPlay } from "./screens/QuizPlay";
import { Saved } from "./screens/Saved";
import { League } from "./screens/League";
import { LeagueHistory } from "./screens/LeagueHistory";
import { LeagueResult } from "./screens/LeagueResult";
import { Social } from "./screens/Social";
import { InviteLanding } from "./screens/InviteLanding";
import { Notifications } from "./screens/Notifications";
import { AiChat } from "./screens/AiChat";
import { Subscription } from "./screens/Subscription";
import { SubscriptionPurchase } from "./screens/SubscriptionPurchase";
import { Profile } from "./screens/Profile";
import { EditProfile } from "./screens/EditProfile";
import { Settings } from "./screens/Settings";
import { LanguageSettings } from "./screens/LanguageSettings";
import { Account } from "./screens/Account";
import { ChangePassword, ChangePhone, ChangeEmail } from "./screens/AccountChanges";
import { Faq } from "./screens/Faq";
import { FaqDetail } from "./screens/FaqDetail";
import { NoticeList } from "./screens/NoticeList";
import { NoticeDetail } from "./screens/NoticeDetail";
import { AttendanceGate } from "./components/AttendanceGate";
import { OfflineGate } from "./components/OfflineScreen";
import { CourseDetail } from "./screens/Courses";
import { LectureHome } from "./screens/LectureHome";
import { Lecture } from "./screens/Lecture";
import { Practice } from "./screens/Practice";
import { Exams, ExamPlay } from "./screens/Exams";
import { Recommendations } from "./screens/Recommendations";
import { PersonalizedSettings } from "./screens/PersonalizedSettings";
import { TrackSettings } from "./screens/TrackSettings";
import { Personalized } from "./screens/Personalized";
import { SessionConversation } from "./screens/SessionConversation";
import { SessionTopik } from "./screens/SessionTopik";
import { SessionReview } from "./screens/SessionReview";
import { PaymentMethods } from "./screens/PaymentMethods";
import { Billing } from "./screens/Billing";
import { Streak } from "./screens/Streak";
import { LearningManagement } from "./screens/LearningManagement";
import { LevelUp } from "./screens/LevelUp";
import { Policy, PolicyList } from "./screens/Policy";
import { FindEmailResult } from "./screens/FindEmailResult";
import { FindEmailNoMatch } from "./screens/FindEmailNoMatch";
import { ResetPassword } from "./screens/ResetPassword";
import { LanguagePicker } from "./screens/LanguagePicker";
import { loadStoredLanguage } from "./lib/language";


function RequireAuth({ children }: { children: ReactNode }) {
  const { status, me } = useAuth();
  const loc = useLocation();
  if (status === "booting") return <Splash />;
  if (status === "signed-out") return <Navigate to="/welcome" replace state={{ from: loc.pathname }} />;
  // Signed in but profile never set up → force profile setup.
  if (me && !me.nickname && !loc.pathname.startsWith("/setup")) return <Navigate to="/setup/profile" replace />;
  return <>{children}</>;
}

function RequireGuest({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  if (status === "booting") return <Splash />;
  if (status === "signed-in") return <Navigate to="/home" replace />;
  // First launch: AME-001 asks which language to start in before anything else.
  // Once a choice is stored (or the user is signed in and takes it from their
  // profile) this never fires again.
  if (loadStoredLanguage() === null) return <Navigate to="/setup/language" replace />;
  return <>{children}</>;
}

/** Root layout — the phone frame; nested routes render into the outlet. */
function AppFrame() {
  return (
    <div className="app-frame">
      <Outlet />
    </div>
  );
}

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route element={<AppFrame />}>
        {/* Public */}
        {/* First-run language chooser — sits ahead of every guest screen. */}
        <Route path="/setup/language" element={<LanguagePicker />} />
        <Route path="/welcome" element={<RequireGuest><Welcome /></RequireGuest>} />
        <Route path="/login" element={<RequireGuest><Login /></RequireGuest>} />
        <Route path="/signup" element={<RequireGuest><Signup /></RequireGuest>} />
        <Route path="/forgot" element={<RequireGuest><Forgot /></RequireGuest>} />
        <Route path="/reset-password" element={<RequireGuest><ResetPassword /></RequireGuest>} />
        {/* Social-login callback landing — swaps the one-time code for tokens.
            Unguarded so the exchange can set the session without a guard race. */}
        <Route path="/auth/complete" element={<AuthComplete />} />

        {/* Legal documents — viewable by guests and signed-in users */}
        <Route path="/policy" element={<PolicyList />} />
        <Route path="/policy/:doc" element={<Policy />} />

        {/* Find-email success result (masked email via navigation state) */}
        <Route path="/find-email/result" element={<RequireGuest><FindEmailResult /></RequireGuest>} />

        {/* Find-email account-not-found result */}
        <Route path="/find-email/no-match" element={<RequireGuest><FindEmailNoMatch /></RequireGuest>} />

        {/* Setup (authenticated, outside tab shell) */}
        <Route path="/setup/profile" element={<RequireAuth><SetupProfile /></RequireAuth>} />
        <Route path="/setup/onboarding" element={<RequireAuth><Onboarding /></RequireAuth>} />

        {/* Main app with bottom-nav shell (the five bottom-nav tab roots, plus /learn and /social) */}
        <Route element={<RequireAuth><AppShell /></RequireAuth>}>
          <Route path="/home" element={<Home />} />
          <Route path="/learn" element={<Learn />} />
          <Route path="/courses" element={<LectureHome />} />
          <Route path="/recommend" element={<Personalized />} />
          <Route path="/league" element={<League />} />
          <Route path="/social" element={<Social />} />
          <Route path="/profile" element={<Profile />} />
        </Route>

        {/* Detail screens (authenticated, full-screen) */}
        <Route path="/learn/conversation" element={<RequireAuth><Conversation /></RequireAuth>} />
        <Route path="/learn/topik" element={<RequireAuth><Topik /></RequireAuth>} />
        <Route path="/quiz/:quizId" element={<RequireAuth><QuizPlay /></RequireAuth>} />
        <Route path="/courses/:courseId" element={<RequireAuth><CourseDetail /></RequireAuth>} />
        <Route path="/recommend/sentences" element={<RequireAuth><Recommendations /></RequireAuth>} />
        <Route path="/recommend/settings" element={<RequireAuth><PersonalizedSettings /></RequireAuth>} />
        <Route path="/recommend/settings/:category" element={<RequireAuth><TrackSettings /></RequireAuth>} />
        <Route path="/session/conversation" element={<RequireAuth><SessionConversation /></RequireAuth>} />
        <Route path="/session/topik" element={<RequireAuth><SessionTopik /></RequireAuth>} />
        <Route path="/review/question/:quizId" element={<RequireAuth><SessionReview /></RequireAuth>} />
        <Route path="/review/sentence/:sentenceId" element={<RequireAuth><SessionConversation /></RequireAuth>} />
        <Route path="/level-up" element={<RequireAuth><LevelUp /></RequireAuth>} />
        <Route path="/lectures/:lectureId" element={<RequireAuth><Lecture /></RequireAuth>} />
        <Route path="/lectures/:lectureId/practice" element={<RequireAuth><Practice /></RequireAuth>} />
        <Route path="/exams" element={<RequireAuth><Exams /></RequireAuth>} />
        <Route path="/exams/:examId" element={<RequireAuth><ExamPlay /></RequireAuth>} />
        <Route path="/account/payment" element={<RequireAuth><PaymentMethods /></RequireAuth>} />
        <Route path="/account/billing" element={<RequireAuth><Billing /></RequireAuth>} />
        <Route path="/saved" element={<RequireAuth><Saved /></RequireAuth>} />
        <Route path="/league/history" element={<RequireAuth><LeagueHistory /></RequireAuth>} />
        <Route path="/league/result" element={<RequireAuth><LeagueResult /></RequireAuth>} />
        {/* My Points lives in the League section (top + bottom nav). */}
        <Route path="/points" element={<Navigate to="/league?tab=points" replace />} />
        <Route path="/streak" element={<RequireAuth><Streak /></RequireAuth>} />
        <Route path="/learning-management" element={<RequireAuth><LearningManagement /></RequireAuth>} />
        <Route path="/notifications" element={<RequireAuth><Notifications /></RequireAuth>} />
        <Route path="/ai" element={<RequireAuth><AiChat /></RequireAuth>} />
        <Route path="/subscription" element={<RequireAuth><Subscription /></RequireAuth>} />
        <Route path="/subscription/start" element={<RequireAuth><SubscriptionPurchase /></RequireAuth>} />
        <Route path="/profile/edit" element={<RequireAuth><EditProfile /></RequireAuth>} />
        <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
        <Route path="/settings/language" element={<RequireAuth><LanguageSettings /></RequireAuth>} />
        <Route path="/account" element={<RequireAuth><Account /></RequireAuth>} />
        <Route path="/account/password" element={<RequireAuth><ChangePassword /></RequireAuth>} />
        <Route path="/account/phone" element={<RequireAuth><ChangePhone /></RequireAuth>} />
        <Route path="/account/email" element={<RequireAuth><ChangeEmail /></RequireAuth>} />
        <Route path="/faq" element={<RequireAuth><Faq /></RequireAuth>} />
        <Route path="/faq/:faqId" element={<RequireAuth><FaqDetail /></RequireAuth>} />
        <Route path="/more/notices" element={<RequireAuth><NoticeList /></RequireAuth>} />
        <Route path="/more/notices/:noticeId" element={<RequireAuth><NoticeDetail /></RequireAuth>} />
        <Route path="/friend/invite/:token" element={<RequireAuth><InviteLanding /></RequireAuth>} />

        <Route path="*" element={<Navigate to="/home" replace />} />
    </Route>,
  ),
);

/**
 * Adopts `app_language` from the signed-in profile so the choice follows the
 * user across devices. The provider ignores it once a local choice exists, so
 * a profile refetch can never override what the user picked here.
 */
function LanguageSync() {
  const { me } = useAuth();
  const { adoptProfileLanguage } = useI18n();
  useEffect(() => {
    adoptProfileLanguage(me?.app_language);
  }, [me?.app_language, adoptProfileLanguage]);
  return null;
}

export function App() {
  return (
    <OfflineGate>
      <LanguageSync />
      <RouterProvider router={router} />
      {/* App-root daily attendance: fires the check-in once per signed-in
          session and shows the completion modal for a fresh, points-awarding
          check-in (overlays whatever screen is active). */}
      <AttendanceGate />
    </OfflineGate>
  );
}
