/**
 * Korean wording for the server's errors in the admin portal.
 *
 * The portal is Korean-only. It looks up the problem's `details.reason` here,
 * then in the member catalog (apiErrors.ko.ts), then its `code` here, then in
 * the member catalog — so this file holds what members never meet, and the
 * codes an operator should hear more about than a member does (the AI
 * provider's own explanation, for instance). `{name}` slots are filled from
 * the problem's `details`; a list is joined with commas.
 *
 * tests/unit/test_api_error_catalog.py checks that every code and reason the
 * server can send has wording here or in the member catalog.
 */
export const apiErrorsAdminKo = {
  codes: {
    // Content review and publication
    "content.validation_failed": "검수 결과에 남은 문제를 고친 뒤 검토를 요청해 주세요.",
    "content.not_objective": "블라인드 풀이는 채점되는 객관식 문항에만 할 수 있어요.",
    "content.blind_solve_not_blind": "이 버전의 정답을 이미 보았거나 직접 작성한 버전이에요. 다른 검토자에게 블라인드 풀이를 부탁해 주세요.",
    "content.publication_blocked": "아직 게시할 수 없어요. 게시 전 확인 항목을 먼저 해결해 주세요.",
    "content.issue_status": "알 수 없는 이슈 상태예요.",
    "factory.job_not_found": "생성 작업을 찾을 수 없어요.",
    "factory.job_running": "작업이 진행 중이에요. 이번 시도가 끝난 뒤 취소해 주세요.",
    "factory.not_retryable": "실패한 작업만 다시 시도할 수 있어요.",

    // Learning analytics
    "analytics.bad_window": "기간을 다시 확인해 주세요. 끝나는 날이 시작하는 날보다 앞설 수 없어요.",
    "analytics.export_forbidden": "이 데이터를 내보낼 권한이 없어요.",
    "analytics.export_not_found": "내보내기 파일을 찾을 수 없어요.",
    "analytics.export_expired": "내보내기 파일이 만료되었어요. 다시 만들어 주세요.",
    "ai.unknown_feature": "알 수 없는 AI 기능이에요.",
    "proficiency.learner_not_found": "학습자를 찾을 수 없어요.",
    "proficiency.observation_not_found": "관찰 기록을 찾을 수 없어요.",
    "proficiency.attempt_not_found": "응답을 찾을 수 없어요.",
    "proficiency.not_pending": "이미 채점이 끝난 과제예요. 목록을 새로 고쳐 주세요.",
    "proficiency.rating_target": "평가 응답과 기준 답안 중 하나만 골라 채점해 주세요.",
    "proficiency.bad_score": "항목별 점수는 0~4점으로 입력해 주세요.",
    "proficiency.bad_period": "성장 기간은 7일, 30일, 90일 중에서 골라 주세요.",

    // Coupons
    "coupon_batch_not_found": "쿠폰 묶음을 찾을 수 없어요.",

    // System settings
    "settings.integration_not_found": "설정 항목을 찾을 수 없어요.",
    "settings.not_toggleable": "이 항목은 켜고 끌 수 없어요.",
    "settings.no_changes": "저장할 변경 사항이 없어요.",
    "settings.invalid": "입력값을 확인해 주세요.",
    "settings.required_missing": "켜기 전에 필수 항목을 입력해 주세요: {missing}",
    "settings.test_unsupported": "이 항목은 연결 테스트를 지원하지 않아요.",

    // AI providers — the provider's own explanation, so an operator can act on it
    "llm.not_configured": "AI를 쓸 수 없어요: {problem}",
    "llm.auth_failed": "AI 제공사가 요청을 거부했어요: {problem}",
    "llm.model_unavailable": "AI 모델을 쓸 수 없어요: {problem}",
    "llm.quota_exceeded": "AI 사용 한도에 도달했어요: {problem}",
    "llm.bad_request": "AI 제공사가 요청을 거부했어요: {problem}",
    "llm.provider_unavailable": "AI 제공사에 연결하지 못했어요: {problem}",
    "llm.content_filtered": "AI가 안전 정책 때문에 답하지 않았어요. 내용을 바꿔 다시 시도해 주세요.",
    "llm.empty_reply": "AI가 빈 응답을 보냈어요. 잠시 후 다시 시도해 주세요.",
    "llm.provider_error": "AI 응답을 처리하지 못했어요. 다시 시도해 주세요.",
  },

  reasons: {
    // Permissions
    "admin_required": "관리자만 사용할 수 있어요.",
    "permission_required": "이 작업을 할 권한이 없어요. 필요한 권한: {permission}",
    "super_admin_required": "최고 관리자만 할 수 있는 작업이에요.",

    // Admins and members
    "admin_not_found": "관리자 계정을 찾을 수 없어요.",
    "already_admin": "이미 관리자인 계정이에요.",
    "admin_grant_inactive": "이용 중인 계정에만 관리자 권한을 줄 수 있어요.",
    "self_admin_change": "내 관리자 권한은 직접 바꿀 수 없어요.",
    "last_super_admin": "이용 중인 최고 관리자가 한 명뿐이라 권한을 바꿀 수 없어요. 다른 최고 관리자를 먼저 지정해 주세요.",
    "member_email_unknown": "이 이메일로 가입한 회원이 없어요.",
    "member_not_found": "회원을 찾을 수 없어요.",
    "member_is_admin": "관리자 계정이에요. 관리자 메뉴에서 권한을 관리해 주세요.",
    "member_deleted": "회원이 직접 탈퇴한 계정이라 다시 활성화할 수 없어요.",
    "self_member_change": "내 계정의 역할이나 상태는 직접 바꿀 수 없어요.",
    "nickname_taken": "이미 사용 중인 닉네임이에요.",

    // Courses, series, lectures and checkpoints
    "course_not_found": "과정을 찾을 수 없어요. 이미 삭제되었을 수 있어요.",
    "series_not_found": "시리즈를 찾을 수 없어요. 이미 삭제되었을 수 있어요.",
    "lecture_not_found": "강의를 찾을 수 없어요. 이미 삭제되었을 수 있어요.",
    "course_not_empty": "과정에 시리즈 {series}개와 강의 {lectures}개가 남아 있어요. 먼저 삭제하거나 옮겨 주세요.",
    "series_not_empty": "시리즈에 강의 {lectures}개가 남아 있어요. 먼저 옮기거나 삭제해 주세요.",
    "series_other_track": "다른 트랙 과정의 시리즈예요.",
    "title_too_long": "{locale} 제목은 {max}자까지 입력할 수 있어요.",
    "checkpoint_not_found": "체크포인트를 찾을 수 없어요.",
    "checkpoint_needs_sentence": "회화 강의에는 회화 문장만 체크포인트로 넣을 수 있어요.",
    "checkpoint_needs_question": "TOPIK 강의에는 TOPIK 문제만 체크포인트로 넣을 수 있어요.",
    "checkpoint_needs_video": "강의 영상을 올리고 준비가 끝난 뒤에 체크포인트를 추가해 주세요.",
    "checkpoint_outside_video": "체크포인트 시간이 영상 길이({duration}초)를 넘어요.",
    "checkpoint_too_close": "{at}초에 다른 체크포인트가 있어요. 체크포인트는 {gap}초 이상 떨어뜨려 주세요.",
    "interaction_mismatch": "선택한 콘텐츠와 맞지 않는 문제 유형이에요.",

    // Sentences and questions
    "sentence_not_found": "문장을 찾을 수 없어요.",
    "sentence_archived": "보관된 문장이에요.",
    "sentence_owned_elsewhere": "다른 강의의 체크포인트에 쓰이는 문장이에요.",
    "sentence_batch_invalid": "{items}번째 문장을 확인해 주세요.",
    "blank_answer_missing": "빈칸마다 정답을 입력해 주세요.",
    "blank_outside_sentence": "빈칸 위치가 한국어 문장 밖에 있어요.",
    "question_not_found": "문제를 찾을 수 없어요.",
    "question_archived": "보관된 문제예요.",
    "question_owned_elsewhere": "다른 강의의 체크포인트에 쓰이는 문제예요.",
    "question_exists": "같은 ID의 문제가 이미 있어요.",
    "question_batch_invalid": "{items}번째 문제를 확인해 주세요.",
    "question_batch_exists": "{items}번째 문제는 같은 ID의 문제가 이미 있어요.",
    "question_not_listening": "듣기 문제에만 음원을 올릴 수 있어요.",
    "listening_audio_too_large": "듣기 음원은 {max_mb}MB까지 올릴 수 있어요.",
    "audio_file_invalid": "{problem}",
    "content_not_found": "콘텐츠를 찾을 수 없어요.",

    // Lecture videos
    "file_empty": "빈 파일이에요. 파일을 다시 선택해 주세요.",
    "video_too_large": "영상은 {max_mb}MB보다 작아야 해요.",
    "video_type": "올릴 수 없는 영상 형식이에요. MP4, MOV, WebM 등 영상 파일을 선택해 주세요.",
    "video_not_uploaded": "아직 준비된 영상이 없어요. 먼저 영상을 올려 주세요.",
    "video_other_provider": "이 영상은 지금 쓰는 영상 저장소가 아닌 곳에 올라가 있어요. 영상을 다시 올려 주세요.",
    "video_provider_misconfigured": "{problem}. 연동·환경 설정에서 채운 뒤 다시 올려 주세요.",
    "video_upload_closed": "이 영상에는 더 이상 파일을 올릴 수 없어요. 새로 올려 주세요.",
    "video_upload_failed": "영상 저장소에 올리지 못했어요. 저장소의 응답: {provider_message}",
    "video_status_failed": "영상 상태를 확인하지 못했어요. 저장소의 응답: {provider_message}",
    "video_playback_failed": "영상을 재생할 주소를 받지 못했어요. 저장소의 응답: {provider_message}",

    // Notices, FAQs, banners, media
    "notice_not_found": "공지를 찾을 수 없어요.",
    "faq_not_found": "FAQ를 찾을 수 없어요.",
    "translation_not_found": "{locale} 번역이 없어요.",
    "last_translation": "번역은 하나 이상 남아 있어야 해요.",
    "banner_not_found": "배너를 찾을 수 없어요. 이미 삭제되었을 수 있어요.",
    "end_before_start": "종료 시각은 시작 시각보다 뒤여야 해요.",
    "admin_image_type": "JPG, PNG, WebP 이미지만 올릴 수 있어요.",

    // Leagues
    "season_not_found": "시즌을 찾을 수 없어요.",
    "league_not_found": "리그를 찾을 수 없어요.",
    "learner_session_not_found": "이 학습자의 학습 기록을 찾을 수 없어요.",

    // Plans and coupons
    "plan_not_found": "판매 중인 요금제가 아니에요.",
    "plan_price_required": "판매할 요금제에는 한 가지 이상의 통화로 가격을 입력해 주세요.",
    "plan_discount_above_price": "{currency} 할인 가격이 정가보다 높아요.",
    "plan_badge_missing": "배지 문구가 비어 있는 언어가 있어요: {languages}",
    "coupon_quantity_cap": "쿠폰은 한 번에 {max}개까지 만들 수 있어요.",

    // Catalog import
    "catalog_job_running": "이미 진행 중인 카탈로그 작업이 있어요. 끝난 뒤 다시 시도해 주세요.",
    "catalog_job_not_found": "카탈로그 작업을 찾을 수 없어요.",
    "catalog_plan_not_found": "가져오기 계획을 찾을 수 없어요. 새로 계획을 만들어 주세요.",
    "catalog_plan_stale": "계획을 만든 뒤 상황이 바뀌었어요. 새로 계획을 만들어 주세요.",
    "catalog_plan_blocked": "계획에 충돌이나 빠진 항목이 있어 가져올 수 없어요.",
    "catalog_confirm_database": "확인을 위해 데이터베이스 이름({database})을 정확히 입력해 주세요.",
    "catalog_backup_unconfirmed": "이 데이터베이스의 백업을 확인했다고 체크해 주세요.",
    "catalog_seed_required": "커리큘럼 v1이 다 채워지지 않았어요. 가져오기와 함께 채우도록 선택해 주세요.",
    "catalog_nothing_to_import": "가져올 내용이 없어요. 이미 이 패키지가 들어 있어요.",
    "catalog_package_invalid": "카탈로그 패키지를 확인하지 못했어요: {problem}",

    // Content review
    "content_version_not_found": "콘텐츠 버전을 찾을 수 없어요.",
    "content_issue_not_found": "이슈를 찾을 수 없어요.",
    "content_transition": "지금 상태에서는 이 단계로 옮길 수 없어요.",
    "blind_solve_repeated": "이 버전의 블라인드 풀이를 이미 제출했어요.",
    "review_not_open": "검토 중인 버전만 검토할 수 있어요.",

    // Destructive actions
    "confirmation_phrase": "확인 문구를 정확히 입력해 주세요: {phrase}",
  },
};
