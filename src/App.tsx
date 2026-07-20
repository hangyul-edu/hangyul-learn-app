import {
  createBrowserRouter,
  createRoutesFromElements,
  Navigate,
  Outlet,
  Route,
  RouterProvider,
  useLocation,
} from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "./hooks/auth";
import { AppShell } from "./components/layout/AppShell";
import { APP_NAME } from "./lib/config";

import { Welcome } from "./screens/Welcome";
import { Login } from "./screens/Login";
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
import { Profile } from "./screens/Profile";
import { EditProfile } from "./screens/EditProfile";
import { Settings } from "./screens/Settings";
import { LanguageSettings } from "./screens/LanguageSettings";
import { Account } from "./screens/Account";
import { ChangePassword, ChangePhone, ChangeEmail } from "./screens/AccountChanges";
import { Support } from "./screens/Support";
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
import { PaymentMethods } from "./screens/PaymentMethods";
import { Billing } from "./screens/Billing";
import { Streak } from "./screens/Streak";
import { LevelUp } from "./screens/LevelUp";
import { Policy } from "./screens/Policy";
import { FindEmailResult } from "./screens/FindEmailResult";
import { FindEmailNoMatch } from "./screens/FindEmailNoMatch";
import { ResetPassword } from "./screens/ResetPassword";

function Splash() {
  return (
    <div className="app-frame">
      <div className="state" style={{ flex: 1, justifyContent: "center" }}>
        <div className="hangul-lg" style={{ fontSize: 56, color: "var(--brand-500)" }}>
          {APP_NAME}
        </div>
        <span className="spinner" />
      </div>
    </div>
  );
}

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
        <Route path="/welcome" element={<RequireGuest><Welcome /></RequireGuest>} />
        <Route path="/login" element={<RequireGuest><Login /></RequireGuest>} />
        <Route path="/signup" element={<RequireGuest><Signup /></RequireGuest>} />
        <Route path="/forgot" element={<RequireGuest><Forgot /></RequireGuest>} />
        <Route path="/reset-password" element={<RequireGuest><ResetPassword /></RequireGuest>} />

        {/* Legal documents — viewable by guests and signed-in users */}
        <Route path="/policy/:doc" element={<Policy />} />

        {/* Find-email success result (masked email via navigation state) */}
        <Route path="/find-email/result" element={<RequireGuest><FindEmailResult /></RequireGuest>} />

        {/* Find-email account-not-found result */}
        <Route path="/find-email/no-match" element={<RequireGuest><FindEmailNoMatch /></RequireGuest>} />

        {/* Setup (authenticated, outside tab shell) */}
        <Route path="/setup/profile" element={<RequireAuth><SetupProfile /></RequireAuth>} />
        <Route path="/setup/onboarding" element={<RequireAuth><Onboarding /></RequireAuth>} />

        {/* Main app with bottom-nav shell (the five bottom-nav tab roots) */}
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
        <Route path="/notifications" element={<RequireAuth><Notifications /></RequireAuth>} />
        <Route path="/ai" element={<RequireAuth><AiChat /></RequireAuth>} />
        <Route path="/subscription" element={<RequireAuth><Subscription /></RequireAuth>} />
        <Route path="/profile/edit" element={<RequireAuth><EditProfile /></RequireAuth>} />
        <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
        <Route path="/settings/language" element={<RequireAuth><LanguageSettings /></RequireAuth>} />
        <Route path="/account" element={<RequireAuth><Account /></RequireAuth>} />
        <Route path="/account/password" element={<RequireAuth><ChangePassword /></RequireAuth>} />
        <Route path="/account/phone" element={<RequireAuth><ChangePhone /></RequireAuth>} />
        <Route path="/account/email" element={<RequireAuth><ChangeEmail /></RequireAuth>} />
        <Route path="/support" element={<RequireAuth><Support /></RequireAuth>} />
        <Route path="/friend/invite/:token" element={<RequireAuth><InviteLanding /></RequireAuth>} />

        <Route path="*" element={<Navigate to="/home" replace />} />
    </Route>,
  ),
);

export function App() {
  return <RouterProvider router={router} />;
}
