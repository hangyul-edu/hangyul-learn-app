import { http } from "../lib/http";
import type {
  AppSettings,
  Banner,
  Course,
  DashboardSummary,
  ExamResult,
  ExamSet,
  Faq,
  Friend,
  FriendRequest,
  Invoice,
  PaymentRecovery,
  LeaguePosition,
  LeagueSeason,
  LearningPreferences,
  Lecture,
  Me,
  MySubscription,
  SessionFinalizeResult,
  NicknameCheck,
  Notice,
  NotificationItem,
  NotificationSection,
  Page,
  PaymentMethod,
  Plan,
  PointsBalance,
  ChatMessage,
  Quiz,
  TopikQuestionType,
  QuizAttemptResult,
  RankingResponse,
  RecQuota,
  SavedSentencesPage,
  Sentence,
  SignupResponse,
  SocialProvider,
  SpeechAttempt,
  StatsResp,
  StreakCalendarResp,
  TokenResponse,
  VerificationConfirm,
  VerificationStart,
} from "../lib/types";

/* ------------------------------- Auth ------------------------------- */
export const authApi = {
  startPhone: (phone: string, purpose: string) =>
    http.post<VerificationStart>("/auth/phone/verification", { phone, purpose }, { auth: false }),
  confirmPhone: (verification_id: string, code: string) =>
    http.post<VerificationConfirm>("/auth/phone/verification/confirm", { verification_id, code }, { auth: false }),
  startEmail: (email: string) =>
    http.post<VerificationStart>("/auth/email/verification", { email }, { auth: false }),
  confirmEmail: (verification_id: string, code: string) =>
    http.post<VerificationConfirm>("/auth/email/verification/confirm", { verification_id, code }, { auth: false }),
  signup: (body: Record<string, unknown>) =>
    http.post<SignupResponse>("/auth/signup/email", body, { auth: false }),
  login: (email: string, password: string, auto_login: boolean) =>
    http.post<TokenResponse>("/auth/login/email", { email, password, auto_login }, { auth: false }),
  social: (provider: SocialProvider, id_token: string) =>
    http.post<TokenResponse>("/auth/login/social", { provider, id_token }, { auth: false }),
  recoverEmail: (verification_token: string, name: string) =>
    http.post<{ email: string }>("/auth/email/recover", { verification_token, name }, { auth: false }),
  resetVerify: (email: string, phone_verification_token: string) =>
    http.post<{ reset_token: string; expires_at: string }>(
      "/auth/password/reset/verify",
      { email, phone_verification_token },
      { auth: false },
    ),
  resetPassword: (reset_token: string, new_password: string, new_password_confirmation: string) =>
    http.post<void>("/auth/password/reset", { reset_token, new_password, new_password_confirmation }, { auth: false }),
  changePassword: (current_password: string, new_password: string, confirm_new_password: string) =>
    http.post<void>("/auth/password/change", { current_password, new_password, confirm_new_password }),
  changePhone: (phone: string, phone_verification_token: string, nationality?: string) =>
    http.post<{ phone: string }>("/auth/phone/change", { phone, phone_verification_token, nationality }),
  startEmailChange: (email: string) => http.post<VerificationStart>("/auth/email/change/verification", { email }),
  confirmEmailChange: (verification_id: string, code: string) =>
    http.post<VerificationConfirm>("/auth/email/change/verification/confirm", { verification_id, code }),
  changeEmail: (email: string, email_verification_token: string) =>
    http.post<{ email: string }>("/auth/email/change", { email, email_verification_token }),
  deleteAccount: (password?: string | null) => http.del<void>("/auth/account", { body: { password } }),
};

/* ------------------------------- User ------------------------------- */
export const userApi = {
  me: () => http.get<Me>("/users/me"),
  checkNickname: (nickname: string) =>
    http.post<NicknameCheck>("/users/check-nickname", { nickname }, { auth: false }),
  registerProfile: (body: Record<string, unknown>) => http.post<Me>("/users/me/profile", body),
  updateProfile: (body: Record<string, unknown>) => http.patch<Me>("/users/me/profile", body),
  updateMe: (body: Record<string, unknown>) => http.patch<Me>("/users/me", body),
  uploadImage: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return http.upload<{ profile_image_url: string }>("/users/me/profile-image/upload", fd);
  },
};

/* ---------------------------- Onboarding ---------------------------- */
export const onboardingApi = {
  submit: (body: Record<string, unknown>) =>
    http.post<{ recommended_track_id: string; recommended_level: number }>("/onboarding/responses", body),
};

/* ---------------------------- Dashboard ----------------------------- */
export const dashboardApi = {
  summary: () => http.get<DashboardSummary>("/dashboard/summary"),
  streak: () => http.get<{ current: number; best: number; freeze_tokens: number; last_study_date: string | null }>(
    "/dashboard/streak",
  ),
};

/* ----------------------------- Sentences ---------------------------- */
export const sentenceApi = {
  list: (params: { level?: number; topic?: string; cursor?: string; limit?: number }) =>
    http.get<Page<Sentence>>("/sentences", params),
  recent: (cursor?: string) => http.get<Page<Sentence>>("/sentences/recently-studied", { cursor, limit: 20 }),
  get: (id: string) => http.get<Sentence>(`/sentences/${id}`),
  audio: (id: string) => http.get<{ url: string }>(`/sentences/${id}/audio`),
  bookmark: (id: string) => http.post<unknown>(`/sentences/${id}/bookmark`),
  unbookmark: (id: string) => http.del<void>(`/sentences/${id}/bookmark`),
  speechAttempt: (id: string, audio: Blob, filename: string, source = "custom") => {
    const fd = new FormData();
    fd.append("audio", audio, filename);
    fd.append("source", source);
    return http.upload<SpeechAttempt>(`/sentences/${id}/speech-attempts`, fd);
  },
  coach: () => http.get<{ targets: unknown[]; summary: string; based_on_attempts: number }>(
    "/sentences/pronunciation-coach",
  ),
  saved: (params: { save_type?: string; sort?: string; q?: string; cursor?: string }) =>
    http.get<SavedSentencesPage>("/saved-sentences", { limit: 20, ...params }),
  removeSaved: (id: string) => http.del<unknown>(`/saved-sentences/${id}`),
  // Remove only the incorrect-answer (auto_wrong) record; keeps any bookmark.
  clearAutoSave: (id: string) => http.del<unknown>(`/saved-sentences/${id}/auto-save`),
  // Mark a saved sentence reviewed (updates last_reviewed_at) — on audio play.
  markViewed: (id: string) => http.post<unknown>(`/saved-sentences/${id}/view`),
};

/* ------------------------------ Quizzes ----------------------------- */
export const quizApi = {
  list: (params: { answer_format?: string; level?: number; limit?: number }) =>
    http.get<{ items: Quiz[] }>("/quizzes", { limit: 20, ...params }),
  daily: () => http.get<{ items: Quiz[]; date?: string }>("/quizzes/daily"),
  get: (id: string) => http.get<Quiz>(`/quizzes/${id}`),
  attempt: (id: string, body: Record<string, unknown>) => http.post<QuizAttemptResult>(`/quizzes/${id}/attempt`, body),
  bookmark: (id: string) => http.post<unknown>(`/quizzes/${id}/bookmark`),
  unbookmark: (id: string) => http.del<void>(`/quizzes/${id}/bookmark`),
  // Remove only the incorrect-answer (auto_wrong) record; keeps any bookmark.
  clearAutoSave: (id: string) => http.del<unknown>(`/quizzes/${id}/auto-save`),
  // Mark a saved question as opened for review (updates last_reviewed_at) —
  // the question-side mirror of sentenceApi.markViewed.
  markViewed: (id: string) => http.post<unknown>(`/quizzes/${id}/view`),
  bookmarks: (params: { save_type?: string; section?: string; sort?: string; q?: string; cursor?: string }) =>
    http.get<{ items: Quiz[]; next_cursor?: string | null }>("/quizzes/bookmarks", { limit: 20, ...params }),
  attempts: (cursor?: string) =>
    http.get<{ items: unknown[]; stats?: Record<string, number>; next_cursor?: string | null }>(
      "/quizzes/attempts/me",
      { cursor, limit: 20 },
    ),
};

/* ---------------------- Learning / recommend / AI -------------------- */
export const learnApi = {
  myLearning: () => http.get<{ tracks: { track_id: string; kind: string; current_level: number; max_level: number }[] }>("/me/learning"),
  /** Record a completed learning session (duration + category). Finalizes a
   *  pending level-up and — for a personalized (custom) session that earned
   *  points — creates the "학습 완료! +Np 적립" notification. */
  recordSession: (body: { session_type: "sentence" | "review" | "lecture"; duration_seconds: number; category?: "conversation" | "topik"; lecture_id?: string }) =>
    http.post<SessionFinalizeResult>("/learning/sessions", body),
  courses: (trackId: string, cursor?: string) =>
    http.get<{ items: Course[]; next_cursor: string | null; has_more: boolean }>(`/tracks/${trackId}/courses`, { cursor, limit: 6, lessons_per_course: 6 }),
  // Per-course horizontal lecture pagination (continues each course's lessons_next_cursor).
  courseLessons: (courseId: string, cursor?: string | null) =>
    http.get<{ items: Lecture[]; next_cursor: string | null; has_more: boolean }>(`/courses/${courseId}/lessons`, { cursor: cursor ?? undefined, limit: 6 }),
  course: (courseId: string) => http.get<Course>(`/courses/${courseId}`),
  lecture: (lectureId: string) => http.get<Lecture>(`/lectures/${lectureId}`),
  lecturePlay: (lectureId: string) =>
    http.get<{ video: { url: string; duration_seconds: number; captions_url: string | null } }>(`/lectures/${lectureId}/play`),
  progress: (lectureId: string, position_seconds: number) =>
    http.post<{ position_seconds: number; max_watched_seconds: number; completed: boolean }>(`/lectures/${lectureId}/progress`, { position_seconds }),
  streakCalendar: (year?: number, month?: number) => http.get<StreakCalendarResp>("/learning/streak-calendar", { year, month }),
  stats: (range: string) => http.get<StatsResp>("/learning/stats", { range }),
};
export const recApi = {
  sentences: (body: { level?: number; prompt?: string; count?: number } = {}) =>
    http.post<{ track_id: string; level: number; prompt: string | null; items: Sentence[]; quota?: RecQuota }>(
      "/recommendations/sentences",
      body,
    ),
  questions: (body: { section?: string; level?: number; topik_question_type?: string; count?: number } = {}) =>
    http.post<{
      track_id: string;
      section: string | null;
      level: number;
      topik_question_type: string | null;
      items: Quiz[];
      returned_count: number;
      quota?: RecQuota;
    }>("/recommendations/questions", body),
  topikQuestionTypes: (section: string) =>
    http.get<{ section: string; items: TopikQuestionType[] }>("/recommendations/topik-question-types", { section }),
};
export const examApi = {
  list: (params: { section?: string; edition?: number; year?: number } = {}) =>
    http.get<{ items: ExamSet[] }>("/exams", params),
  get: (id: string) => http.get<ExamSet>(`/exams/${id}`),
  submit: (id: string, answers: { quiz_id: string; answer: string }[]) =>
    http.post<ExamResult>(`/exams/${id}/attempts`, { answers }),
};
export const practiceApi = {
  start: (lectureId: string, count: number) =>
    http.post<{ practice_set_id: string; items: Quiz[]; count: number }>(`/lectures/${lectureId}/practice`, { count }),
};
/** Which Toss MID the card-registration widget launches under. Domestic and
 *  international cards use different merchants; the issued billing key is
 *  region-agnostic, so only the launch config differs. */
export type CardRegion = "domestic" | "international";
type CardIntent = {
  intent_id: string;
  customer_key: string;
  widget: { client_key: string; success_url: string; fail_url: string; card_region: CardRegion };
};
type RedirectIntent = { intent_id: string; authorize_url: string; customer_key: string };

export const payApi = {
  methods: () => http.get<{ methods: PaymentMethod[] }>("/payment-methods"),
  cardIntent: (return_url: string, card_region: CardRegion = "domestic") =>
    http.post<CardIntent>("/payment-methods/cards/intent", {
      client_idempotency_key: crypto.randomUUID(),
      return_url,
      card_region,
    }),
  cardConfirm: (intent_id: string, auth_key: string) =>
    http.post<{ method: PaymentMethod }>("/payment-methods/cards/confirm", { intent_id, auth_key }),
  tosspayIntent: (return_url: string) =>
    http.post<RedirectIntent>("/payment-methods/tosspay/intent", {
      client_idempotency_key: crypto.randomUUID(),
      return_url,
    }),
  tosspayConfirm: (intent_id: string, code: string, state: string) =>
    http.post<{ method: PaymentMethod }>("/payment-methods/tosspay/confirm", { intent_id, code, state }),
  naverpayIntent: (return_url: string) =>
    http.post<RedirectIntent>("/payment-methods/naverpay/intent", {
      client_idempotency_key: crypto.randomUUID(),
      return_url,
    }),
  naverpayConfirm: (intent_id: string, reserve_id: string) =>
    http.post<{ method: PaymentMethod }>("/payment-methods/naverpay/confirm", { intent_id, reserve_id }),
  setDefault: (id: string) => http.post<void>(`/payment-methods/${id}/set-default`, {}),
  replace: (id: string, new_method_id: string) =>
    http.put<void>(`/payment-methods/${id}/replace`, { new_method_id }),
  remove: (id: string) => http.del<void>(`/payment-methods/${id}`),
};
export const billingApi = {
  invoices: (cursor?: string) => http.get<{ invoices: Invoice[]; next_cursor: string | null }>("/billing/invoices", { cursor, limit: 20 }),
  /** Consolidated failed-automatic-payment recovery state (single source of truth). */
  recovery: () => http.get<PaymentRecovery>("/billing/recovery"),
  invoice: (invoiceId: string) =>
    http.get<{ invoice: Invoice; payments: unknown[] }>(`/billing/invoices/${invoiceId}`),
  /** Retry the outstanding invoice against the user's current default method.
   *  The invoice id is the idempotency anchor — a paid invoice returns 409. */
  retryInvoice: (invoiceId: string) =>
    http.post<{ attempt_id: string; queued_at: string }>(`/billing/invoices/${invoiceId}/retry`, {}),
};
export const aiApi = {
  createConversation: () => http.post<{ conversation_id: string }>("/ai/conversations", {}),
  messages: (id: string) => http.get<{ items: unknown[] }>(`/ai/conversations/${id}/messages`),
  send: (id: string, content: string, mode = "tutor") =>
    http.post<{ reply?: string; message?: unknown }>(`/ai/conversations/${id}/messages`, { content, mode }),
  /** Start a context-anchored conversation (e.g. explain the wrong answer). */
  startConversation: (body: {
    topic?: string;
    initial_message?: string;
    auto_assistant_reply?: boolean;
    context?: Record<string, unknown>;
  }) =>
    http.post<{ conversation: { conversation_id: string; title: string }; first_assistant_message: ChatMessage | null }>(
      "/ai/conversations",
      body,
    ),
  /** Follow-up message in an existing conversation. */
  sendMessage: (id: string, content: string) =>
    http.post<{ user_message: ChatMessage; assistant_message: ChatMessage }>(
      `/ai/conversations/${id}/messages`,
      { content },
    ),
};

/* ---------------------------- Gamification -------------------------- */
export const gameApi = {
  points: () => http.get<PointsBalance>("/points/me"),
  pointsHistory: (cursor?: string) =>
    http.get<{ items: { reason: string; amount: number; occurred_at: string }[]; next_cursor: string | null }>(
      "/points/history",
      { cursor, limit: 30 },
    ),
  myLeague: () => http.get<LeaguePosition>("/leagues/me"),
  currentSeason: () => http.get<LeagueSeason>("/leagues/current"),
  // The user's live regular-league leaderboard for the CURRENT season. This is
  // the always-safe endpoint (dormant → 200 with an empty board); the old
  // `/leagues/rankings?season_id=` path did not exist and 404'd.
  currentRankings: () => http.get<RankingResponse>("/leagues/current/rankings", { limit: 30 }),
  friendRankings: () => http.get<RankingResponse>("/leagues/friends/rankings", { limit: 30 }),
  seasons: () => http.get<{ current?: { season_id: string }; items?: { season_id: string }[] }>("/leagues/seasons"),
  attendanceStatus: () => http.get<{ checked_in_today?: boolean; consecutive_days?: number }>("/attendance/me"),
  checkIn: () => http.post<{ points_awarded?: number; consecutive_days?: number }>("/attendance/check-in"),
};

/* ------------------------------ Friends ----------------------------- */
export const friendApi = {
  list: () => http.get<{ items?: Friend[]; friends?: Friend[] }>("/friends"),
  received: () => http.get<{ items?: FriendRequest[] }>("/friends/requests/received"),
  sent: () => http.get<{ items?: FriendRequest[] }>("/friends/requests/sent"),
  request: (user_id: string) => http.post<unknown>("/friends/requests", { user_id }),
  accept: (id: string) => http.post<unknown>(`/friends/requests/${id}/accept`),
  reject: (id: string) => http.post<void>(`/friends/requests/${id}/reject`),
  cancel: (id: string) => http.post<void>(`/friends/requests/${id}/cancel`),
  searchPhone: (phone: string) => http.post<{ user?: Friend | null; found?: boolean }>("/friends/search/phone", { phone }),
  recommendations: () => http.get<{ items?: unknown[] }>("/friends/recommendations", { limit: 10 }),
  remove: (id: string) => http.del<void>(`/friends/${id}`),
};

/* --------------------------- Notifications -------------------------- */
export const notifApi = {
  list: (params: { group?: string; cursor?: string }) =>
    http.get<{ sections?: NotificationSection[]; items?: NotificationItem[]; unread_count?: number; next_cursor?: string | null }>(
      "/notifications",
      { limit: 30, tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", ...params },
    ),
  /** Open the inbox → mark every notification read (clears the bell badge). */
  readAll: () => http.post<void>("/notifications/read-all"),
  settings: () => http.get<Record<string, unknown>>("/notifications/settings"),
  updateSettings: (body: Record<string, unknown>) => http.put<Record<string, unknown>>("/notifications/settings", body),
};

/* --------------------------- Subscription --------------------------- */
export const subApi = {
  plans: () => http.get<{ plans?: Plan[]; items?: Plan[] }>("/subscriptions/plans", undefined, { auth: false }),
  mine: () => http.get<MySubscription>("/subscriptions/me"),
  startTrial: (plan_id: string) => http.post<unknown>("/subscriptions/trial", { plan_id }),
  subscribe: (plan_id: string, method_id?: string) => http.post<unknown>("/subscriptions", { plan_id, method_id }),
  cancel: (reason?: string) => http.post<unknown>("/subscriptions/cancel", { reason }),
  resume: () => http.post<unknown>("/subscriptions/resume"),
  validateCoupon: (code: string) => http.post<Record<string, unknown>>("/subscriptions/coupons/validate", { code }),
  applyCoupon: (code: string) => http.post<Record<string, unknown>>("/subscriptions/coupons/apply", { code }),
  paymentMethods: () => http.get<{ items?: unknown[]; methods?: unknown[] }>("/payment-methods"),
};

/* ----------------------------- Settings ----------------------------- */
export const settingsApi = {
  get: () => http.get<AppSettings>("/settings/me"),
  update: (body: Partial<AppSettings>) => http.put<AppSettings>("/settings/me", body),
  language: () => http.get<{ app_language: string }>("/settings/me/language"),
  setLanguage: (app_language: string) => http.put<{ app_language: string }>("/settings/me/language", { app_language }),
  // Read: all categories together (for the screen that lists conversation + TOPIK).
  learning: () => http.get<LearningPreferences>("/settings/me/learning"),
  // Update: one category only (its own settings screen) — never sends the others.
  updateLearningCategory: (category: string, body: { level: number; daily_goal: number }) =>
    http.patch<LearningPreferences>(`/settings/me/learning/${category}`, body),
  // Reorder: main-screen display order only (ordered category ids).
  updateLearningOrder: (order: string[]) =>
    http.put<LearningPreferences>("/settings/me/learning/order", { order }),
};

export const bannerApi = {
  list: () => http.get<{ banners: Banner[] }>("/banners"),
};

/* ------------------------------ Support ----------------------------- */
export const supportApi = {
  faqs: (params: { category?: string; q?: string; cursor?: string }) =>
    http.get<{ items: Faq[]; next_cursor: string | null }>("/support/faqs", { limit: 50, ...params }, { auth: false }),
  notices: (cursor?: string) =>
    http.get<{ items: Notice[]; next_cursor: string | null }>("/support/notices", { cursor, limit: 20 }, { auth: false }),
};
