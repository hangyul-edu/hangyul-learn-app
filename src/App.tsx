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
import { useAccountLanguage } from "./hooks/useAccountLanguage";
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
import { Saved } from "./screens/Saved";
import { League } from "./screens/League";
import { LeagueHistory } from "./screens/LeagueHistory";
import { LeagueResult } from "./screens/LeagueResult";
import { Social } from "./screens/Social";
import { InviteLanding } from "./screens/InviteLanding";
import { Notifications } from "./screens/Notifications";
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
import { useDeviceTimezoneSync } from "./hooks/useDeviceTimezoneSync";
import { OfflineGate, OfflineScreen } from "./components/OfflineScreen";
import { CourseRedirect, SeriesPage } from "./screens/Courses";
import { LectureHome } from "./screens/LectureHome";
import { Lecture } from "./screens/Lecture";
import { Practice } from "./screens/Practice";
import { SpeakPractice } from "./screens/SpeakPractice";
import { PersonalizedSettings } from "./screens/PersonalizedSettings";
import { TrackSettings } from "./screens/TrackSettings";
import { Personalized } from "./screens/Personalized";
import { SessionConversation } from "./screens/SessionConversation";
import { SessionTopik } from "./screens/SessionTopik";
import { SessionReview } from "./screens/SessionReview";
import { PaymentMethods } from "./screens/PaymentMethods";
import { Streak } from "./screens/Streak";
import { LearningManagement } from "./screens/LearningManagement";
import { Policy, PolicyList } from "./screens/Policy";
import { FindEmailResult } from "./screens/FindEmailResult";
import { FindEmailNoMatch } from "./screens/FindEmailNoMatch";
import { ResetPassword } from "./screens/ResetPassword";
import { LanguagePicker } from "./screens/LanguagePicker";
import { loadStoredLanguage } from "./lib/language";
import { SocialSignupTerms } from "./screens/SocialSignupTerms";
import { LineEmailConsent, LINE_EMAIL_CONSENT_PATH } from "./screens/LineEmailConsent";
import { SOCIAL_PHONE_PATH, SOCIAL_TERMS_PATH, nextSetupPath } from "./hooks/loginFlow";
import { SOCIAL_SIGNUP_PHONE_PATH } from "./hooks/socialSignup";


export function RequireAuth({ children }: { children: ReactNode }) {
  const { status, me, retryStartup } = useAuth();
  const loc = useLocation();
  if (status === "booting") return <Splash />;
  if (status === "unreachable") return <OfflineScreen cause="unreachable" onRetry={retryStartup} />;
  if (status === "signed-out") return <Navigate to="/welcome" replace state={{ from: loc.pathname }} />;
  // An older social account without a phone number verifies one before
  // anything else, straight after sign-in (the server reports the step until
  // a number is saved). A first social sign-in verifies its number before any
  // account exists, on its own route (SOCIAL_SIGNUP_PHONE_PATH).
  const onPhone = loc.pathname === SOCIAL_PHONE_PATH;
  if (me?.phone_verification_pending && !onPhone) return <Navigate to={SOCIAL_PHONE_PATH} replace />;
  if (me && !me.phone_verification_pending && onPhone) return <Navigate to={nextSetupPath(me)} replace />;
  // A first social login that has not accepted the signup agreements → the
  // terms step comes next (the server enforces it too). Not while the phone
  // step is showing: it comes first, and sending it to the terms would bounce
  // straight back here.
  const onTerms = loc.pathname === SOCIAL_TERMS_PATH;
  if (me?.terms_agreement_pending && !onTerms && !onPhone) return <Navigate to={SOCIAL_TERMS_PATH} replace />;
  if (me && !me.terms_agreement_pending && onTerms) return <Navigate to={nextSetupPath(me)} replace />;
  // Signed in but profile never set up → force profile setup.
  if (me && !me.nickname && !onTerms && !loc.pathname.startsWith("/setup")) return <Navigate to="/setup/profile" replace />;
  return <>{children}</>;
}

function RequireGuest({ children }: { children: ReactNode }) {
  const { status, retryStartup } = useAuth();
  if (status === "booting") return <Splash />;
  // A stored session that could not be checked: not a guest, not yet signed in.
  if (status === "unreachable") return <OfflineScreen cause="unreachable" onRetry={retryStartup} />;
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

/**
 * Addresses of retired screens, and the screen that does their job now.
 *
 * The old Learn hub (/learn) and its screens were replaced by 맞춤 학습
 * (/recommend) and lectures, and the old billing page by the payment history
 * on 구독 관리. Their addresses still arrive from notifications sent before
 * (stored deep links, pushes already on a phone) and from bookmarks, so each
 * opens its successor rather than falling through to home.
 */
export const RETIRED_SCREENS: readonly (readonly [path: string, to: string])[] = [
  ["/learn", "/recommend"],
  ["/learn/conversation", "/recommend?track=conversation"],
  ["/learn/topik", "/recommend?track=topik"],
  ["/quiz/:quizId", "/recommend?track=topik"],
  ["/exams/*", "/recommend?track=topik"],
  ["/recommend/sentences", "/recommend?track=conversation"],
  // The AI tutor is the chatbot inside lectures.
  ["/ai", "/courses"],
  // Payment history is listed on 구독 관리.
  ["/account/billing", "/subscription"],
  // League notifications once linked /leagues/{season}/{group}, an address
  // the app never had; the league screen shows the member's current league.
  ["/leagues/*", "/league"],
];

/** Opens `to`, keeping the old address's query and fragment (`to`'s own
 * parameters win), so a tracked or parameterised old link loses nothing. */
export function RetiredRedirect({ to }: { to: string }) {
  const { search, hash } = useLocation();
  const [pathname, own = ""] = to.split("?");
  const params = new URLSearchParams(search);
  new URLSearchParams(own).forEach((value, key) => params.set(key, value));
  const query = params.toString();
  return <Navigate to={{ pathname, search: query ? `?${query}` : "", hash }} replace />;
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
        <Route path={LINE_EMAIL_CONSENT_PATH} element={<RequireGuest><LineEmailConsent /></RequireGuest>} />
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

        {/* Social signup's terms step: after a first social login, before the profile. */}
        <Route path={SOCIAL_TERMS_PATH} element={<RequireAuth><SocialSignupTerms /></RequireAuth>} />

        {/* Setup (authenticated, outside tab shell) */}
        {/* A first social sign-in's phone step: no account (and no session) yet. */}
        <Route path={SOCIAL_SIGNUP_PHONE_PATH} element={<ChangePhone mode="signup" />} />
        <Route path={SOCIAL_PHONE_PATH} element={<RequireAuth><ChangePhone mode="setup" /></RequireAuth>} />
        <Route path="/setup/profile" element={<RequireAuth><SetupProfile /></RequireAuth>} />
        <Route path="/setup/onboarding" element={<RequireAuth><Onboarding /></RequireAuth>} />

        {/* Main app with bottom-nav shell (the five bottom-nav tab roots, plus /social) */}
        <Route element={<RequireAuth><AppShell /></RequireAuth>}>
          <Route path="/home" element={<Home />} />
          <Route path="/courses" element={<LectureHome />} />
          <Route path="/recommend" element={<Personalized />} />
          <Route path="/league" element={<League />} />
          <Route path="/social" element={<Social />} />
          <Route path="/profile" element={<Profile />} />
        </Route>

        {/* Detail screens (authenticated, full-screen) */}
        {RETIRED_SCREENS.map(([path, to]) => (
          <Route key={path} path={path} element={<RetiredRedirect to={to} />} />
        ))}
        <Route path="/series/:seriesId" element={<RequireAuth><SeriesPage /></RequireAuth>} />
        {/* Older links to a course open its first series. */}
        <Route path="/courses/:courseId" element={<RequireAuth><CourseRedirect /></RequireAuth>} />
        <Route path="/recommend/settings" element={<RequireAuth><PersonalizedSettings /></RequireAuth>} />
        <Route path="/recommend/settings/:category" element={<RequireAuth><TrackSettings /></RequireAuth>} />
        <Route path="/session/conversation" element={<RequireAuth><SessionConversation /></RequireAuth>} />
        <Route path="/session/topik" element={<RequireAuth><SessionTopik /></RequireAuth>} />
        <Route path="/review/question/:quizId" element={<RequireAuth><SessionReview /></RequireAuth>} />
        <Route path="/review/sentence/:sentenceId" element={<RequireAuth><SessionConversation /></RequireAuth>} />
        <Route path="/lectures/:lectureId" element={<RequireAuth><Lecture /></RequireAuth>} />
        <Route path="/lectures/:lectureId/practice" element={<RequireAuth><Practice /></RequireAuth>} />
        <Route path="/lectures/:lectureId/speak" element={<RequireAuth><SpeakPractice /></RequireAuth>} />
        <Route path="/account/payment" element={<RequireAuth><PaymentMethods /></RequireAuth>} />
        <Route path="/saved" element={<RequireAuth><Saved /></RequireAuth>} />
        <Route path="/league/history" element={<RequireAuth><LeagueHistory /></RequireAuth>} />
        <Route path="/league/result" element={<RequireAuth><LeagueResult /></RequireAuth>} />
        {/* My Points lives in the League section (top + bottom nav). */}
        <Route path="/points" element={<Navigate to="/league?tab=points" replace />} />
        <Route path="/streak" element={<RequireAuth><Streak /></RequireAuth>} />
        <Route path="/learning-management" element={<RequireAuth><LearningManagement /></RequireAuth>} />
        <Route path="/notifications" element={<RequireAuth><Notifications /></RequireAuth>} />
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

/** Keeps the app in the signed-in account's language (hooks/useAccountLanguage). */
function LanguageSync() {
  useAccountLanguage();
  return null;
}

/** Keeps the server on the device's timezone — the clock for every daily
 * boundary (see hooks/useDeviceTimezoneSync). */
function TimezoneSync() {
  useDeviceTimezoneSync();
  return null;
}

export function App() {
  return (
    <OfflineGate>
      <LanguageSync />
      <TimezoneSync />
      <RouterProvider router={router} />
      {/* App-root daily attendance: fires the check-in once per signed-in
          session and shows the completion modal for a fresh, points-awarding
          check-in (overlays whatever screen is active). */}
      <AttendanceGate />
    </OfflineGate>
  );
}
