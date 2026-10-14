import { http } from "../lib/http";
import { API_BASE_URL } from "../lib/config";
import { randomUuid } from "../lib/uuid";
import { deviceTimeZone } from "../lib/timezone";
import { activeLanguage } from "../lib/language";
import { recordingFilename, type RecordingInfo } from "../lib/recording";
import type {
  AttendanceCheckIn,
  CheckoutQuote,
  CheckpointInteraction,
  TimezoneSync,
  Banner,
  Course,
  SeriesDetail,
  DailyLearningActivity,
  ChannelTalkIdentity,
  CancellationReason,
  CouponRedemption,
  DashboardSummary,
  ExamResult,
  ExamSet,
  Faq,
  Friend,
  FriendListResponse,
  FriendRequest,
  FriendRequestsResponse,
  ContactRecommendationsResponse,
  PhoneSearchResult,
  FriendInvitationResponse,
  ResolvedInvitationResponse,
  Invoice,
  NoticeSummary,
  PaymentRecovery,
  LeaguePosition,
  LeagueSeason,
  LeagueHistorySeasonsResponse,
  LeagueHistoryResponse,
  LeagueLifecycleResponse,
  LearningPreferences,
  LectureDetail,
  ManagementPeriod,
  ManagementStats,
  Me,
  MySubscription,
  SessionFinalizeResult,
  NicknameCheck,
  Notice,
  NotificationItem,
  NotificationSection,
  Page,
  Offers,
  PaymentMethod,
  PaymentMethodList,
  PointsBalance,
  PointsHistoryResponse,
  ChatMessage,
  Quiz,
  TopikQuestionType,
  BlankAttempt,
  BlankHint,
  QuizAttemptResult,
  RankingResponse,
  RecQuota,
  SavedSentencesPage,
  Sentence,
  SignupResponse,
  NextStep,
  SocialProvider,
  AccountDeletionBody,
  AccountDeletionMethods,
  SpeechAttempt,
  StreakCalendarResp,
  StudyAttemptResult,
  StudyCustomization,
  StudyReveal,
  StudySession,
  StudyTrack,
  TokenResponse,
  TutorAnswer,
  VerificationConfirm,
  VerificationStart,
} from "../lib/types";

/* ------------------------------- Auth ------------------------------- */
export const authApi = {
  // `language`: the SMS / email is written in the app's current language.
  startPhone: (phone: string, purpose: string) =>
    http.post<VerificationStart>(
      "/auth/phone/verification",
      { phone, purpose, language: activeLanguage() },
      { auth: false },
    ),
  confirmPhone: (verification_id: string, code: string) =>
    http.post<VerificationConfirm>("/auth/phone/verification/confirm", { verification_id, code }, { auth: false }),
  startEmail: (email: string) =>
    http.post<VerificationStart>("/auth/email/verification", { email, language: activeLanguage() }, { auth: false }),
  confirmEmail: (verification_id: string, code: string) =>
    http.post<VerificationConfirm>("/auth/email/verification/confirm", { verification_id, code }, { auth: false }),
  signup: (body: Record<string, unknown>) =>
    http.post<SignupResponse>("/auth/signup/email", body, { auth: false }),
  /** Social signup's terms step: the same agreements as email signup. */
  agreeSocialTerms: (body: Record<string, boolean>) =>
    http.post<{ next_step: NextStep }>("/auth/signup/social/agreements", body),
  login: (email: string, password: string, auto_login: boolean) =>
    http.post<TokenResponse>("/auth/login/email", { email, password, auto_login }, { auth: false }),
  // Native id_token login. `nonce` is the raw value handed to the provider SDK;
  // the server requires the token's nonce claim to match it.
  social: (provider: SocialProvider, id_token: string, nonce?: string) =>
    http.post<TokenResponse>(
      "/auth/login/social",
      nonce ? { provider, id_token, nonce } : { provider, id_token },
      { auth: false },
    ),
  // Real web login: a full-page navigation to the backend, which redirects to
  // the provider's actual authorization screen. No token is ever handled here.
  // `clientChallenge` binds the login to this browser (see hooks/socialLogin).
  // `purpose: "reauth"` re-authenticates a signed-in member (to confirm an
  // account deletion): the callback hands back a `reauth_code`, no session.
  socialStartUrl: (
    provider: SocialProvider,
    clientChallenge: string,
    returnTo = "/",
    purpose: "login" | "reauth" = "login",
  ) =>
    `${API_BASE_URL}/auth/social/${provider}/start?return_to=${encodeURIComponent(returnTo)}` +
    `&client_challenge=${encodeURIComponent(clientChallenge)}` +
    (purpose === "reauth" ? "&purpose=reauth" : ""),
  // After the provider callback, the SPA swaps the one-time login_code for
  // tokens, proving it is the browser that started the login.
  socialExchange: (login_code: string, client_verifier: string) =>
    http.post<TokenResponse>("/auth/social/exchange", { login_code, client_verifier }, { auth: false }),
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
    // `linked_sign_in`: the number belonged to an existing account and this was
    // a social sign-up's phone step — sign in to that account with these tokens.
    http.post<{ phone: string; linked_sign_in?: TokenResponse | null }>("/auth/phone/change", {
      phone,
      phone_verification_token,
      nationality,
    }),
  startEmailChange: (email: string) =>
    http.post<VerificationStart>("/auth/email/change/verification", { email, language: activeLanguage() }),
  confirmEmailChange: (verification_id: string, code: string) =>
    http.post<VerificationConfirm>("/auth/email/change/verification/confirm", { verification_id, code }),
  changeEmail: (email: string, email_verification_token: string) =>
    http.post<{ email: string }>("/auth/email/change", { email, email_verification_token }),
  deletionMethods: () => http.get<AccountDeletionMethods>("/auth/account/deletion-methods"),
  deleteAccount: (body: AccountDeletionBody) => http.del<void>("/auth/account", { body }),
};

/* ------------------------------- User ------------------------------- */
export const userApi = {
  checkNickname: (nickname: string) =>
    http.post<NicknameCheck>("/users/check-nickname", { nickname }, { auth: false }),
  registerProfile: (body: Record<string, unknown>) => http.post<Me>("/users/me/profile", body),
  updateProfile: (body: Record<string, unknown>) => http.patch<Me>("/users/me/profile", body),
  uploadImage: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return http.upload<{ profile_image_url: string }>("/users/me/profile-image/upload", fd);
  },
  /** Tell the server the device's IANA timezone — the clock for every daily
   * boundary. Idempotent; see `lib/timezoneSync.ts` for when it is called. */
  syncTimezone: (timezone: string) =>
    http.put<TimezoneSync>("/users/me/timezone", { timezone }),
};

/* ---------------------------- Onboarding ---------------------------- */
export const onboardingApi = {
  submit: (body: Record<string, unknown>) =>
    http.post<{ recommended_track_id: string; recommended_level: number }>("/onboarding/responses", body),
};

/* ---------------------------- Dashboard ----------------------------- */
export const dashboardApi = {
  summary: () => http.get<DashboardSummary>("/dashboard/summary"),
  streak: () => http.get<{ current: number; best: number; freeze_tokens: number; last_study_date: string | null; total_days: number }>(
    "/dashboard/streak",
  ),
};

/* ----------------------------- Sentences ---------------------------- */
export const sentenceApi = {
  list: (params: { level?: number; topic?: string; cursor?: string; limit?: number }) =>
    http.get<Page<Sentence>>("/sentences", params),
  get: (id: string) => http.get<Sentence>(`/sentences/${id}`),
  audio: (id: string) => http.get<{ url: string }>(`/sentences/${id}/audio`),
  bookmark: (id: string) => http.post<unknown>(`/sentences/${id}/bookmark`),
  unbookmark: (id: string) => http.del<void>(`/sentences/${id}/bookmark`),
  speechAttempt: (id: string, audio: Blob, take: RecordingInfo, source = "custom", reviewSessionId?: string) => {
    const fd = new FormData();
    fd.append("audio", audio, take.filename);
    fd.append("duration_ms", String(take.durationMs));
    fd.append("source", source);
    // Ties a review attempt to its session so points are awarded once per
    // session (a restart re-answers without re-awarding).
    if (reviewSessionId) fd.append("review_session_id", reviewSessionId);
    return http.upload<SpeechAttempt>(`/sentences/${id}/speech-attempts`, fd);
  },
  // Fill-in-the-blank answer — typed (answerText) or voice (audio). The server
  // grades authoritatively; clientRequestId makes retries idempotent.
  blankAttempt: (
    id: string,
    opts: {
      inputMode: "voice" | "keyboard";
      answerText?: string;
      audio?: Blob;
      take?: RecordingInfo;
      clientRequestId?: string;
      source?: string;
      reviewSessionId?: string;
    },
  ) => {
    const fd = new FormData();
    fd.append("input_mode", opts.inputMode);
    if (opts.answerText != null) fd.append("answer_text", opts.answerText);
    if (opts.audio) fd.append("audio", opts.audio, opts.take?.filename ?? recordingFilename(opts.audio.type));
    if (opts.take) fd.append("duration_ms", String(opts.take.durationMs));
    if (opts.clientRequestId) fd.append("client_request_id", opts.clientRequestId);
    fd.append("source", opts.source ?? "custom");
    // See speechAttempt: award review points once per session, not per restart.
    if (opts.reviewSessionId) fd.append("review_session_id", opts.reviewSessionId);
    return http.upload<BlankAttempt>(`/sentences/${id}/blank-attempts`, fd);
  },
  blankHint: (id: string, revealedCount: number, revealAll = false) =>
    http.post<BlankHint>(`/sentences/${id}/hint`, {
      revealed_count: revealedCount,
      reveal_all: revealAll,
    }),
  saved: (params: { save_type?: string; sort?: string; q?: string; cursor?: string }) =>
    http.get<SavedSentencesPage>("/saved-sentences", { limit: 20, ...params }),
  // Remove only the incorrect-answer (auto_wrong) record; keeps any bookmark.
  clearAutoSave: (id: string) => http.del<unknown>(`/saved-sentences/${id}/auto-save`),
  // Mark a saved sentence reviewed (updates last_reviewed_at) — on audio play.
  markViewed: (id: string) => http.post<unknown>(`/saved-sentences/${id}/view`),
};

/* ------------------------------ Quizzes ----------------------------- */
export const quizApi = {
  list: (params: { answer_format?: string; level?: number; limit?: number }) =>
    http.get<{ items: Quiz[] }>("/quizzes", { limit: 20, ...params }),
  daily: () => http.get<{ date: string; questions: Quiz[] }>("/quizzes/daily"),
  get: (id: string) => http.get<Quiz>(`/quizzes/${id}`),
  // Signed, short-lived CDN URL for a listening question's audio (fetched lazily
  // when the learner plays it, never embedded in the question payload).
  audio: (id: string) => http.get<{ url: string; duration_ms?: number }>(`/quizzes/${id}/audio`),
  // POST /quizzes/{id}/attempts (plural). `elapsed_ms` is required server-side;
  // default it to 0 when a caller doesn't track time. Pass `source: "review"`
  // for a saved-item review attempt (server awards review points, skips goal/level).
  attempt: (id: string, body: Record<string, unknown>) =>
    http.post<QuizAttemptResult>(`/quizzes/${id}/attempts`, { elapsed_ms: 0, ...body }),
  bookmark: (id: string) => http.post<unknown>(`/quizzes/${id}/bookmark`),
  unbookmark: (id: string) => http.del<void>(`/quizzes/${id}/bookmark`),
  // Remove only the incorrect-answer (auto_wrong) record; keeps any bookmark.
  clearAutoSave: (id: string) => http.del<unknown>(`/quizzes/${id}/auto-save`),
  // Mark a saved question as opened for review (updates last_reviewed_at) —
  // the question-side mirror of sentenceApi.markViewed.
  markViewed: (id: string) => http.post<unknown>(`/quizzes/${id}/view`),
  bookmarks: (params: { save_type?: string; section?: string; sort?: string; q?: string; cursor?: string }) =>
    http.get<{ items: Quiz[]; next_cursor?: string | null }>("/quizzes/bookmarks", { limit: 20, ...params }),
};

/* ---------------------- Learning / recommend / AI -------------------- */
export const learnApi = {
  /** Record a completed learning session (duration + category). Adds a
   *  personalized (custom) session's time to its track and, when it earned
   *  points, creates the "학습 완료! +Np 적립" notification. Never changes a
   *  level (`leveled_up` is always false). */
  recordSession: (body: { session_type: "sentence" | "review" | "lecture"; duration_seconds: number; category?: "conversation" | "topik"; lecture_id?: string }) =>
    http.post<SessionFinalizeResult>("/learning/sessions", body),
  // Catalog reads take the app language as `lang`: course, series and lesson
  // titles/descriptions come back in it where the admin wrote it, else English.
  course: (courseId: string, lang?: string) => http.get<Course>(`/courses/${courseId}`, { lang }),
  /** Courses for the Classes tab (COU-001), each with its series as cards.
   *  The tab shows series, not lessons, so one preview lesson is plenty. */
  courses: (track?: "track_conversation" | "track_topik", lang?: string) =>
    http.get<{ items: Course[]; next_cursor: string | null; has_more: boolean }>("/courses", {
      track,
      lang,
      limit: 50,
      lessons_per_course: 1,
    }),
  /** One series' lessons and its 바로 학습하기 target (COU-002). */
  series: (seriesId: string, lang?: string) => http.get<SeriesDetail>(`/series/${seriesId}`, { lang }),
  lecture: (lectureId: string, lang?: string) => http.get<LectureDetail>(`/lectures/${lectureId}`, { lang }),
  lecturePlay: (lectureId: string) =>
    http.get<{ video: { url: string; duration_seconds: number; captions_url: string | null } }>(`/lectures/${lectureId}/play`),
  /** A fresh signed playback URL only — for when the one from `lecturePlay` ran out mid-watch. */
  lectureVideo: (lectureId: string) =>
    http.get<{ lecture_id: string; video_url: string; expires_at: string }>(`/lectures/${lectureId}/video`),
  /** The full sentence / question behind a checkpoint, fetched when playback reaches it. */
  checkpointInteraction: (lectureId: string, checkpointId: string) =>
    http.get<CheckpointInteraction>(`/lectures/${lectureId}/checkpoints/${checkpointId}/interaction`),
  /** Mark a fully watched lecture complete: +100 points the first time (409 if not watched through). */
  completeLecture: (lectureId: string) =>
    http.post<{ lecture_id: string; completed: boolean; already_completed: boolean; xp_earned: number; points_earned: number }>(
      `/lectures/${lectureId}/complete`,
    ),
  /** The lecture's repeat-after-me checkpoints, in playback order (COU-014). */
  speakPractice: (lectureId: string) =>
    http.get<{ lecture_id: string; items: { checkpoint_id: string; at_second: number; sentence_id: string }[] }>(
      `/lectures/${lectureId}/speak-practice`,
    ),
  progress: (lectureId: string, position_seconds: number) =>
    http.post<{ position_seconds: number; max_watched_seconds: number; completed: boolean }>(`/lectures/${lectureId}/progress`, { position_seconds }),
  streakCalendar: (year?: number, month?: number) => http.get<StreakCalendarResp>("/learning/streak-calendar", { year, month }),
  /** Learning Management dashboard: today's summary + period chart + totals. */
  management: (period: ManagementPeriod) =>
    http.get<ManagementStats>("/learning/management", { period }),
  /**
   * Record a qualifying learning activity so today counts as a learning day and
   * the sun lights up. Idempotent per day (the member's local day, in the
   * device timezone the app syncs) — safe to fire repeatedly.
   * The app calls it when a sentence / TOPIK question is displayed and on
   * lecture playback (see `useMarkStudied` / `useRecordDisplayedItem`).
   */
  recordActivity: (activity_type: "conversation" | "topik" | "lecture", content_id?: string) =>
    http.post<DailyLearningActivity>("/learning/activity", { activity_type, content_id: content_id ?? null }),
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
/** Adaptive study sessions: server-assembled sets from reviewed content, graded
 *  on the server, customizable in natural language, with a grounded tutor. */
export const studyApi = {
  /** Start, or resume the active session on the track (same TOPIK scope). */
  start: (body: {
    track: StudyTrack;
    client_request_id: string;
    activity_count?: number;
    explanation_language?: "ko" | "en";
    topik_section?: "listening" | "reading";
    topik_question_type?: string;
  }) => http.post<StudySession>("/study-sessions", body),
  present: (sessionId: string, activityId: string) =>
    http.post<void>(`/study-sessions/${sessionId}/activities/${activityId}/present`),
  attempt: (sessionId: string, activityId: string, body: { answer: string; client_request_id: string; duration_ms?: number }) =>
    http.post<StudyAttemptResult>(`/study-sessions/${sessionId}/activities/${activityId}/attempts`, body),
  voiceAttempt: (sessionId: string, activityId: string, audio: Blob, take: RecordingInfo, clientRequestId: string) => {
    const fd = new FormData();
    fd.append("audio", audio, take.filename);
    fd.append("duration_ms", String(take.durationMs));
    fd.append("client_request_id", clientRequestId);
    return http.upload<StudyAttemptResult>(`/study-sessions/${sessionId}/activities/${activityId}/voice-attempts`, fd);
  },
  hint: (sessionId: string, activityId: string) =>
    http.post<{ hint: string | null; revealed_text: string | null }>(`/study-sessions/${sessionId}/activities/${activityId}/hint`),
  reveal: (sessionId: string, activityId: string) =>
    http.post<StudyReveal>(`/study-sessions/${sessionId}/activities/${activityId}/reveal`),
  customize: (sessionId: string, body: { prompt: string; expected_revision: number; client_request_id: string }) =>
    http.post<StudyCustomization>(`/study-sessions/${sessionId}/customizations`, body),
  complete: (sessionId: string) => http.post<StudySession>(`/study-sessions/${sessionId}/complete`),
  abandon: (sessionId: string) => http.post<StudySession>(`/study-sessions/${sessionId}/abandon`),
  askTutor: (sessionId: string, activityId: string, body: { question: string; client_request_id: string; language: "ko" | "en" }) =>
    http.post<TutorAnswer>(`/study-sessions/${sessionId}/activities/${activityId}/tutor`, body),
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
export type { CardRegion } from "../lib/types";
/** `widget` is what the Toss JS SDK's `requestBillingAuth` needs; an empty
 *  `client_key` means card billing is not configured on the server. */
type CardIntent = {
  intent_id: string;
  customer_key: string;
  widget: { client_key: string; success_url: string; fail_url: string; card_region: "domestic" };
};
/** One currency an overseas card can be registered in (charged only in it). */
export type InternationalCurrencyOption = {
  currency: string;
  requires_holder_birth_date: boolean;
  /** Advisory list of networks for a brand hint; Toss makes the final call. */
  accepted_brands: string[];
};
/** GET /payment-methods/cards/international/options. */
export type InternationalCardOptions = {
  available: boolean;
  currencies: InternationalCurrencyOption[];
  /** The only currency a card may be registered in (`registration.currency` of
   *  GET /payment-methods): the live subscription's, else the member's billing
   *  currency (KRW for a +82 phone number, USD otherwise). Any other is refused;
   *  KRW means no overseas card at all. Null only without a billing-currency
   *  lookup (offline dev) = free choice. */
  required_currency?: string | null;
};
/**
 * POST /payment-methods/cards/international — exactly these fields (the server
 * rejects unknown ones). No CVC / PIN: Toss's API takes neither for this flow.
 * PCI DSS: this object only ever lives for the duration of one request.
 */
export type InternationalCardRegistration = {
  client_idempotency_key: string;
  currency: string;
  card_number: string;
  expiry_month: number;
  expiry_year: number;
  /** `YYMMDD`; omitted unless the currency requires it or the member gave it. */
  holder_birth_date?: string;
  /** The form's recurring-billing agreement; the server accepts only `true`. */
  recurring_billing_consent: true;
};
/** What the Toss SDK needs to open the Toss Pay / Naver Pay window
 *  (`requestBillingAuth('카드', {…, flowMode, easyPay})`); an empty
 *  `client_key` means that wallet is not configured on the server. */
export type EasyPayIntent = {
  intent_id: string;
  customer_key: string;
  window: {
    client_key: string;
    easy_pay: "TOSSPAY" | "NAVERPAY";
    flow_mode: "DIRECT";
    success_url: string;
    fail_url: string;
  };
};
/** The window's success redirect: `?customerKey=…&authKey=…`. */
type WindowReturn = { authKey: string; customerKey: string };
const confirmBody = (intent_id: string, ret: WindowReturn) => ({
  intent_id,
  auth_key: ret.authKey,
  customer_key: ret.customerKey,
});

export const payApi = {
  /** `registration`: the one kind of method the member may add — a domestic
   *  card (KRW: a +82 phone number) or an overseas card in `currency`. */
  methods: () => http.get<PaymentMethodList>("/payment-methods"),
  /** Korean-issued cards only: Toss's hosted billing window. Overseas cards
   *  go through `registerInternationalCard` (the server refuses them here). */
  cardIntent: (return_url: string) =>
    http.post<CardIntent>("/payment-methods/cards/intent", {
      client_idempotency_key: randomUuid(),
      return_url,
      card_region: "domestic",
    }),
  internationalCardOptions: () =>
    http.get<InternationalCardOptions>("/payment-methods/cards/international/options"),
  /** Card data travels only in this JSON body; never cache, log or persist it. */
  registerInternationalCard: (body: InternationalCardRegistration) =>
    http.post<{ method: PaymentMethod }>("/payment-methods/cards/international", body),
  cardConfirm: (intent_id: string, ret: WindowReturn) =>
    http.post<{ method: PaymentMethod }>("/payment-methods/cards/confirm", confirmBody(intent_id, ret)),
  tosspayIntent: (return_url: string) =>
    http.post<EasyPayIntent>("/payment-methods/tosspay/intent", {
      client_idempotency_key: randomUuid(),
      return_url,
    }),
  tosspayConfirm: (intent_id: string, ret: WindowReturn) =>
    http.post<{ method: PaymentMethod }>("/payment-methods/tosspay/confirm", confirmBody(intent_id, ret)),
  naverpayIntent: (return_url: string) =>
    http.post<EasyPayIntent>("/payment-methods/naverpay/intent", {
      client_idempotency_key: randomUuid(),
      return_url,
    }),
  naverpayConfirm: (intent_id: string, ret: WindowReturn) =>
    http.post<{ method: PaymentMethod }>("/payment-methods/naverpay/confirm", confirmBody(intent_id, ret)),
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
    http.get<PointsHistoryResponse>("/points/history", { cursor, limit: 30 }),
  myLeague: () => http.get<LeaguePosition>("/leagues/me"),
  currentSeason: () => http.get<LeagueSeason>("/leagues/current"),
  // The user's live regular-league leaderboard for the CURRENT season. Safe to
  // call unconditionally: a dormant league answers 200 with an empty board.
  currentRankings: () => http.get<RankingResponse>("/leagues/current/rankings", { limit: 30 }),
  friendRankings: () => http.get<RankingResponse>("/leagues/friends/rankings", { limit: 30 }),
  // League History screen: calendar-quarter dropdown + paginated weekly records.
  leagueHistorySeasons: () => http.get<LeagueHistorySeasonsResponse>("/leagues/history/seasons"),
  leagueHistory: (params: { seasonId?: string; cursor?: string; limit?: number } = {}) =>
    http.get<LeagueHistoryResponse>("/leagues/history", {
      season_id: params.seasonId,
      cursor: params.cursor,
      limit: params.limit ?? 10,
    }),
  // League entry lifecycle: server-authoritative state + idempotent mutations.
  leagueLifecycle: () => http.get<LeagueLifecycleResponse>("/leagues/lifecycle"),
  ackLeagueResult: (seasonId: string) =>
    http.post<LeagueLifecycleResponse>(`/leagues/result/${encodeURIComponent(seasonId)}/ack`),
  joinCurrentLeague: () => http.post<LeagueLifecycleResponse>("/leagues/current/join"),
  checkIn: () => http.post<AttendanceCheckIn>("/attendance/check-in"),
};

/* ------------------------------ Friends ----------------------------- */
export const friendApi = {
  list: () => http.get<FriendListResponse>("/friends"),
  received: () => http.get<FriendRequestsResponse>("/friends/requests/received"),
  sent: () => http.get<FriendRequestsResponse>("/friends/requests/sent"),
  request: (user_id: string) => http.post<{ request_id: string }>("/friends/requests", { user_id }),
  getRequest: (id: string) => http.get<FriendRequest>(`/friends/requests/${id}`),
  accept: (id: string) => http.post<Friend>(`/friends/requests/${id}/accept`),
  reject: (id: string) => http.post<void>(`/friends/requests/${id}/reject`),
  // Cancel a pending outgoing request (by request id). Distinct from remove().
  cancel: (id: string) => http.del<void>(`/friends/requests/${id}`),
  // Privacy-first discovery — the client sends SHA-256 phone hashes, never raw numbers.
  searchPhone: (phone_hash: string) =>
    http.post<PhoneSearchResult>("/friends/search/phone", { phone_hash }),
  recommendations: (phone_hashes: string[]) =>
    http.post<ContactRecommendationsResponse>("/friends/recommendations/contacts", { phone_hashes }),
  remove: (id: string) => http.del<void>(`/friends/${id}`),
  createInvitation: () => http.post<FriendInvitationResponse>("/friend-invitations"),
  resolveInvitation: (token: string) =>
    http.get<ResolvedInvitationResponse>(`/friend-invitations/${token}`),
};

/* --------------------------- Notifications -------------------------- */
export const notifApi = {
  list: (params: { group?: string; cursor?: string }) =>
    http.get<{ sections?: NotificationSection[]; items?: NotificationItem[]; unread_count?: number; next_cursor?: string | null }>(
      "/notifications",
      { limit: 30, tz: deviceTimeZone(), ...params },
    ),
  /** Open the inbox → mark every notification read (clears the bell badge). */
  readAll: () => http.post<void>("/notifications/read-all"),
  settings: () => http.get<Record<string, unknown>>("/notifications/settings"),
  updateSettings: (body: Record<string, unknown>) => http.put<Record<string, unknown>>("/notifications/settings", body),
};

/* --------------------------- Subscription --------------------------- */
export const subApi = {
  /** The purchase screen's plans and free trial for the signed-in member, in
   *  their billing currency (KRW for a +82 phone number, USD otherwise). */
  offers: () => http.get<Offers>("/subscriptions/offers"),
  mine: () => http.get<MySubscription>("/subscriptions/me"),
  /** `quote` is what the screen showed; the server refuses (409
   *  subscription.price_changed) rather than charge anything else. */
  startTrial: (plan_id: string, quote?: CheckoutQuote) =>
    http.post<unknown>("/subscriptions/trial", { plan_id, ...quote }),
  // 201 = paid and active; 202 = the first charge is still undecided
  // (`subscription.status === "payment_pending"`, no access yet); a decline is 402.
  subscribe: (plan_id: string, method_id?: string, quote?: CheckoutQuote) =>
    http.post<{ subscription?: { status?: string } }>("/subscriptions", { plan_id, method_id, ...quote }),
  cancel: (reason?: CancellationReason, reason_text?: string) =>
    http.post<unknown>("/subscriptions/cancel", { reason, reason_text }),
  resume: () => http.post<unknown>("/subscriptions/resume"),
  /** One call validates and applies; the server enforces the 10/24h attempt cap. */
  redeemCoupon: (code: string) => http.post<CouponRedemption>("/subscriptions/coupons/redeem", { code }),
};

/* ----------------------------- Settings ----------------------------- */
export const settingsApi = {
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
  // `lang` selects which authored translation is served — and which language's
  // text the `q` search runs against. Callers pass the app language.
  faqs: (params: { category?: string; q?: string; cursor?: string; lang?: string }) =>
    http.get<{ items: Faq[]; next_cursor: string | null }>("/support/faqs", { limit: 50, ...params }, { auth: false }),
  faq: (faqId: string, lang?: string) =>
    http.get<Faq>(`/support/faqs/${encodeURIComponent(faqId)}`, { lang }, { auth: false }),
  // Notices are read while authenticated so the server can personalize the
  // per-user `is_new` flag. Reading does not record a read — markNoticeRead does.
  notices: (params?: { cursor?: string; lang?: string }) =>
    http.get<{ items: NoticeSummary[]; next_cursor: string | null }>("/support/notices", {
      limit: 20,
      ...params,
    }),
  notice: (noticeId: string, lang?: string) =>
    http.get<Notice>(`/support/notices/${encodeURIComponent(noticeId)}`, { lang }),
  markNoticeRead: (noticeId: string) =>
    http.post<void>(`/support/notices/${encodeURIComponent(noticeId)}/read`),
  // Server-signed identity for verified ChannelTalk identification. Auth
  // required; member_hash is null when no verification secret is configured.
  channelTalkIdentity: () =>
    http.get<ChannelTalkIdentity>("/support/channel-talk/identity"),
};
