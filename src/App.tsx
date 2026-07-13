import { Navigate, Route, Routes, useLocation } from "react-router-dom";
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
import { Points } from "./screens/Points";
import { Social } from "./screens/Social";
import { Notifications } from "./screens/Notifications";
import { AiChat } from "./screens/AiChat";
import { Subscription } from "./screens/Subscription";
import { Profile } from "./screens/Profile";
import { EditProfile } from "./screens/EditProfile";
import { Settings } from "./screens/Settings";
import { Account } from "./screens/Account";
import { ChangePassword, ChangePhone, ChangeEmail } from "./screens/AccountChanges";
import { Support } from "./screens/Support";
import { Courses, CourseDetail } from "./screens/Courses";
import { Lecture } from "./screens/Lecture";
import { Practice } from "./screens/Practice";
import { Exams, ExamPlay } from "./screens/Exams";
import { Recommendations } from "./screens/Recommendations";
import { PaymentMethods } from "./screens/PaymentMethods";
import { Billing } from "./screens/Billing";
import { Policy } from "./screens/Policy";

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

export function App() {
  return (
    <div className="app-frame">
      <Routes>
        {/* Public */}
        <Route path="/welcome" element={<RequireGuest><Welcome /></RequireGuest>} />
        <Route path="/login" element={<RequireGuest><Login /></RequireGuest>} />
        <Route path="/signup" element={<RequireGuest><Signup /></RequireGuest>} />
        <Route path="/forgot" element={<RequireGuest><Forgot /></RequireGuest>} />

        {/* Legal documents — viewable by guests and signed-in users */}
        <Route path="/policy/:doc" element={<Policy />} />

        {/* Setup (authenticated, outside tab shell) */}
        <Route path="/setup/profile" element={<RequireAuth><SetupProfile /></RequireAuth>} />
        <Route path="/setup/onboarding" element={<RequireAuth><Onboarding /></RequireAuth>} />

        {/* Main app with bottom-nav shell */}
        <Route element={<RequireAuth><AppShell /></RequireAuth>}>
          <Route path="/home" element={<Home />} />
          <Route path="/learn" element={<Learn />} />
          <Route path="/league" element={<League />} />
          <Route path="/social" element={<Social />} />
          <Route path="/profile" element={<Profile />} />
        </Route>

        {/* Detail screens (authenticated, full-screen) */}
        <Route path="/learn/conversation" element={<RequireAuth><Conversation /></RequireAuth>} />
        <Route path="/learn/topik" element={<RequireAuth><Topik /></RequireAuth>} />
        <Route path="/quiz/:quizId" element={<RequireAuth><QuizPlay /></RequireAuth>} />
        <Route path="/courses" element={<RequireAuth><Courses /></RequireAuth>} />
        <Route path="/courses/:courseId" element={<RequireAuth><CourseDetail /></RequireAuth>} />
        <Route path="/lectures/:lectureId" element={<RequireAuth><Lecture /></RequireAuth>} />
        <Route path="/lectures/:lectureId/practice" element={<RequireAuth><Practice /></RequireAuth>} />
        <Route path="/exams" element={<RequireAuth><Exams /></RequireAuth>} />
        <Route path="/exams/:examId" element={<RequireAuth><ExamPlay /></RequireAuth>} />
        <Route path="/recommend" element={<RequireAuth><Recommendations /></RequireAuth>} />
        <Route path="/account/payment" element={<RequireAuth><PaymentMethods /></RequireAuth>} />
        <Route path="/account/billing" element={<RequireAuth><Billing /></RequireAuth>} />
        <Route path="/saved" element={<RequireAuth><Saved /></RequireAuth>} />
        <Route path="/points" element={<RequireAuth><Points /></RequireAuth>} />
        <Route path="/notifications" element={<RequireAuth><Notifications /></RequireAuth>} />
        <Route path="/ai" element={<RequireAuth><AiChat /></RequireAuth>} />
        <Route path="/subscription" element={<RequireAuth><Subscription /></RequireAuth>} />
        <Route path="/profile/edit" element={<RequireAuth><EditProfile /></RequireAuth>} />
        <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
        <Route path="/account" element={<RequireAuth><Account /></RequireAuth>} />
        <Route path="/account/password" element={<RequireAuth><ChangePassword /></RequireAuth>} />
        <Route path="/account/phone" element={<RequireAuth><ChangePhone /></RequireAuth>} />
        <Route path="/account/email" element={<RequireAuth><ChangeEmail /></RequireAuth>} />
        <Route path="/support" element={<RequireAuth><Support /></RequireAuth>} />

        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </div>
  );
}
