import type { ImageCrop } from "./imageCrop";

/* ---- Auth ---- */
/** `terms_agreement`: an account a first social login created, whose owner has
 *  not yet accepted the signup agreements (the social signup's terms step). */
export type NextStep = "terms_agreement" | "profile_registration" | "onboarding" | "home" | null;
export interface Membership {
  tier: "free" | "premium";
  is_premium: boolean;
  expires_at: string | null;
}
export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user_id: string;
  is_new_user: boolean;
  membership: Membership;
  next_step: NextStep;
}
export interface SignupResponse {
  user_id: string;
  email: string;
  requires_login: boolean;
}
export interface VerificationStart {
  verification_id: string;
  expires_at: string;
  resend_available_at: string;
}
export interface VerificationConfirm {
  verification_token: string;
}
export type SocialProvider = "google" | "apple" | "kakao" | "facebook" | "line";

/** GET /auth/account/deletion-methods — how this account confirms a deletion. */
export interface AccountDeletionMethods {
  has_password: boolean;
  providers: SocialProvider[];
  /** Providers the web can re-authenticate through the redirect flow. */
  web_providers: SocialProvider[];
}

/**
 * DELETE /auth/account body: `password` for an account that has one;
 * otherwise a provider re-authentication — on the web, the single-use
 * `reauth_code` from the `purpose=reauth` redirect plus this browser's verifier.
 */
export type AccountDeletionBody =
  | { password: string }
  | { provider: SocialProvider; reauth_code: string; client_verifier: string };

/* ---- Me / profile ---- */
export type ProfileImageType = "CUSTOM" | "AVATAR" | "NONE";
export interface Me {
  user_id: string;
  email: string;
  name: string;
  nickname: string | null;
  phone: string | null;
  nationality: string | null;
  profile_image_type: ProfileImageType;
  avatar_key: string | null;
  profile_image_url: string | null;
  phone_verified: boolean;
  /** True until a social-signup account accepts the signup agreements. */
  terms_agreement_pending?: boolean;
  app_language: string;
  role: "member" | "premium" | "tester" | "admin";
  service_notification_consent: boolean;
  marketing_push_consent: boolean;
  email_sms_marketing_consent: boolean;
  today_streak_achieved: boolean;
  /** True once onboarding has been submitted. Gates the daily attendance
   *  check-in so attendance is never recorded mid-onboarding. */
  onboarding_completed: boolean;
  membership: Membership;
  created_at: string;
}
export interface NicknameCheck {
  nickname: string;
  available: boolean;
  check_token: string | null;
  expires_at: string | null;
}

/* ---- Dashboard ---- */
export interface DashboardTrackGoal {
  key: string;
  label: string;
  target: number;
  current: number;
  achieved: boolean;
}
export interface DashboardTrack {
  track_id: string;
  category: string;
  display_order: number;
  name: string;
  level: number;
  level_label: string;
  next_lesson_id: string | null;
  goal: DashboardTrackGoal;
}
export interface DashboardSummary {
  user_id: string;
  streak_days: number;
  last_study_date: string | null;
  today_minutes: number;
  tracks: DashboardTrack[];
  paywall_required: boolean;
  /** Whether the user has done any qualifying learning today (drives the sun). */
  studied_today: boolean;
}

/** Response from POST /learning/activity — recording a qualifying view. */
export interface DailyLearningActivity {
  studied_today: boolean;
  learning_day_created: boolean;
  total_learning_days: number;
}

/* ---- Sentences ---- */
/** Answer-free descriptor of a fill-in-the-blank slot (never carries the answer). */
export interface SentenceBlank {
  index: number;
  blank_id: string;
  start?: number | null;
  length?: number | null;
  display_width_em?: number | null;
  /** Leading answer characters revealed via hints so far (empty until requested). */
  revealed_text: string;
}
export interface Sentence {
  sentence_id: string;
  korean: string;
  /** Sentence-with-blank to render (contains `___`); when null, show `korean`. */
  display_text?: string | null;
  blanks?: SentenceBlank[];
  translation: string;
  translation_language?: string;
  romanization?: string | null;
  level: number;
  topic?: string | null;
  has_audio?: boolean;
  status?: string;
  attempt_count?: number;
  bookmarked?: boolean;
}
/** Result of a fill-in-the-blank answer submission (answer revealed post-attempt). */
export interface BlankAttempt {
  attempt_id: string;
  sentence_id: string;
  input_mode: "voice" | "keyboard";
  is_correct: boolean;
  normalized_answer: string;
  transcription?: string | null;
  completed_sentence: string;
  correct_answer: string;
  points_earned: number;
  daily_progress?: SpeechAttempt["daily_progress"];
  submitted_at: string;
}
export interface BlankHint {
  blank_id: string;
  revealed_text: string;
  revealed_count: number;
  can_request_another_hint: boolean;
  hint_used: boolean;
}
export interface Page<T> {
  items: T[];
  next_cursor: string | null;
  has_more: boolean;
}
export interface SpeechAttempt {
  attempt_id: string;
  correct: boolean;
  transcription: string;
  target_text: string;
  pronunciation_score: number;
  feedback_code: string;
  points_earned?: number;
  tips?: string[];
  daily_progress?: { track_id: string; target: number; current: number; achieved: boolean } | null;
  assessment?: unknown;
}
export interface SavedSentenceItem {
  sentence_id: string;
  korean: string;
  translation: string;
  save_types: string[];
  wrong_count?: number;
  last_viewed_at?: string | null;
}
export interface SavedSentencesPage {
  items: SavedSentenceItem[];
  next_cursor: string | null;
  has_more: boolean;
  counts: { total: number; favorite: number; auto_wrong: number; both: number };
}

/** One AI chat message (POST /ai/conversations…). */
export interface ChatMessage {
  message_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
  suggestion_chips?: string[];
}

/** One TOPIK problem-type option (GET /recommendations/topik-question-types). */
export interface TopikQuestionType {
  code: string;
  section: string;
  number_label: string;
  title_en: string;
  title_ko: string;
}

/* ---- Quizzes (real shape: material + answer) ---- */
export type AnswerFormat = "single_choice" | "short_answer" | "free_response";
export interface QuizChoice {
  key: string;
  text: string;
}
export interface QuizBlank {
  label: string;
}
export interface QuizMaterial {
  kind: string;
  html: string | null;
  image_url: string | null;
  /** Present for listening questions. The server sends only `duration_ms`;
   *  the playable URL comes from `quizApi.audio` (never `url` here). */
  audio: { duration_ms?: number; url?: string } | null;
}
export interface QuizAnswerConfig {
  format: AnswerFormat;
  choices: QuizChoice[];
  blanks: QuizBlank[];
  /** Character limits for writing answers (free_response). */
  min_length?: number | null;
  max_length?: number | null;
  scoring_criteria?: string[];
  max_score?: number | null;
}
/** Discriminated question type the client renders on (server-derived). */
export type TopikQuestionFormat =
  | "reading_multiple_choice"
  | "listening_multiple_choice"
  | "writing_fill_blanks"
  | "writing_data_response"
  | "writing_opinion_essay";
export interface Quiz {
  quiz_id: string;
  /** Server-derived discriminator; present on all quiz payloads. */
  question_type?: TopikQuestionFormat;
  prompt: string;
  prompt_translation?: string | null;
  level: number;
  material: QuizMaterial;
  answer: QuizAnswerConfig;
  hint?: string | null;
  topik_section?: string | null;
  topik_question_type?: string | null;
  bookmarked?: boolean;
  // Saved-item state (present in /quizzes/bookmarks responses).
  save_types?: string[];
  incorrect_count?: number;
  is_auto_saved?: boolean;
  is_favorited?: boolean;
  saved_at?: string | null;
}
/** Criteria-based grading result for a writing answer (nested under `writing`). */
export interface QuizWritingResult {
  score: number;
  max_score: number;
  grammar_issues: string[];
  suggestions: string[];
  corrected_text?: string | null;
}
export interface QuizAttemptResult {
  attempt_id: string;
  /** True/False for a graded selection question; null/absent for writing
   * (scored via `writing`) or a still-`submitted` attempt. */
  correct?: boolean | null;
  /** Present for a graded writing answer — score + structured feedback. */
  writing?: QuizWritingResult | null;
  correct_answer?: string | null;
  explanation?: string | null;
  corrected_text?: string | null;
  /** Authoritative writing-answer character count (same rule as the client). */
  server_character_count?: number | null;
  xp_earned?: number;
  points_earned?: number;
  /** `graded` — a definitive result is available; `submitted` — recorded, grading deferred. */
  status?: "graded" | "submitted" | string;
  /** Server-authoritative daily-goal snapshot after this attempt. `current` =
   * correctly-completed questions today, `target` = the daily goal. The
   * authoritative source for the session's x/N counter + progress bar. */
  daily_progress?: { goal_key?: string; target: number; current: number; achieved: boolean } | null;
  /** True only when THIS attempt newly credited the daily goal (a correct
   * custom answer not already completed). False for wrong answers, writing,
   * reviews, and duplicate correct submissions. `daily_progress.current`
   * advanced iff this is true. */
  completed_now?: boolean;
}

/* ---- Courses / Lectures ---- */
/** Lightweight lecture card returned by every list endpoint. Lectures carry
 *  no level — any user can open any lecture — and list items never include
 *  checkpoint schedules or playback positions (those come from the detail
 *  and play endpoints when a lecture is opened). */
export interface Lecture {
  lecture_id: string;
  track_id: string;
  course_id: string | null;
  /** The series it belongs to — where the player returns after the lesson. */
  series_id?: string | null;
  /** In the requested app language where the admin wrote one, else Korean. */
  description?: string;
  title: string;
  /** Always `video`: practice is attached to a lecture as checkpoints. */
  kind: "video";
  duration_seconds: number;
  thumbnail_url: string | null;
  topik_question_type: string | null;
  completed: boolean;
  /** True when the caller has any playback progress — drives the resume marker. */
  started: boolean;
  access: "free" | "premium";
}
/** Full detail from GET /lectures/{id}: adds checkpoints + caller playback. */
/** speaking_exercise → the conversation modal; multiple_choice / short_answer → the TOPIK modal. */
export type CheckpointInteractionType = "speaking_exercise" | "multiple_choice" | "short_answer";
export interface LectureCheckpoint {
  checkpoint_id: string;
  interaction_type: CheckpointInteractionType;
  at_second: number;
}
/** GET /lectures/{id}/checkpoints/{cid}/interaction — exactly one payload is set. */
export interface CheckpointInteraction extends LectureCheckpoint {
  lecture_id: string;
  sentence: Sentence | null;
  question: Quiz | null;
}
export interface LectureDetail extends Lecture {
  checkpoints: LectureCheckpoint[];
  my_playback: { last_position_seconds: number; max_watched_seconds: number; completed: boolean } | null;
}
export interface Course {
  course_id: string;
  track_id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  lesson_count: number;
  completed_lesson_count: number;
  lessons_preview?: Lecture[];
  /** Cursor for this course's next horizontal lecture page (GET /courses/{id}/lessons). */
  lessons_next_cursor?: string | null;
  lessons?: Lecture[];
  /** The course's series in order (COU-001's row); series without lessons are left out. */
  series?: SeriesSummary[];
}

/** A series card on the course list (COU-001). */
export interface SeriesSummary {
  series_id: string;
  course_id: string;
  title: string;
  description: string;
  /** The series' own key art — the card and the COU-002 header. */
  thumbnail_url: string | null;
  lesson_count: number;
  completed_lesson_count: number;
  started: boolean;
  has_free_lesson: boolean;
}

/** Where 바로 학습하기 opens: the lesson watched most recently, and where it stopped. */
export interface ResumeTarget {
  lecture_id: string;
  position_seconds: number;
}

/** One series with every lesson (COU-002). */
export interface SeriesDetail extends SeriesSummary {
  track_id: string;
  course_title: string;
  lessons: Lecture[];
  resume: ResumeTarget | null;
}

/** TOPIK part/section — the canonical value used across generation + the
 *  question-type dropdown (backend `section`). */
export type TopikSection = "listening" | "reading" | "writing";

export interface Banner {
  banner_id: string;
  image_url: string;
  /** The part of the image the admin chose to show; null = centred cover. */
  image_crop?: ImageCrop | null;
  alt_text: string;
  action_url: string | null;
  sort_order: number;
}

/* ---- Exams ---- */
export interface ExamSet {
  exam_set_id: string;
  title: string;
  edition: number;
  year: number;
  section: "listening" | "reading";
  level_band: string;
  access: "free" | "premium";
  question_count: number;
  questions?: Quiz[];
}
export interface ExamResult {
  attempt_id: string;
  exam_set_id: string;
  score: number;
  total: number;
  results: { quiz_id: string; correct: boolean }[];
}

/* ---- Payment / billing ---- */
export type MethodKind = "card" | "toss_pay" | "naver_pay";
/** `toss_intl_card` = an overseas-issued card registered through the app's own form. */
export type MethodProvider = "toss_card" | "toss_intl_card" | "toss_pay" | "naver_pay";
/** Where a card was issued: `domestic` (Korean, Toss window) or `international` (app form). */
export type CardRegion = "domestic" | "international";
export interface PaymentMethod {
  method_id: string;
  kind: MethodKind;
  provider: MethodProvider;
  status: "active" | "inactive" | "revoked";
  is_default: boolean;
  display_name: string;
  brand?: string | null;
  issuer?: string | null;
  first_four?: string | null;
  last_four?: string | null;
  masked_card_number?: string | null;
  card_type?: string | null;
  expiry_month?: number | null;
  expiry_year?: number | null;
  registered_at?: string;
  revoked_at?: string | null;
  /** Cards only; null for wallets. */
  card_region?: CardRegion | null;
  /** The only currency this method can be charged in (e.g. "USD"); null = no restriction tracked. */
  billing_currency?: string | null;
}
export interface Money {
  amount_cents: number;
  currency: string;
}
/** Stable payment failure categories the backend reports (FailureClass). */
export type PaymentFailureClass =
  | "insufficient_funds"
  | "card_expired"
  | "method_revoked"
  | "declined_generic"
  | "provider_outage"
  /** The plan's currency no longer matches the card's; no retry can fix it. */
  | "currency_mismatch"
  | "unknown";
/** Consolidated failed-automatic-payment recovery state (GET /billing/recovery). */
export interface PaymentRecovery {
  recovery_required: boolean;
  /** True when POST /billing/invoices/{id}/retry would be accepted now. */
  can_retry_immediately: boolean;
  /** Why not, when false during recovery (see lib/paymentRecovery RetryBlockReason). */
  retry_blocked_reason?: string | null;
  /** When a retry is allowed again (cooldown / daily_limit). */
  retry_available_at?: string | null;
  outstanding_invoice_id?: string | null;
  failure_class?: PaymentFailureClass | string | null;
  failure_code?: string | null;
  next_automatic_retry_at?: string | null;
  plan_id?: string | null;
  plan_name?: string | null;
}
export interface Invoice {
  invoice_id: string;
  plan_name: string;
  total: Money;
  status: string;
  period_start: string;
  period_end: string;
  paid_at: string | null;
  receipt_url: string | null;
}

/* ---- Gamification ---- */
export interface PointsBalance {
  season_points: number;
  season_id?: string;
}
export interface LeaguePosition {
  season_id: string;
  tier: string;
  tier_label: string;
  dormant: boolean;
  group_id?: string | null;
  group_size?: number;
  rank: number | null;
  band?: "promote" | "maintain" | "demote" | null;
  season_points: number;
  last_activity_at?: string | null;
  promote_cutoff_rank?: number | null;
  demote_cutoff_rank?: number | null;
  can_promote?: boolean;
  can_demote?: boolean;
  previous_tier?: string | null;
  next_tier?: string | null;
}
export interface LeagueSeason {
  season_id: string;
  name?: string;
  timezone?: string;
  starts_at: string;
  ends_at: string;
  is_current?: boolean;
}
export interface RankingEntry {
  rank: number;
  user_id: string;
  nickname?: string | null;
  profile_image_type?: ProfileImageType;
  avatar_key?: string | null;
  profile_image_url?: string | null;
  // null on a friend-league row for someone never seated in a league.
  tier?: string | null;
  group_id?: string;
  points: number;
  outcome?: string | null;
}
export interface RankingResponse {
  season_id: string;
  group_id?: string | null;
  updated_at?: string;
  league_kind?: string;
  entries: RankingEntry[];
  me?: RankingEntry | null;
}

/* ---- League history (calendar-quarter grouping over weekly records) ---- */
export type LeagueQuarter = "spring" | "summer" | "fall" | "winter";
export interface LeagueHistorySeason {
  season_id: string; // e.g. "2026-spring"
  year: number;
  quarter: LeagueQuarter;
  label: string; // e.g. "2026 봄 시즌"
  starts_at: string;
  ends_at: string;
  is_current: boolean;
}
export interface LeagueHistorySeasonsResponse {
  seasons: LeagueHistorySeason[];
  default_season_id: string;
}
export interface LeagueHistoryItem {
  league_week_id: string; // weekly season id, e.g. "2026-W18"
  season_id: string; // the calendar quarter it belongs to
  week_start: string; // ISO date (Monday)
  week_end: string; // ISO date (Sunday)
  is_current: boolean;
  rank: number | null;
  points: number;
  tier: string;
  tier_label: string;
  league_kind?: string;
  outcome?: string | null;
}
export interface LeagueHistoryResponse {
  season: LeagueHistorySeason;
  items: LeagueHistoryItem[];
  next_cursor: string | null;
}

/* ---- My Points (per weekly-league point ledger) ---- */
export type PointsReason =
  | "attendance"
  | "attendance_streak_bonus"
  | "sentence_complete"
  | "lecture_complete"
  | "saved_sentence_review"
  | "level_up_bonus";
export interface PointTransaction {
  event_id: string;
  reason: PointsReason | string;
  amount: number;
  occurred_at: string;
  /** The weekly-league period this transaction belongs to (never mixed). */
  league_period_id: string | null;
  /** Safe display context: {kind, streak_days} | {item_type} | {track} | {level}. */
  detail: Record<string, unknown> | null;
}
export interface PointsHistoryResponse {
  items: PointTransaction[];
  next_cursor: string | null;
}

/* ---- League lifecycle (entry flow) ---- */
export type LeagueLifecycleState =
  | "RESULT_UNVIEWED"
  | "RESULT_VIEWED_WAITING_NEXT_LEAGUE"
  | "NEW_LEAGUE_AVAILABLE_NOT_JOINED"
  | "ACTIVE_LEAGUE"
  | "WAITING_FOR_ALLOCATION"
  | "NO_ELIGIBLE_LEAGUE";
export type LeagueResultOutcome = "promoted" | "retained" | "demoted";
export interface LeagueResultSummary {
  season_id: string;
  previous_tier: string;
  previous_tier_label: string;
  resulting_tier: string;
  resulting_tier_label: string;
  final_rank: number | null;
  total_participants: number;
  outcome: LeagueResultOutcome;
  promote_cutoff_rank: number;
  settled_at: string;
  viewed: boolean;
}
export interface LeagueLifecycleResponse {
  state: LeagueLifecycleState;
  previous_result: LeagueResultSummary | null;
  current_season_id: string | null;
  next_season_starts_at: string | null;
  can_join_current: boolean;
}

/* ---- Friends ---- */
export interface Friend {
  user_id: string;
  nickname: string | null;
  profile_image_url?: string | null;
  avatar_key?: string | null;
  profile_image_type?: ProfileImageType;
}
export interface FriendRequest {
  request_id: string;
  user_id: string;
  nickname: string | null;
  profile_image_url?: string | null;
  avatar_key?: string | null;
  profile_image_type?: ProfileImageType;
  created_at?: string;
  /** Server-formatted relative label (English); the client re-formats per locale. */
  relative_time?: string;
}
export interface FriendListResponse {
  friends: Friend[];
  count: number;
}
export interface FriendRequestsResponse {
  requests: FriendRequest[];
  count: number;
}

/** The caller's relationship to a discovered user — drives the row CTA. */
export type FriendRelationship =
  | "none"
  | "friends"
  | "request_sent"
  | "request_received";

/** A safe, discovery-time view of a user (phone search / recommendation / invite). */
export interface RecommendedUser {
  user_id: string;
  nickname: string | null;
  profile_image_type?: ProfileImageType;
  profile_image_url?: string | null;
  avatar_key?: string | null;
  relationship: FriendRelationship;
  /** Pending request id for request_sent (cancel) / request_received (accept). */
  request_id?: string | null;
}
export interface ContactRecommendationsResponse {
  recommendations: RecommendedUser[];
}
export interface PhoneSearchResult {
  user: RecommendedUser | null;
}
export interface FriendInvitationResponse {
  token: string;
  expires_at?: string | null;
}
export interface ResolvedInvitationResponse {
  inviter: RecommendedUser;
  is_self: boolean;
}

/* ---- Notifications ---- */
export type NotificationGroup = "learning" | "announcement" | "social";
export interface NotificationItem {
  notification_id: string;
  category: string;
  /** UI bucket the server derives from category: learning / announcement / social. */
  group: NotificationGroup;
  title: string;
  body?: string | null;
  read: boolean;
  created_at: string;
  deep_link?: string | null;
  relative_label?: string;
}
export interface NotificationSection {
  key?: string;
  label: string;
  items: NotificationItem[];
}

/* ---- Subscriptions ---- */
export interface Plan {
  plan_id: string;
  name: string;
  /** List (original) price for the billing interval, in cents. */
  price_cents: number;
  /** Discounted (current) price for the billing interval, in cents. Null = no
   *  discount (current === original). */
  promo_price_cents?: number | null;
  /** What new members pay instead, in cents; null = the regular price. */
  new_member_price_cents?: number | null;
  /** True when the current values below are this member's new-member price. */
  new_member_price?: boolean;
  currency?: string;
  interval: "month" | "year";
  /** The promotional ribbon on the card, by app language, written and
   *  published in the admin console; null when none is published. */
  badge?: { ko: string; en: string } | null;

  // Server-computed presentation values (see SubscriptionPlan on the backend).
  // Preferred over client-side derivation when present.
  /** List charge for one billing interval, in cents. */
  original_total_cents?: number;
  /** Current (discounted) charge for one billing interval, in cents. */
  current_total_cents?: number;
  /** List price per month, in cents (yearly ÷ 12). */
  original_monthly_cents?: number;
  /** Current price per month, in cents (yearly ÷ 12). */
  current_monthly_cents?: number;
  /** Whole-percent saving of the current price vs. the list price. */
  discount_percent?: number;
}
/** POST /subscriptions/coupons/redeem — the grant a coupon code produced. */
export interface CouponRedemption {
  coupon_id: string;
  code: string;
  plan_name: string;
  subscription_type: "course_pass_coupon";
  duration_days: number;
  /** false → queued behind the running subscription (see `queue_position`). */
  activated: boolean;
  queue_position: number;
  effective_start_at: string;
  effective_end_at: string;
}
/** GET /subscriptions/offers — what the purchase screen offers this member:
 *  one plan per interval (the new-member price where it applies) and the
 *  member's one free trial, the same length on every plan. */
export interface Offers {
  plans: Plan[];
  new_member: boolean;
  trial: { available: boolean; days: number };
}
/** GET /subscriptions/me. It carries no premium flag: derive a live
 *  subscription from `status` (lib/subscription). Premium *gating* is the
 *  dashboard's `paywall_required`, which also covers tester/admin roles. */
export interface MySubscription {
  /** Effective status, incl. the derived `trial_ending` (a trial's last 72h). */
  status: string;
  plan_id?: string | null;
  /** Display name of the plan in force; null without a plan. */
  plan_name?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean;
  /** True once this account has ever started the free trial. */
  trial_started?: boolean;
  /** Server-authoritative free-trial eligibility: one trial per person, so it
   *  is false when the person trialled on an account they withdrew before
   *  signing up again, even though this account's trial_started is false. */
  trial_available?: boolean;
  in_trial?: boolean;
  /** Currency of the plan in force ("KRW" / "USD"); null without a plan. */
  plan_currency?: string | null;
  /** True when the current period is covered by a coupon grant, not a payment. */
  coupon_backed?: boolean;
}

/* ---- Settings ---- */
export interface AppSettings {
  theme: "system" | "light" | "dark";
  sound_effects: boolean;
  vibration: boolean;
  autoplay_audio: boolean;
}
export interface CategoryPref {
  category: string;
  level: number;
  max_level: number;
  daily_goal: number;
  order: number;
}
export interface LearningPreferences {
  categories: CategoryPref[];
  /** Highest daily_goal the caller may pick; null = unlimited (premium/trial/tester/admin). */
  daily_goal_limit?: number | null;
}

/* ---- Learning session finalize (POST /learning/sessions) ---- */
export interface SessionLevelUp {
  track_id: string; // "track_conversation" | "track_topik"
  previous_level: number;
  current_level: number;
  seconds_studied_at_previous_level: number;
  items_studied_at_previous_level: number;
  points_awarded: number;
}
export interface SessionFinalizeResult {
  session_id: string;
  session_type: string;
  duration_seconds: number;
  today_total_seconds: number;
  today_total_minutes: number;
  leveled_up: boolean;
  level_up: SessionLevelUp | null;
}

/* ---- Learning analytics ---- */
export interface RecQuota {
  daily_limit: number | null;
  used_today: number;
  remaining_today: number | null;
}
export interface StreakCalendarResp {
  current_streak: number;
  best_streak: number;
  freeze_tokens: number;
  motivation?: { message: string };
  month: {
    year: number;
    month: number;
    days: { date: string; studied: boolean; goal_achieved: boolean; is_today: boolean }[];
    studied_days: number;
    goal_achieved_days: number;
  };
}
export interface StatsResp {
  range: string;
  total_minutes: number;
  total_sentences: number;
  total_questions: number;
}

/* ---- Learning Management dashboard ---- */
export type ManagementPeriod = "7d" | "1m" | "3m" | "1y";
export interface ManagementBucket {
  key: string;
  start_date: string;
  end_date: string;
  study_seconds: number;
  conversation_sentence_count: number;
  topik_question_count: number;
  is_current: boolean;
}
export interface ManagementStats {
  period: ManagementPeriod;
  timezone: string;
  range: { start_date: string; end_date: string };
  has_any_eligible_learning_record: boolean;
  /** Conversation and TOPIK are separate metrics — the API has no combined total. */
  today: {
    study_seconds: number;
    conversation_sentence_count: number;
    topik_question_count: number;
  };
  buckets: ManagementBucket[];
  period_totals: {
    conversation_sentence_count: number;
    topik_question_count: number;
  };
}

/* ---- Attendance ---- */
/** Response of POST /attendance/check-in. `checked_in_today === true` means the
 * call was a no-op (already checked in earlier today); `false` means it recorded
 * a fresh check-in and awarded `points_awarded` points. */
export interface AttendanceCheckIn {
  checked_in_today: boolean;
  consecutive_days: number;
  last_checkin_date: string;
  points_awarded: number;
  streak_bonus_awarded: boolean;
}

/** `PUT /users/me/timezone` — the member's clock after syncing the device zone. */
export interface TimezoneSync {
  timezone: string;
  changed: boolean;
  /** The member's current day (YYYY-MM-DD); stays on a day already under way
   * after a westward trip until the local date catches up. */
  today: string;
  /** When the next day begins (UTC ISO instant — their next local midnight). */
  resets_at: string;
}

/* ---- Support ---- */
export interface Faq {
  faq_id: string;
  category: string;
  /** Already localized to `locale` by the server. */
  question: string;
  answer: string;
  /** The locale actually served. Differs from the requested one when the FAQ
   *  has no translation in it and the server fell back. */
  locale: string;
}
/** Identity the client feeds to the ChannelTalk SDK. `member_hash` is present
 * only when the backend has a verification secret configured; otherwise the
 * user is identified without verification. */
export interface ChannelTalkIdentity {
  member_id: string;
  member_hash: string | null;
}
/** Notice list-row shape — summary fields only (no body). Title is already
 * localized server-side to the requested language (with fallback). */
export interface NoticeSummary {
  notice_id: string;
  title: string;
  /** Locale actually served (may differ from the requested one via fallback). */
  locale: string;
  pinned?: boolean;
  published_at?: string;
  /** Server-managed, per-user recency flag — never derived on the client. */
  is_new?: boolean;
}

/** Notice detail — the full notice, including the localized Markdown body. */
export interface Notice extends NoticeSummary {
  body: string;
  /** Body authoring format; the client renders it with a safe Markdown renderer. */
  content_format?: "markdown";
}

/* ---- Adaptive study sessions (/study-sessions) ---- */
export type StudyTrack = "conversation" | "topik";
export interface StudyReveal {
  answer_key: {
    correct_answer?: string | null;
    korean?: string | null;
    blanks?: { index?: number; label?: string; answer?: string | null }[];
  } & Record<string, unknown>;
  explanations: { kind: string; choice_key: string | null; language: string; body: string }[];
}
export interface StudyActivity {
  activity_id: string;
  position: number;
  phase: string;
  activity_kind: "quiz" | "sentence_blank" | string;
  review_kind: string;
  status: "pending" | "presented" | "attempted" | "completed" | "skipped" | "withdrawn" | "replaced" | string;
  content_version_id: string;
  quiz_id: string | null;
  sentence_id: string | null;
  is_custom_practice: boolean;
  hints_used: number;
  answer_revealed: boolean;
  attempts: { attempt_no: number; correct: boolean | null; graded_at: string }[];
  attempts_left: number;
  /** Public payload — never the answer before it is allowed. */
  content: Record<string, unknown>;
  reveal: StudyReveal | null;
}
export interface StudySession {
  session_id: string;
  track: StudyTrack;
  status: "active" | "completed" | "abandoned" | "expired" | string;
  current_revision: number;
  learner_band: number;
  requested_activity_count: number;
  topik_section: string | null;
  topik_question_type: string | null;
  shortfall_reason: string | null;
  shortfall_message: { ko: string; en: string } | null;
  started_at: string;
  activities: StudyActivity[];
}
export interface StudyAttemptResult {
  attempt_no: number;
  correct: boolean | null;
  replayed: boolean;
  activity_status: string;
  attempts_left: number;
  evidence_policy: string;
  reveal: StudyReveal | null;
  daily_progress: { track_id: string; goal_key?: string; target: number; current: number; achieved: boolean } | null;
  completed_now: boolean;
  points_earned: number;
  transcription?: string | null;
}
export interface StudyCustomization {
  customization_id: string;
  status: "applied" | "needs_clarification" | "rejected" | "conflicted" | "cancelled" | "undone" | "processing" | string;
  operation: string | null;
  interpreter_route: string | null;
  fallback_step: string | null;
  unmet_constraints: string[];
  message: { ko: string; en: string } | null;
  new_revision: number | null;
  added_activity_ids: string[];
  removed_activity_ids: string[];
  session: StudySession;
}
export interface TutorAnswer {
  turn_id: string;
  mode: "hint_only" | "explain" | string;
  route: string;
  answer: string;
  cited_sentence: string | null;
  examples: string[];
  turns_left: number;
  replayed: boolean;
}
