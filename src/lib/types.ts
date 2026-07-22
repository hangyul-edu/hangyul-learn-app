/* ---- Auth ---- */
export type NextStep = "profile_registration" | "onboarding" | "home" | null;
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
  app_language: string;
  role: "member" | "premium" | "tester" | "admin";
  service_notification_consent: boolean;
  marketing_push_consent: boolean;
  email_sms_marketing_consent: boolean;
  today_streak_achieved: boolean;
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
}

/* ---- Sentences ---- */
export interface Sentence {
  sentence_id: string;
  korean: string;
  translation: string;
  translation_language?: string;
  romanization?: string | null;
  level: number;
  topic?: string | null;
  has_audio?: boolean;
  status?: string;
  attempt_count?: number;
  is_saved?: boolean;
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
  audio: { url?: string } | null;
}
export interface QuizAnswerConfig {
  format: AnswerFormat;
  choices: QuizChoice[];
  blanks: QuizBlank[];
  max_score?: number | null;
}
export interface Quiz {
  quiz_id: string;
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
export interface QuizAttemptResult {
  attempt_id: string;
  correct: boolean;
  correct_answer?: string | null;
  explanation?: string | null;
  corrected_text?: string | null;
  xp_awarded?: number;
  points_earned?: number;
  score?: number | null;
  status?: string;
}

/* ---- Courses / Lectures ---- */
export interface Lecture {
  lecture_id: string;
  track_id: string;
  course_id: string | null;
  level: number;
  title: string;
  kind: "video" | "reading" | "listening";
  duration_seconds: number;
  thumbnail_url: string | null;
  topik_question_type: string | null;
  completed: boolean;
  access: "free" | "premium";
  checkpoints: { checkpoint_id: string; interaction_type: string; at_second: number }[];
  my_playback: { last_position_seconds: number; max_watched_seconds: number; completed: boolean } | null;
}
export interface Course {
  course_id: string;
  track_id: string;
  title: string;
  description: string | null;
  level: number | null;
  cover_image_url: string | null;
  lesson_count: number;
  completed_lesson_count: number;
  lessons_preview?: Lecture[];
  /** Cursor for this course's next horizontal lecture page (GET /courses/{id}/lessons). */
  lessons_next_cursor?: string | null;
  lessons?: Lecture[];
}

export interface Banner {
  banner_id: string;
  image_url: string;
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
export type MethodProvider = "toss_card" | "toss_pay" | "naver_pay";
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
  | "unknown";
/** Consolidated failed-automatic-payment recovery state (GET /billing/recovery). */
export interface PaymentRecovery {
  recovery_required: boolean;
  can_retry_immediately: boolean;
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
  tier?: string;
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
  description?: string | null;
  price_cents: number;
  currency?: string;
  interval: "month" | "year";
  trial_days?: number;
  features?: string[];
}
export interface MySubscription {
  status: string;
  plan_id?: string | null;
  plan_name?: string | null;
  current_period_end?: string | null;
  trial_end?: string | null;
  cancel_at_period_end?: boolean;
  is_premium?: boolean;
}

/* ---- Settings ---- */
export interface AppSettings {
  theme: "system" | "light" | "dark";
  sound_effects: boolean;
  vibration: boolean;
  autoplay_audio: boolean;
  show_romanization: boolean;
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

/* ---- Support ---- */
export interface Faq {
  faq_id: string;
  category: string;
  question: string;
  answer: string;
}
/** Notice list-row shape — summary fields only (no body). */
export interface NoticeSummary {
  notice_id: string;
  title: string;
  pinned?: boolean;
  published_at?: string;
  /** Server-managed, per-user recency flag — never derived on the client. */
  is_new?: boolean;
}

/** Notice detail — the full notice, including the Markdown body. */
export interface Notice extends NoticeSummary {
  body: string;
  /** Body authoring format; the client renders it with a safe Markdown renderer. */
  content_format?: "markdown";
}
