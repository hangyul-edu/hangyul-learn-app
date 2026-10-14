/**
 * Korean wording for the server's errors — the reference catalog.
 *
 * The server's problem `detail` is English, written for developers and logs;
 * the member app shows these sentences instead (`errorMessage()` in
 * lib/http.ts). `codes` is keyed by the problem's stable `code`; `reasons` by
 * the `details.reason` the server adds where one code covers several
 * situations, and wins over the code when present. `{name}` slots are filled
 * from the problem's `details`.
 *
 * tests/unit/test_api_error_catalog.py checks this file against every code
 * and reason the server can send a member, both ways.
 */
export const apiErrorsKo = {
  codes: {
    // Generic codes — reached when nothing more specific applies.
    "validation_error": "입력한 내용을 다시 확인해 주세요.",
    "not_found": "요청한 정보를 찾을 수 없어요.",
    "conflict": "지금은 처리할 수 없는 요청이에요. 화면을 새로 고친 뒤 다시 시도해 주세요.",
    "forbidden": "이 기능을 사용할 권한이 없어요.",
    "unauthorized": "로그인이 필요해요. 다시 로그인해 주세요.",
    "rate_limited": "요청이 너무 많아요. 잠시 후 다시 시도해 주세요.",
    "internal_error": "일시적인 서버 오류예요. 잠시 후 다시 시도해 주세요.",
    "session_store_unavailable": "일시적인 서버 오류예요. 잠시 후 다시 시도해 주세요.",

    // Sign-in, sign-up and account
    "invalid_credentials": "이메일 또는 비밀번호가 올바르지 않아요.",
    "invalid_refresh_token": "로그인이 만료되었어요. 다시 로그인해 주세요.",
    "account_inactive": "이용할 수 없는 계정이에요.",
    "account_temporarily_locked": "로그인 시도가 너무 많아요. 잠시 후 다시 시도해 주세요.",
    "agreement_required": "필수 약관에 모두 동의해 주세요.",
    "terms_agreement_required": "먼저 필수 약관에 동의해 주세요.",
    "user_not_found": "계정을 찾을 수 없어요.",
    "email_already_registered": "이미 가입된 이메일이에요. 가입할 때 사용한 방법으로 로그인해 주세요.",
    "phone_already_registered": "이미 다른 계정에 등록된 휴대폰 번호예요.",
    "nickname_already_taken": "이미 사용 중인 닉네임이에요.",
    "nickname_check_required": "닉네임 중복 확인을 다시 해 주세요.",
    "password_mismatch": "비밀번호가 일치하지 않아요.",
    "weak_password": "비밀번호는 8~64자로, 영문·숫자·특수문자를 모두 포함해야 해요.",
    "password_reset_token_invalid": "비밀번호 재설정 시간이 지났어요. 처음부터 다시 진행해 주세요.",
    "timezone.invalid": "시간대 정보를 확인할 수 없어요.",
    "auth.reauthentication_invalid": "본인 확인이 만료되었어요. 다시 로그인해 주세요.",
    "auth.reauthentication_required": "계속하려면 다시 로그인해 본인 확인을 해 주세요.",
    "auth.reauthentication_stale": "본인 확인 후 시간이 지났어요. 다시 로그인해 주세요.",
    "auth.social_identity_mismatch": "이 계정에 연결된 소셜 계정이 아니에요. 이 계정에서 쓰는 소셜 계정으로 로그인해 주세요.",
    "auth.social_nonce_mismatch": "소셜 로그인을 확인하지 못했어요. 다시 시도해 주세요.",
    "auth.social_token_invalid": "소셜 로그인을 확인하지 못했어요. 다시 시도해 주세요.",
    "auth.social_provider_not_configured": "지금은 이 방법으로 로그인할 수 없어요. 다른 방법으로 로그인해 주세요.",
    "auth.social_provider_unavailable": "소셜 로그인 서비스에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.",

    // Verification codes
    "phone_verification_failed": "휴대폰 인증을 확인하지 못했어요. 인증을 다시 진행해 주세요.",
    "phone_verification_expired": "인증 시간이 지났어요. 인증번호를 다시 요청해 주세요.",
    "phone_number_undeliverable": "이 번호로는 인증 문자를 보낼 수 없어요. 번호를 확인하거나 다른 번호를 입력해 주세요.",
    "email_verification_failed": "이메일 인증을 확인하지 못했어요. 인증을 다시 진행해 주세요.",
    "email_verification_expired": "인증 시간이 지났어요. 인증번호를 다시 요청해 주세요.",
    "verification_delivery_failed": "인증번호를 보내지 못했어요. 잠시 후 다시 시도해 주세요.",

    // Subscription and premium
    "subscription_required": "프리미엄 회원만 이용할 수 있어요.",
    "access.premium_required": "프리미엄 회원만 이용할 수 있어요.",
    "subscription_not_found": "이용 중인 구독이 없어요.",
    "subscription.already_active": "이미 구독 중이에요.",
    "subscription.trial_used": "무료 체험은 한 번만 이용할 수 있어요.",
    "subscription.no_default_method": "먼저 결제수단을 등록해 주세요.",
    "subscription.method_unusable": "이 결제수단으로는 결제할 수 없어요. 다른 결제수단을 선택해 주세요.",
    "subscription.currency_mismatch": "이 결제수단으로는 이 요금제를 결제할 수 없어요.",
    "subscription.currency_not_offered": "이 요금제는 현재 결제 통화로 구매할 수 없어요.",
    "subscription.plan_not_available": "더 이상 판매하지 않는 요금제예요.",
    "subscription.unknown_plan": "요금제를 찾을 수 없어요.",
    "subscription.price_changed": "가격이 변경되었어요. 새 가격을 확인한 뒤 다시 진행해 주세요.",
    "subscription.invalid_state_transition": "지금 구독 상태에서는 할 수 없는 작업이에요.",
    "subscription.not_cancelable": "지금은 구독을 해지할 수 없어요.",
    "subscription.reactivation_not_allowed": "지금은 구독을 다시 시작할 수 없어요.",
    "plan.invalid": "요금제 정보가 올바르지 않아요.",

    // Payments and billing
    "payment_method.not_found": "결제수단을 찾을 수 없어요.",
    "payment_method.card_declined": "카드사에서 결제를 거절했어요. 다른 카드로 시도해 주세요.",
    "payment_method.card_not_supported": "지원하지 않는 카드예요. 다른 카드로 시도해 주세요.",
    "payment_method.invalid_card_number": "카드 번호를 다시 확인해 주세요.",
    "payment_method.invalid_card_expiry": "카드 유효기간을 다시 확인해 주세요.",
    "payment_method.invalid_card_holder": "카드 소유자 정보를 다시 확인해 주세요.",
    "payment_method.currency_mismatch": "이 결제수단으로는 현재 구독을 결제할 수 없어요.",
    "payment_method.unsupported_currency": "이 통화로는 카드를 등록할 수 없어요.",
    "payment_method.registration_not_offered": "이 종류의 결제수단은 등록할 수 없어요.",
    "payment_method.international_card_requires_direct_registration": "해외 카드는 해외 카드 등록 화면에서 등록해 주세요.",
    "payment_method.cannot_delete_default_while_active": "구독 중에는 기본 결제수단을 삭제할 수 없어요.",
    "payment_method.intent_expired": "카드 등록 시간이 지났어요. 처음부터 다시 등록해 주세요.",
    "payment_method.intent_not_found": "카드 등록 정보를 찾을 수 없어요. 처음부터 다시 등록해 주세요.",
    "payment_method.invalid_intent_state": "카드 등록을 이어서 진행할 수 없어요. 처음부터 다시 등록해 주세요.",
    "payment_method.invalid_auth_key": "카드 등록을 확인하지 못했어요. 처음부터 다시 등록해 주세요.",
    "payment_method.invalid_return_url": "카드 등록을 시작하지 못했어요. 다시 시도해 주세요.",
    "payment_method.provider_not_available": "지금은 이 결제수단을 사용할 수 없어요.",
    "payment_method.provider_not_configured": "지금은 이 결제수단을 사용할 수 없어요.",
    "payment_method.provider_unavailable": "결제 서비스에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.",
    "payment_method.refund_refused": "환불을 처리하지 못했어요. 고객센터로 문의해 주세요.",
    "billing.invoice_not_found": "결제 내역을 찾을 수 없어요.",
    "billing.payment_not_found": "결제 내역을 찾을 수 없어요.",
    "billing.cannot_retry_paid": "이미 결제가 완료되었어요.",
    "billing.invoice_not_retryable": "이 결제는 다시 시도할 수 없어요.",
    "billing.charge_in_progress": "결제를 처리하고 있어요. 몇 분 뒤에 다시 확인해 주세요.",
    "billing.charge_not_due": "지금 결제할 금액이 없어요.",
    "billing.retry_limit_reached": "지금은 결제를 다시 시도할 수 없어요. 잠시 후 다시 시도해 주세요.",
    "billing.retry_needs_new_method": "다른 결제수단을 등록한 뒤 다시 시도해 주세요.",
    "billing.key_management_unavailable": "결제를 진행하지 못했어요. 잠시 후 다시 시도해 주세요.",
    "billing.payment_not_refundable": "환불할 수 없는 결제예요.",
    "billing.refund_exceeds_invoice": "환불 금액이 결제 금액보다 커요.",

    // Coupons
    "coupon_code_invalid": "올바른 쿠폰 코드가 아니에요.",
    "coupon_not_found": "쿠폰을 찾을 수 없어요.",
    "coupon_already_redeemed": "이미 사용한 쿠폰이에요.",
    "coupon_revoked": "사용이 중지된 쿠폰이에요.",
    "coupon_expired": "사용 기간이 지난 쿠폰이에요.",

    // Learning sessions
    "session.not_found": "학습을 찾을 수 없어요.",
    "session.none_active": "진행 중인 학습이 없어요.",
    "session.not_active": "이미 끝난 학습이에요.",
    "session.revision_not_found": "학습을 찾을 수 없어요. 다시 시작해 주세요.",
    "session.activities_open": "아직 끝나지 않은 문제가 있어요. 문제를 풀거나 건너뛴 뒤 마쳐 주세요.",
    "session.activity_not_found": "문제를 찾을 수 없어요.",
    "session.activity_closed": "이미 끝난 문제예요.",
    "session.activity_replaced": "이 문제는 더 이상 이번 학습에 포함되어 있지 않아요.",
    "session.activity_withdrawn": "이 문제는 오류가 있어 제외되었어요. 채점되지 않아요.",
    "session.attempts_exhausted": "이 문제는 더 이상 풀 수 없어요.",
    "session.content_missing": "학습 내용을 불러오지 못했어요.",
    "session.dedup_key_reused": "요청을 처리하지 못했어요. 다시 시도해 주세요.",
    "session.no_eligible_content": "지금 레벨에 맞는 학습 내용이 아직 없어요.",
    "session.no_stored_hint": "이 문제에는 힌트가 없어요. 튜터에게 물어보세요.",
    "session.ungradable": "이 답은 채점할 수 없어요. 다시 시도해 주세요.",
    "session.voice_empty": "목소리가 들리지 않았어요. 조금 더 크게 다시 말해 주세요.",
    "session.voice_unsupported": "이 문제는 말로 답할 수 없어요.",
    "customization.not_found": "변경 내용을 찾을 수 없어요.",
    "customization.already_applied": "이미 적용된 변경이에요.",
    "customization.not_latest": "그 뒤에 바뀐 내용이 있어요. 나중에 바꾼 것부터 되돌려 주세요.",
    "customization.not_undoable": "되돌릴 수 없는 변경이에요.",
    "tutor.bad_question": "질문은 1~{max}자로 입력해 주세요.",
    "tutor.turn_limit": "이 문제에는 튜터에게 {limit}번까지 물어볼 수 있어요.",
    "tutor.turn_not_found": "대화를 찾을 수 없어요.",
    "tutor.content_withdrawn": "오류가 있어 제외된 문제라 튜터가 설명할 수 없어요.",
    "lecture_not_watched": "강의를 끝까지 시청해야 완료할 수 있어요.",
    "video_not_ready": "아직 영상을 재생할 수 없어요. 잠시 후 다시 시도해 주세요.",
    "video_hosting_error": "영상을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.",

    // Speech and audio
    "speech.no_speech": "목소리가 들리지 않았어요. 마이크 가까이에서 조금 더 크게 말해 주세요.",
    "speech.too_long": "녹음이 너무 길어요. {seconds}초 안에 말해 주세요.",
    "speech.unsupported_audio": "녹음을 읽을 수 없었어요. 다시 녹음해 주세요.",
    "speech_recognition_unavailable": "녹음을 인식하지 못했어요. 다시 시도해 주세요.",
    "pronunciation_assessment_unavailable": "지금은 발음을 평가할 수 없어요. 다시 시도해 주세요.",
    "audio_unavailable": "음성을 준비하고 있어요. 잠시 후 다시 시도해 주세요.",

    // Level assessment
    "proficiency.already_placed": "이미 이 레벨 이상이에요.",
    "proficiency.at_maximum": "가장 높은 레벨이에요. 꾸준히 연습해서 유지해 보세요.",
    "proficiency.audio_too_large": "녹음 파일이 너무 커요.",
    "proficiency.bad_exam_level": "TOPIK I 또는 TOPIK II를 선택해 주세요.",
    "proficiency.bad_level": "1~10 사이의 레벨을 선택해 주세요.",
    "proficiency.bad_mode": "평가 방식을 다시 선택해 주세요.",
    "proficiency.bad_support": "도움 방식을 다시 선택해 주세요.",
    "proficiency.bad_turn": "답할 대화를 선택해 주세요.",
    "proficiency.empty_answer": "먼저 답을 입력하거나 녹음해 주세요.",
    "proficiency.item_not_found": "문제를 찾을 수 없어요.",
    "proficiency.mock_content_unavailable": "모의고사를 만들 문제가 아직 부족해요.",
    "proficiency.no_audio": "이 문제에는 음성이 없어요.",
    "proficiency.no_delayed_check_due": "아직 복습 평가 시기가 아니에요.",
    "proficiency.no_unseen_tasks": "이 레벨에서 새로 풀 평가 문제가 없어요.",
    "proficiency.nothing_to_check": "이 레벨에서 더 확인할 내용이 없어요.",
    "proficiency.session_closed": "이미 끝난 평가예요.",
    "proficiency.session_expired": "평가 시간이 지났어요. 새로 시작해 주세요.",
    "proficiency.session_not_found": "평가를 찾을 수 없어요.",
    "proficiency.task_not_found": "문제를 찾을 수 없어요.",
    "proficiency.task_submitted": "이미 제출한 문제예요.",
    "proficiency.tasks_unfinished": "모든 문제를 푼 뒤 마쳐 주세요.",
    "proficiency.turn_order": "대화 순서대로 답해 주세요.",
    "proficiency.turns_missing": "모든 대화에 답한 뒤 마쳐 주세요.",
    "proficiency.voice_empty": "목소리가 들리지 않았어요. 다시 녹음해 주세요.",
    "proficiency.voice_required": "이 평가는 말로 답해야 해요.",

    // AI features
    "ai_content_rejected": "AI가 알맞은 내용을 만들지 못했어요. 다시 시도해 주세요.",
    "llm.content_filtered": "AI가 이 내용에는 답할 수 없어요. 다른 내용으로 시도해 주세요.",
    "llm.budget_exceeded": "지금은 AI 기능을 사용할 수 없어요. 나중에 다시 시도해 주세요.",
    "llm.rate_limited": "AI 요청이 많아요. 잠시 후 다시 시도해 주세요.",
    "llm.quota_exceeded": "지금은 AI 기능을 사용할 수 없어요. 나중에 다시 시도해 주세요.",
    "llm.empty_reply": "AI가 답하지 못했어요. 다시 시도해 주세요.",
    "llm.provider_error": "AI가 답하지 못했어요. 다시 시도해 주세요.",
    "llm.provider_unavailable": "AI가 답하지 못했어요. 잠시 후 다시 시도해 주세요.",
    "llm.model_unavailable": "지금은 AI 기능을 사용할 수 없어요. 나중에 다시 시도해 주세요.",
    "llm.not_configured": "지금은 AI 기능을 사용할 수 없어요. 나중에 다시 시도해 주세요.",
    "llm.auth_failed": "지금은 AI 기능을 사용할 수 없어요. 나중에 다시 시도해 주세요.",
    "llm.bad_request": "AI가 답하지 못했어요. 다시 시도해 주세요.",
  },

  reasons: {
    // Verification
    "code_incorrect": "인증번호가 맞지 않아요.",
    "challenge_not_found": "인증번호를 다시 요청해 주세요.",
    "resend_cooldown": "{retry_after_seconds}초 후에 인증번호를 다시 요청할 수 있어요.",
    "verification_hourly_limit": "인증 요청이 너무 많아요. 1시간 후에 다시 시도해 주세요.",

    // Account
    "current_password": "현재 비밀번호가 맞지 않아요.",
    "no_password": "비밀번호 없이 소셜 로그인으로 가입한 계정이에요.",
    "no_match_email_phone": "이메일과 휴대폰 번호가 일치하는 계정이 없어요.",
    "no_match_name_phone": "이름과 휴대폰 번호가 일치하는 계정이 없어요.",
    "deleted": "탈퇴한 계정이에요.",
    "suspended": "이용이 정지된 계정이에요. 고객센터로 문의해 주세요.",
    "inactive": "이용할 수 없는 계정이에요.",
    "provider_already_linked": "이미 가입된 계정에 같은 서비스의 다른 계정이 연결되어 있어요. 평소 쓰던 방법으로 로그인해 주세요.",
    "image_required": "사진을 선택해 주세요.",
    "image_too_large": "사진은 {max_mb}MB까지 올릴 수 있어요.",
    "image_type": "JPG, PNG, WebP, HEIC 사진만 올릴 수 있어요.",

    // Friends and league
    "friend_self": "나에게는 친구 요청을 보낼 수 없어요.",
    "user_unknown": "사용자를 찾을 수 없어요.",
    "already_friends": "이미 친구예요.",
    "friend_request_pending": "이미 친구 요청을 보냈어요.",
    "friend_request_incoming": "이 친구가 먼저 친구 요청을 보냈어요. 요청을 수락해 주세요.",
    "season_not_settled": "아직 이번 리그 결과가 나오지 않았어요.",

    // Coupons
    "coupon_daily_limit": "쿠폰 등록은 24시간에 {limit}번까지 시도할 수 있어요. 나중에 다시 시도해 주세요.",

    // Learning
    "answer_required": "답을 입력해 주세요.",
    "answer_too_long": "답은 {max}자까지 입력할 수 있어요.",
    "answer_too_short": "답을 {min}자 이상 입력해 주세요.",
    "audio_required": "먼저 녹음해 주세요.",
    "audio_too_large": "녹음을 읽을 수 없거나 너무 커요. 다시 녹음해 주세요.",
    "audio_too_long": "녹음이 너무 길어요. {seconds}초 안에 말해 주세요.",
    "daily_goal_premium": "일일 목표를 늘리려면 무료 체험이나 구독이 필요해요.",
    "lesson_incomplete": "강의를 마친 뒤에 연습 문제를 만들 수 있어요.",
    "generation_empty": "연습 문제를 만들지 못했어요. 다시 시도해 주세요.",
    "topik_no_writing": "TOPIK I(1~2급)에는 쓰기 영역이 없어요. 듣기나 읽기를 선택해 주세요.",

    // AI
    "ai_daily_limit": "오늘 무료로 보낼 수 있는 AI 메시지 {limit}개를 모두 사용했어요. 구독하면 제한 없이 대화할 수 있어요.",
    "content_blocked": "보낼 수 없는 내용이 포함되어 있어요. 내용을 바꿔 다시 시도해 주세요.",
    "off_task_prompt": "문장 추천에 쓸 수 없는 요청이에요. 연습하고 싶은 문장을 설명해 주세요. (예: 대학교에서 쓸 수 있는 표현)",
    "prompt_too_long": "요청은 {max}자까지 입력할 수 있어요.",
  },
};

export type ApiErrorCatalog = {
  codes: Record<keyof typeof apiErrorsKo.codes, string>;
  reasons: Record<keyof typeof apiErrorsKo.reasons, string>;
};
