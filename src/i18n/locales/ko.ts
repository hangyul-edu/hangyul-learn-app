/**
 * Korean catalog — the reference shape every other locale is typed against.
 *
 * Copy marked with a Figma node id is transcribed verbatim from that node. The
 * Korean and English designs are separate frames with independently authored
 * text, so entries are never machine-translated from one another: each side is
 * read off its own frame. Where a string has no Figma node (accessibility
 * labels, network-failure toasts, and other states the designs don't cover) the
 * entry is marked `app-authored`.
 *
 * `{name}`-style placeholders are substituted at render time. `<s>…</s>` marks
 * the segment the design styles more prominently; <T> renders it as <b>. Word
 * order around those slots differs per language by design — do not assume the
 * English message is the Korean one reordered.
 */
export const ko = {
  /** Shared actions and states used across screens. */
  common: {
    confirm: "확인", // Figma 1332:22046 cp_C_01_primaryBtn
    cancel: "취소",
    back: "뒤로 가기", // app-authored (a11y)
    close: "닫기", // app-authored (a11y)
    retry: "다시 시도",
    networkError: "네트워크 연결을 확인한 후 다시 시도해 주세요.", // app-authored
  },

  /** Boot splash / GEN-001_스플래시, Figma 784:53218. */
  splash: {
    tagline: "작은 귤 한 조각처럼, 매일 한 문장씩",
    a11y: "한귤 앱을 여는 중",
  },

  /** Bottom tab bar — Figma navi_user (KO 1825:26629 / EN 1825:28553). */
  nav: {
    home: "홈",
    classes: "강의",
    practice: "맞춤 학습",
    league: "리그",
    more: "더보기",
  },

  /** Home / MAI-001 (비구독유저), Figma 1825:26625. */
  home: {
    /** 1825:26666 — "00님, 반가워요!"; the name segment is the prominent one. */
    greeting: "<s>{name}님,</s> 반가워요!",
    /** 1825:26654 — "연속 학습 100일째". */
    streak: "연속 학습 {days}일째",
    /** 1870:24464 — fallback when the API sends no goal label. */
    /** 1870:24462 — the primary CTA's three states. */
    /** 1825:26638 / 1825:26644 — the two shortcut tiles. */
    shortcutClasses: "강의",
    shortcutReview: "복습하기",
    /** 1825:26632 / 1825:26633 — non-subscriber promo toast. */
    promoQuestion: "아직 한귤 구독 전이라면?",
    promoCta: "지금 바로 구독하세요!",
    /* app-authored accessibility labels (no Figma node). */
    notifications: "알림",
    notificationsUnread: "알림, 새 알림 있음",
    trackStatus: "{name} 학습 현황",
    goalProgress: "{label} {target}개 중 {current}개 완료, {percent}퍼센트",
    defaultNickname: "회원",
  },

  /** Login / AME-003, Figma 1:3436. */
  login: {
    heading: "로그인", // 1:3442
    tagline: "작은 귤 한 조각처럼, 매일 한 문장씩", // 1:3452
    emailLabel: "이메일", // I1:3444;3021:65472
    emailPlaceholder: "이메일을 입력해주세요", // I1:3444;3021:65475
    passwordLabel: "비밀번호", // I1:3445;3021:65472
    passwordPlaceholder: "비밀번호를 입력해주세요", // I1:3445;3021:65475
    autoLogin: "자동로그인", // I1:3446;3021:65722
    submit: "로그인", // I1:3447;3021:65365
    findEmail: "이메일 찾기", // 1:3449
    findPassword: "비밀번호 찾기", // 1:3450
    signup: "회원가입", // 1:3451
    /* app-authored validation / failure states (no Figma node). */
    missingFields: "이메일과 비밀번호를 입력해 주세요.",
    invalidCredentials: "이메일 또는 비밀번호가 올바르지 않아요.",
  },

  /** Welcome / AME-002, Figma 12:6048 (EN 784:53415). */
  welcome: {
    login: "로그인",
    signup: "회원가입",
    google: "Google로 계속하기",
    apple: "Apple로 계속하기",
    facebook: "Facebook으로 계속하기",
    kakao: "Kakao로 계속하기",
    line: "LINE으로 계속하기",
  },

  /** Forgot Password / AME-010, Figma 1:3319 (EN 784:50299). */
  findPassword: {
    title: "비밀번호 찾기",
    subtitle: "가입 시 입력한 이메일과 휴대폰번호를 입력해주세요.",
    submit: "비밀번호 재설정하기",
    /* app-authored validation / a11y (no Figma node). */
    emailInvalid: "올바른 이메일 형식이 아니에요.",
    submitBlockedA11y: "이메일 확인과 휴대폰 인증을 완료해 주세요",
  },

  /** Reset Password / AME-011, Figma 1:3349 (EN 784:50329). */
  resetPassword: {
    title: "비밀번호 재설정",
    passwordLabel: "비밀번호",
    passwordPlaceholder: "영어, 숫자, 특수문자 포함 8자리 이상을 입력하세요",
    confirmLabel: "비밀번호 재입력",
    confirmPlaceholder: "비밀번호를 다시 입력하세요",
    submit: "비밀번호 재설정하기",
    changed: "비밀번호를 변경했어요", // app-authored (toast)
  },

  /**
   * Account changes — password / phone / email.
   *
   * The password screen is AME-012 (Figma 174:6826 / EN 784:54846). The phone
   * and email variants have no located design frame, so their English copy is
   * app-authored and follows the AME-012 wording.
   */
  accountChanges: {
    passwordTitle: "비밀번호 변경",
    currentPassword: "현재 비밀번호",
    currentPasswordPlaceholder: "현재 비밀번호를 입력하세요",
    newPassword: "새 비밀번호",
    newPasswordPlaceholder: "영어, 숫자, 특수문자 포함 8자리 이상을 입력하세요",
    confirmPassword: "새 비밀번호 확인",
    confirmPasswordPlaceholder: "새 비밀번호를 다시 입력하세요",
    change: "변경하기",
    passwordMismatch: "새 비밀번호가 일치하지 않아요.",
    passwordWeak: "영어, 숫자, 특수문자를 포함해 8자리 이상 입력해 주세요.",
    passwordSameAsCurrent: "현재 비밀번호와 다른 비밀번호를 입력해 주세요.",
    passwordChanged: "비밀번호를 변경했어요. 다시 로그인해 주세요.",
    passwordBlockedA11y: "모든 조건을 만족하면 비밀번호를 변경할 수 있어요",
    phoneTitle: "휴대폰번호 변경",
    phoneLabel: "휴대폰번호",
    phoneSame: "현재 사용 중인 번호와 같아요",
    codeSentSms: "인증번호를 문자로 보냈어요",
    verifiedToast: "인증이 완료되었어요",
    phoneChanged: "휴대폰 번호를 변경했어요",
    phoneBlockedA11y: "인증을 완료하면 번호를 변경할 수 있어요",
    emailTitle: "이메일 변경",
    emailLabel: "이메일",
    emailSame: "현재 사용 중인 이메일과 같아요",
    codeSentEmail: "인증번호를 이메일로 보냈어요",
    verifiedPeriod: "인증되었습니다.",
    emailChanged: "이메일을 변경했어요",
    emailBlockedA11y: "인증을 완료하면 이메일을 변경할 수 있어요",
    verifiedWithPeriod: "인증이 완료되었어요.",
    codeExpired: "인증 시간이 만료되었어요. 재전송해 주세요.",
    sending: "전송 중",
    resend: "재전송",
    resendIn: "재전송 {n}",
    resendA11y: "인증번호 재전송",
    requestCodeA11y: "인증번호 받기",
    emailVerifiedA11y: "이메일 인증 완료",
    verifiedDoneA11y: "인증 완료됨",
    codeNotRequestedA11y: "인증번호 미요청",
    remainingA11y: "남은 시간 {m}분 {s}초",
  },

  /**
   * Profile registration / edit — AME-006 (Figma 251:6866 / EN 784:55888).
   * Both screens share the design's visual system and its nickname field.
   */
  profileSetup: {
    setupTitle: "프로필 등록",
    setupSubtitle: "시작에 앞서 프로필을 등록해볼까요?",
    editTitle: "프로필 변경",
    imageLabel: "프로필 이미지",
    characterLabel: "기본 캐릭터 선택",
    choosePhoto: "사진 선택",
    nicknameLabel: "닉네임",
    nicknamePlaceholderSetup: "10자이하로 입력하세요",
    nicknamePlaceholderEdit: "닉네임을 입력하세요",
    checkDuplicate: "중복확인",
    changeNickname: "변경하기",
    start: "시작하기",
    save: "저장하기",
    /* nickname-check feedback (helper text under the field) */
    nicknameAvailable: "사용가능한 닉네임입니다.",
    nicknameTaken: "이미 사용 중인 닉네임이에요.",
    nicknameTooShort: "2자 이상 입력해 주세요.",
    nicknameCurrent: "현재 사용 중인 닉네임이에요.",
    checkFirst: "닉네임 중복확인을 먼저 해주세요.",
    /* app-authored accessibility labels (no Figma node). */
    previewA11y: "프로필 이미지 미리보기",
    choosePhotoA11y: "사진 선택, 사진 라이브러리 열기",
    nicknameA11y: "닉네임",
    checkDuplicateA11y: "닉네임 중복확인",
    changeNicknameA11y: "닉네임 변경 확인",
    startBlockedA11y: "닉네임 중복확인을 완료하면 시작할 수 있어요",
    saveBlockedA11y: "변경 사항이 없거나 닉네임 확인이 필요해 저장할 수 없어요",
    imageUploadedA11y: "프로필 이미지: 업로드한 사진",
    imageCharacterA11y: "프로필 이미지: {name}",
    imageDefaultA11y: "프로필 이미지: 기본 이미지",
    exitTitle: "프로필 변경을 종료할까요?",
    exitSubtitle: "저장하지 않고 나가면 변경사항이 사라져요",
    // No KO frame was found for the three AME-006 modals; these mirror the EN
    // Figma copy (2231:24627 / 2231:24634) in the catalog's existing voice.
    savedTitle: "프로필이 변경되었습니다",
    savedBody: "프로필 정보가 업데이트되었어요",
    saveFailTitle: "프로필 변경에 실패했어요",
    saveFailBody: "문제가 발생했어요\n잠시 후 다시 시도해주세요",
  },

  /** Accessible names for the three default characters (app-authored — the
      designs show the artwork without labels). */
  avatars: {
    AVATAR_01: "안경 쓴 귤 캐릭터",
    AVATAR_02: "초록 학사모 귤 캐릭터",
    AVATAR_03: "학사모와 책을 든 귤 캐릭터",
  },

  /** Subscription management / MOR-010 (Figma 624:9777 / EN 784:62109). */
  subscription: {
    title: "구독 관리",
    myPlanHeading: "내 구독정보", // 784:62116 "My Plan"
    planLabel: "이용 구독 플랜", // 784:62119 "Plan"
    nextBilling: "다음 결제일", // 784:62122 "Next billing date"
    statusLabel: "구독 상태", // MOR-014 624:9942 (EN 784:62274 "Status")
    statusCanceling: "해지 예정", // MOR-014 784:62275 "Canceling"
    cancel: "해지하기", // 784:62125 "Cancel Plan"
    resume: "해지 취소", // MOR-014 624:9950
    /** MOR-014's grey band (624:9949) — three lines, the first dated. */
    cancelNotice1: "{date}까지 이용 가능해요",
    cancelNotice2: "이후 자동 결제되지 않습니다",
    cancelNotice3: "언제든지 해지를 취소할 수 있어요",
    subscribe: "구독하기",
    noPlanTitle: "현재 구독 중인 플랜이 없습니다",
    noPlanSub: "지금 구독하고 모든 학습을 자유롭게 이용하세요",
    voucherLabel: "구독권 코드 등록", // 2181:25133 (the app said 수강권)
    billingHeading: "결제 정보", // 784:62127 "Billing History"
    colDate: "날짜", // 784:62131 "Date"
    colDescription: "설명/기간", // 784:62132 "Description"
    colAmount: "결제 금액", // 784:62133 "Amount"
    loadError: "구독 정보를 불러오지 못했어요.",
    billingLoadError: "결제 내역을 불러오지 못했어요.",
    noBilling: "결제 내역이 없습니다",
    loadMore: "다시 불러오기",
    planFallback: "프리미엄",
    planSheetTitle: "구독 플랜 선택",
    noPlansAvailable: "이용 가능한 플랜이 없어요.",
    startTrial: "체험 시작",
    subscribeShort: "구독",
    perYear: "년",
    perMonth: "월",
    voucherType: "구독권 쿠폰 적용", // MOR-018 — 수강권 was the same slip already fixed on voucherLabel
    voucherScheduled: "{plan} 구독이 예약되었어요",
    voucherApplied: "{plan} 구독이 적용되었어요",
    trialStarted: "무료 체험을 시작했어요! 🎉",
    subStarted: "구독을 시작했어요! 🎉",
    cancelScheduled: "해지 예약되었어요",
    resumed: "구독을 다시 시작했어요",
    voucherFailTitle: "쿠폰 등록에 실패했습니다",
    cancelConfirmTitle: "구독을 해지하시겠어요?", // 624:10158
    cancelConfirmText: "해지 후에는 일부 학습 기능이 제한됩니다", // 624:10159
    /** 624:10255 sets this as two lines. */
    cancelConfirmText2:
      "다음 결제일부터 자동 결제가 중단됩니다\n이미 결제된 기간 동안은 계속 이용할 수 있어요",
    cancelConfirmKeep: "취소", // 624:10161
    cancelConfirmGo: "해지", // 624:10162 — shorter than the 해지하기 link
    register: "등록하기",
    trialDaysFree: " · {n}일 무료",
    invalidCode: "유효하지 않거나 이미 사용된 코드예요",
    invalidCodeSub: "코드를 확인하고 다시 시도해 주세요",
    invoiceA11y:
      "{date}, {plan}, 이용 기간 {from}부터 {to}까지, 결제 금액 {amount}",
  },

  /**
   * Failed-automatic-payment recovery. app-authored: the payment-methods
   * management screen has no design frame in the Figma file.
   */
  paymentRecovery: {
    reasonInsufficientFunds: "잔액 부족으로 결제가 되지 않았어요.",
    reasonCardExpired: "등록된 카드의 유효기간이 만료되어 결제가 되지 않았어요.",
    reasonDeclined: "카드사에서 결제를 승인하지 않았어요.",
    reasonMethodRevoked: "등록된 결제수단을 사용할 수 없어 결제가 되지 않았어요.",
    reasonProviderOutage: "일시적인 결제 오류로 자동결제가 완료되지 않았어요.",
    reasonGeneric: "등록된 결제수단으로 자동결제가 완료되지 않았어요.",
    noticeGuidance: "다른 결제수단을 선택한 후 아래 버튼을 눌러 즉시 재결제할 수 있습니다.",
    failInsufficientTitle: "잔액 부족으로 결제가 진행되지 않았어요",
    failInsufficientSub: "다른 결제수단을 선택하거나 잔액을 확인해 주세요",
    failUnusableTitle: "현재 결제수단을 사용할 수 없어요",
    failUnusableSub: "다른 결제수단을 선택해 다시 시도해 주세요",
    failTemporaryTitle: "일시적인 오류로 결제가 완료되지 않았어요",
    failTemporarySub: "잠시 후 다시 시도해 주세요",
    failGenericTitle: "구독료 결제가 진행되지 않았어요",
    failGenericSub: "다른 카드를 선택하거나 잠시 후 다시 시도해 주세요", // 1542:23037
    today: "오늘 {time}",
    tomorrow: "내일 {time}",
    successPlanLine: "{plan} 구독이 정상적으로 결제됐어요",
  },

  /**
   * Payment methods (결제수단 관리). app-authored — this screen has no design
   * frame in the Figma file, so the English copy is written to match the
   * product voice rather than transcribed.
   */
  /** Payment methods / SET-001, Figma 1332:21963. */
  paymentMethods: {
    title: "결제수단 관리",
    loadError: "결제수단을 불러오지 못했어요.",
    failNoticeA11y: "자동 결제 실패 안내",
    failNoticeTitle: "결제에 실패했어요",
    nextRetry: "다음 자동 결제 시도일: {date}",
    payNow: "지금 바로 결제하기",
    paying: "결제 중...",
    payNowA11y: "지금 바로 구독료 결제하기",
    cardsSection: "신용/체크카드",
    addDomestic: "카드 추가(국내 카드)",
    addInternational: "카드 추가(해외 카드)",
    addDomesticA11y: "국내 카드 추가",
    addInternationalA11y: "해외 카드 추가",
    easyPaySection: "간편 결제",
    defaultMethodA11y: "{name}, 기본 결제수단 {state}",
    selected: "선택됨",
    notSelected: "선택 안 됨",
    noticeSection: "유의사항",
    notice1: "최초 1회 등록 후 서비스 이용 시 자동으로 결제됩니다.",
    notice2:
      "결제 수단별로 결제 가능 여부, 취소 정책이 다를 수 있습니다. 각 결제수단의 사용안내를 확인해 주세요.",
    notice3: "국내 카드 : 국민, 비씨, 삼성, 롯데, 우리, 하나, 신한, 현대, 농협 등",
    notice4: "해외 카드 : VISA, Master, JCB",
    domesticCardTitle: "국내 카드 등록",
    internationalCardTitle: "해외 카드 등록",
    authKeyPlaceholder: "결제창에서 발급된 인증키(authKey)",
    tossTitle: "토스페이 연결",
    tossPlaceholder: "연결 후 전달된 인증 코드(code)",
    naverTitle: "네이버페이 연결",
    naverPlaceholder: "연결 후 전달된 예약 번호(reserve_id)",
    authValueLabel: "인증 값",
    registerDone: "등록 완료",
    registered: "등록되었어요",
    selectFirst: "결제에 사용할 결제수단을 먼저 선택해 주세요.",
    checkingResult: "결제 결과를 확인하고 있어요. 잠시 후 결제 상태가 업데이트됩니다.",
    alreadyProcessed: "결제가 이미 처리되어 목록을 새로고침했어요.",
    deleteTitle: "해당 결제수단을 삭제할까요?",
    deleteText: "삭제 후에는 복구할 수 없어요",
    paySuccessA11y: "결제 완료",
    payFailA11y: "결제 실패",
    paySuccessTitle: "결제가 완료됐어요",
    payFailTitle: "결제에 실패했어요",
    paySuccessSub: "이제 모든 학습 콘텐츠를 계속 이용할 수 있어요",
    paySuccessConfirmA11y: "결제 완료 확인",
    payFailConfirmA11y: "다른 결제수단 선택하기",
    chooseAnother: "다른 결제수단 선택",
    tossPay: "토스페이",
    naverPay: "네이버페이",
    planFallback: "프리미엄",
    disconnectA11y: "{name} 연결 해제",
    connectA11y: "{name} 연결하기",
    connect: "연결하기",
    deleteA11y: "{name} 삭제",
    flowHint: "결제창에서 인증을 마친 뒤 발급되는 값을 붙여넣어 등록을 완료해요.",
    openPaymentWindow: "결제창 열기 ↗",
    delete: "삭제",
    retryingStatus: "결제를 진행하고 있어요",
    changingDefaultStatus: "기본 결제수단 변경 중",
  },

  /** Terms & policies / TRM-001, Figma 1:1599 (EN 784:49774). */
  policy: {
    title: "약관 및 정책",
    termsOfUse: "이용약관", // 1:1620
    privacy: "개인정보처리 방침", // 1:1619
    refund: "구독 해지 및 환불 정책", // 926:19260
    businessTitle: "사업자 정보", // 1:1614
    /** 175:7490 — the design sets this as one block; kept per line here. */
    bizCeo: "대표이사: 유재희",
    bizEmail: "이메일: support@talkhangyul.com",
    bizRegNo: "사업자등록번호: 403-87-03380",
    bizAddress: "주소: 서울특별시 도봉구 우이천로38길 39",
    bizMailOrder: "통신판매업 신고번호 : 제2026-서울도봉-0542호",
    bizPhone: "전화번호 : 010-3560-8679",
    bizCopyright: "Copyright © 2025 HanGyul. All Rights Reserved.",
    effectiveDate: "시행일 {date}",
  },

  /** League — LEG-001/002 (Figma 430:7619 / EN 784:57704) and the guide sheet. */
  league: {
    /** LEG-002 1423:22087 renders "Green League"; the Korean is "Green 리그". */
    tierLabel: "{tier} 리그",
    tabRegular: "정규 리그",
    guideTitle: "정규 리그",
    tabFriends: "친구 리그",
    manageFriends: "친구 관리",
    history: "히스토리", // 893:24879 "History"
    historyA11y: "리그 히스토리 보기",
    progressA11y: "리그 진행 상황",
    tablistA11y: "리그",
    currentLeague: "현재 리그",
    locked: "잠김",
    timeLeft: "남은 시간: {time}",
    endingSoon: "곧 종료돼요",
    loadError: "리그 정보를 불러오지 못했어요.",
    noLeague: "아직 참가 중인 리그가 없어요",
    noRanking: "아직 순위가 없어요",
    openGuide: "리그 안내 열기",
    rankRowA11y: "{rank}위 {name}{me} {points}포인트",
    meSuffix: " (나)",
    /* guide sheet */
    noDemotion: "(강등 없음)",
    noPromotion: "(승급 없음)",
    ruleAttendance: "출석",
    ruleAttendanceDetail: "7일 연속 출석 시 +10P",
    ruleAttendanceAria: "출석, 5포인트, 7일 연속 출석 시 10포인트 추가",
    ruleLearning: "맞춤 학습",
    ruleLearningDetail1: "문장/문제당 +10P",
    ruleLearningDetail2: "레벨 클리어 시 +100P",
    ruleLearningAria: "맞춤 학습, 10포인트, 문장 또는 문제당 10포인트, 레벨 클리어 시 100포인트",
    ruleCourse: "강의",
    ruleCourseDetail: "강의 전체 시청 완료 시 +100P",
    ruleCourseAria: "강의, 100포인트, 강의 전체 시청 완료 시 100포인트",
    ruleReview: "복습",
    ruleReviewDetail: "저장한 문장/문제 복습 완료 시 +5P",
    ruleReviewAria: "복습, 5포인트, 저장한 문장 또는 문제 복습 완료 시 5포인트",
    intro1: "전 세계 학습자들과 경쟁하며",
    intro2: "한국어 실력을 키워보세요",
    intro3: "공부할수록 점수와 순위가 오르고",
    intro4: "도전할수록 더 빠르게 성장할 수 있어요",
    scheduleRange: "매주 월요일 00:00 시작 ~ 일요일 21:00 종료",
    scheduleAnnounce: "(일요일 21시에 결과 발표)",
    scheduleTimezone: "* 리그 운영 시간은 미국 동부 시간(ET) 기준",
    promotionHeadline: "상위 20%만 다음 리그로 승급",
    promotionAria: "상위 20%만 다음 리그로 승급, Green 리그는 강등 없음, Golden 리그는 승급 없음",
    emptyLine1: "학습을 시작하고",
    emptyLine2: "리그에 도전해보세요!",
    guideA11y: "정규 리그 안내",
    guideCloseA11y: "정규 리그 안내 닫기",
    pointsTitle: "학습할수록 리그 점수(P)가 올라가요",
    defaultNickname: "회원",
    countdown: "{d}일 {h}시간 {m}분",
    myPoints: "My 포인트",
  },

  /**
   * Sign-up. app-authored English: the Figma file has no sign-up *form* frame
   * (AME-001/002/009 cover the landing and language picker), so only the shared
   * field wording comes from the design system.
   */
  signup: {
    title: "회원가입",
    subtitle: "아래 정보들을 입력해주세요.",
    nameLabel: "이름",
    namePlaceholder: "이름을 입력하세요",
    emailPlaceholder: "이메일을 입력하세요",
    passwordLabel: "비밀번호",
    passwordPlaceholder: "영어, 숫자, 특수문자 포함 8자리 이상을 입력하세요",
    confirmLabel: "비밀번호 확인",
    confirmPlaceholder: "비밀번호를 다시 입력하세요",
    phoneCodeLabel: "휴대폰 인증번호",
    emailCodeLabel: "이메일 인증번호",
    phoneCodeA11y: "휴대폰 인증번호 확인",
    emailCodeA11y: "이메일 인증번호 확인",
    phoneRequestA11y: "휴대폰 인증번호 요청",
    emailRequestA11y: "이메일 인증번호 요청",
    termsTitle: "약관동의",
    agreeAll: "전체 동의",
    agreeAge: "[필수] 만 14세 이상 (미만 시 법정대리인 동의)",
    /** Named after the document it opens (TRM-002), not the AME-004 wording. */
    agreeTerms: "이용약관 (필수)",
    agreePrivacy: "개인정보수집 및 이용동의 (필수)",
    agreeThird: "개인정보 제 3자 제공 동의 (필수)",
    /* Optional consents — Figma AME-004 (215:6769) lists all three. */
    agreeMarketing: "이메일 및 SMS 마케팅 정보 수신 동의(선택)",
    agreeServiceNotice: "서비스 알림 수신 동의 (선택)",
    agreeAdNotice: "광고성 알림 수신 동의 (선택)",
    submit: "회원가입",
    errName: "이름을 입력해 주세요.",
    errPhoneVerify: "휴대폰 인증을 완료해 주세요.",
    errEmailVerify: "이메일 인증을 완료해 주세요.",
    errConfirm: "비밀번호가 일치하지 않아요.",
    errAgree: "필수 약관에 모두 동의해 주세요.",
    errForm: "입력 정보를 다시 확인해 주세요.",
    viewDetailA11y: "{name} 자세히 보기",
  },

  /** Find Email — no match. app-authored (no design frame located). */
  findEmailNoMatch: {
    titleLine1: "일치하는 회원정보가",
    titleLine2: "없어요",
    descLine1: "입력하신 회원정보와 일치하는 계정을 찾을 수 없어요",
    descLine2: "정보를 다시 확인해주세요",
    prompt: "처음이신가요?",
    signupLink: "회원가입하기",
    retry: "다시 입력하기",
    retryA11y: "다시 입력하기, 이메일 찾기 화면으로 돌아가기",
  },

  /** Social-login callback. app-authored (no design frame). */
  authComplete: {
    loading: "로그인 중…",
    cancelled: "로그인을 취소했어요.",
    invalidState: "로그인 세션이 만료되었어요. 다시 시도해 주세요.",
    notConfigured: "이 제공자의 로그인이 아직 설정되지 않았어요.",
    loginFailed: "로그인을 완료하지 못했어요. 다시 시도해 주세요.",
  },

  /** Withdrawal password step. app-authored (no design frame located). */
  withdrawPassword: {
    title: "비밀번호 입력", // 3085:27269
    /** 3085:27270 sets this as two lines. */
    guide: "회원님의 안전한 탈퇴 진행을 위해\n비밀번호를 입력해주세요",
    placeholder: "비밀번호를 입력해주세요", // I3085:27271;3021:65660
    a11y: "현재 비밀번호",
    empty: "비밀번호를 입력해주세요.",
  },

  /** First-run language chooser — AME-001 (1:12486 / EN 784:53343). */
  languagePicker: {
    title: "어떤 언어로 시작할까요?", // 1:12772
    start: "시작하기", // I1:12744;3034:65139
  },

  /** Cancellation-reason step — MOR-012 (725:20721) / MOR-013 (726:21002). */
  cancelReason: {
    title: "해지 사유를 선택해주세요", // 725:20724
    subtitle: "서비스 개선을 위해 참고됩니다 (선택사항)", // 725:20725
    price: "가격이 부담됩니다",
    usage: "이용 빈도가 낮습니다",
    features: "기대한 기능이 충분하지 않습니다",
    competitor: "다른 서비스를 이용하고 있습니다",
    other: "기타 (직접입력)",
    placeholder: "내용을 입력해주세요.", // 726:21064
    skip: "건너뛰기", // 725:20728
    submit: "제출", // 725:20729
  },

  /** Subscription-code modal. app-authored (no design frame located). */
  voucher: {
    title: "구독권 코드 등록",
    closeA11y: "구독권 코드 등록 창 닫기",
    codeA11y: "구독권 코드",
    empty: "코드를 입력해주세요.",
    note1: "코드 확인 후 즉시 구독 적용",
    note2: "기존 구독 종료 후 순차 적용",
    submit: "등록하기",
  },

  /** Subscription purchase / SET-030–032. app-authored English. */
  purchase: {
    planYear: "12개월",
    planMonth: "1개월",
    selectedSuffix: ", 선택됨",
    launchDiscount: "런칭 기념 특별 할인",
    perMonth: "/월",
    /** `<s>` marks the cream-highlighted run in the CTA (Figma I1:4089). */
    startTrial: "<s>7일 무료 체험</s>  시작하기",
    startNow: "지금 바로 시작하기",
    close: "닫기",
    productsTitle: "구독 상품",
    cancelAnytime: "구독은 언제든지 취소할 수 있어요", // 1:4075
    trialNote:
      "7일 무료 체험 종료 후 선택한 플랜으로 자동 결제됩니다.\n연간 구독은 결제일로부터 30일 초과 시 환불이 제한됩니다.", // 898:19355
    paidNote: "선택한 플랜으로 자동 결제됩니다.\n연간 구독은 결제일로부터 30일 초과 시 환불이 제한됩니다.",
    loading: "불러오는 중…",
    loadError: "정보를 불러오지 못했어요.",
    eyebrow: "일주일 무료로 먼저 체험해보세요.", // 1:4077
    heroLine1: "지금 시작 하면,", // 1:4078
    heroLine2: "모든 학습을 자유롭게 이용할 수 있어요",
    heroDesc: "한귤과 함께하면 말하는 실력이 달라집니다",
    noProducts: "이용 가능한 구독 상품이 없어요. 잠시 후 다시 확인해 주세요.",
    refundPolicy: "[환불 정책 보기]", // 898:19355
    // 2525:26551 — spaces 결제 수단, and the CTA is 등록 (not 등록하기).
    needMethodTitle: "결제 수단 등록이 필요해요",
    needMethodLine1: "무료 체험 또는 구독을 시작하려면",
    needMethodLine2: "먼저 결제 수단을 등록해주세요",
    planYearA11y: "12개월 요금제{selected}. 월 {monthly} 상당, 연 {total} 청구.",
    planMonthA11y: "1개월 요금제{selected}. 월 {monthly}.",
    registerMethod: "결제 수단 등록", // 2525:26551
    /** `<s>` marks the highlighted badge; Korean adds a trailing "된 가격"
        that English does not have. */
    discountedPrice: "<s>최대 {pct}%할인</s> 된 가격", // 2532:26708
    discountPct: "{pct}% 할인",
    perMonthPriceWithTotal: "{price}/월 ({total})",
  },

  /** Saved sentences / TAL-038, Figma 537:9613. */
  saved: {
    sortRecent: "최신순",
    sortMostWrong: "오답 많은 순",
    sortLeastRecent: "오래 안 본 순",
    filterAll: "전체",
    filterReading: "읽기",
    filterListening: "듣기",
    filterWriting: "쓰기",
    savedSentences: "저장한 문장",
    savedQuestions: "저장한 문제",
    audioError: "오디오를 재생할 수 없어요.",
    /* TAL-039(empty) 3161:33815 / (empty2) 3161:33783 and TAL-043(empty)
       3253:37213 / TAL-044(empty) 3253:37215. All four frames carry the SAME
       string per mode — the 오답 and 찜한 tabs are not distinguished here. */
    emptySentences: "저장된 문장이 없어요",
    emptyQuestions: "저장된 문제가 없어요",
    sourceLabel: "저장 소스",
    wrongSentences: "오답 문장",
    likedSentences: "찜한 문장",
    wrongQuestions: "오답 문제",
    likedQuestions: "찜한 문제",
    search: "검색",
    topikSection: "TOPIK 영역",
    noResults: "검색결과가 없어요",
    removeFromWrong: "오답에서 삭제",
    unbookmark: "찜 해제",
    reviewSentenceA11y: "{sentence} 문장 복습하기",
    reviewQuestionA11y: "{title} 문제 복습하기",
    playSentenceA11y: "{sentence} 듣기",
    stopSentenceA11y: "{sentence} 재생 멈추기",
    quizTitle: "[TOPIK {level}급{skill}]",
    loadError: "불러오지 못했어요.",
    loadMore: "다시 불러오기",
  },

  /** Notifications / NOT-001. app-authored English. */
  /** Notification centre / PUS-001, Figma 766:48530. */
  notifications: {
    title: "알림",
    all: "전체",
    learning: "학습",
    notice: "공지",
    social: "소셜",
    emptyFiltered: "해당 알림이 없어요",
    emptyAll: "아직 새로운 알림이 없어요", // 1678:25777
    categoriesA11y: "알림 카테고리",
    filterA11y: "{name} 알림 보기",
    newPrefix: "새 알림. ",
    read: "읽음",
    unread: "읽지 않음",
    loadError: "알림을 불러오지 못했어요.",
    loadMore: "더 불러오기",
    cardA11y: "{newFlag}{group} 알림, {readState}. {title}. {body} {time}",
    today: "오늘",
    yesterday: "어제",
    justNow: "방금",
    minutesAgo: "{n}분 전",
    hoursAgo: "{n}시간 전",
    monthDay: "{m}월 {d}일",
    yearMonthDay: "{y}년 {m}월 {d}일",
  },

  /** Offline state — Figma SYS-001 (1567:25122). */
  offline: {
    title: "인터넷 연결을 확인해주세요",
    line1: "네트워크가 연결되지 않았어요",
    line2: "Wi-Fi 또는 데이터를 켜주세요",
    retry: "다시 시도",
  },

  /** Onboarding questionnaire. app-authored English. */
  onboarding: {
    progressA11y: "온보딩 진행률",
    next: "다음",
    startNow: "지금 시작하기",
    goStart: "바로 시작하기",
    recommendedPill: "추천",
    introTitle: "환영합니다!",
    introLine1: "여러분의 학습 목표를 더 잘 이해하기 위해",
    introLine2: "간단한 질문 몇 가지를 준비했어요.",
    introLine3: "부담 갖지 마시고 편하게 답해 주세요.",
    introLine4: "여러분께 딱 맞는 학습 계획을 세우는 데 큰 도움이 될 거예요!",
    introArtA11y: "한귤 캐릭터들이 환영하는 그림",
    purposeA11y: "학습 목적 선택",
    purposeLine1: "한국어를 어떤 목적으로",
    purposeLine2: "배우고 싶으신가요?",
    purposeConv: "회화",
    purposeConvSub: "（말하기 중심）", // 67:6155 — fullwidth parentheses
    purposeConvA11y: "회화, 말하기 중심",
    purposeTopik: "TOPIK",
    purposeTopikSub: "(시험 대비)",
    purposeTopikA11y: "TOPIK, 시험 대비",
    speakingQ: "한국어 말하기 수준은 어느 정도인가요?",
    speakingA11y: "한국어 말하기 수준",
    speakingNone: "처음이에요",
    speakingWords: "단어만",
    speakingSimple: "간단한 문장",
    speakingDaily: "일상 대화",
    speakingFluent: "유창",
    topikQ: "함께 목표할 TOPIK 급수를 골라주세요",
    topikA11y: "목표 TOPIK 급수",
    topikBasic: "기초",
    topikBeginner: "초급",
    topikIntermediate: "중급",
    topikUpperIntermediate: "중상급",
    topikAdvanced: "고급",
    topikMastery: "최상급",
    goalLast: "마지막 질문이에요!",
    goalA11y: "하루 학습 목표",
    goalBasic: "기본 모드",
    goalRoutine: "추천 루틴 모드",
    // TAL-036/037 paint the "추천" run mint and the mode name Gray 6, so the two
    // runs are separate keys. `goalRoutine` stays whole for onboarding + a11y.
    goalRoutineRec: "추천",
    goalRoutineBase: "루틴 모드",
    goalFocus: "집중 모드",
    goalImmersion: "몰입 모드",
    goalConquer: "정복 모드",
    sentenceCount: "{n}개",
    goalOptionA11y: "{n}개, {mode}",
    gradeLabel: "{n}급",
    gradeOptionA11y: "{n}급, {badge}",
    sentenceHeading: "하루에 몇 문장씩 연습할까요?", // 2149:24792
    questionHeading: "하루에 몇 문제씩 연습할까요?", // 2149:24877
    /* The free-plan notice above the options (2149:24792 / 2149:24877). */
    goalNoticeSentences: "무료 플랜은 하루 5문장까지 제공돼요\n지금 선택한 목표는 프리미엄으로 전환하면 자동으로 적용돼요",
    goalNoticeQuestions: "무료 플랜은 하루 5문제까지 제공돼요\n지금 선택한 목표는 프리미엄으로 전환하면 자동으로 적용돼요",
  },

  /** Conversation session — incorrect/retry/pronunciation states. */
  sessionConversation: {
    incorrectStatus: "다시 생각해보세요",
    hint: "힌트보기",
    answer: "정답보기",
    voiceMode: "음성 모드",
    keyboardMode: "키보드 모드",
    pronunciationTitle: "발음 정확도",
    pronunciationFallback: "조금 더 또렷하게 말해보세요.",
    scoreA11y: "발음 정확도 {percent} 퍼센트",
    evaluationError: "채점하지 못했어요. 잠시 후 다시 시도해 주세요.",
    micPermission: "마이크 권한이 필요해요. 브라우저 설정을 확인해 주세요.",
    bookmarkSave: "저장",
    bookmarkUnsave: "저장 해제",
    recordA11y: "따라 말하기",
    stopRecordA11y: "녹음 멈추기",
    micRetryA11y: "다시 녹음하기",
    levelTitle: "회화 Lv.{level}",
  },

  /** TOPIK session. */
  topikSession: {
    title: "문제를 풀어보세요",
    submit: "제출",
    next: "다음",
    complete: "완료",
    resultCorrectTitle: "정답이에요!",
    resultRetryTitle: "다시 풀어보세요",
    audioTrack: "Track 1",
    answerPlaceholder: "답을 입력하세요",
    blankPlaceholder: "답을 입력하세요",
    charCount: "{current}/{max}",
    minLengthHint: "{min}자 이상 작성해 주세요.",
    overMaxHint: "{max}자 이하로 작성해 주세요.",
    correct: "정답이에요! 🎉",
    incorrect: "아쉬워요 💪",
    correctAnswerLabel: "정답: {answer}",
    scoreLabel: "{score} / {max}점",
    suggestionsTitle: "이렇게 고쳐보세요",
    grammarTitle: "문법 피드백",
    correctedTitle: "고친 문장",
    awaitingReview: "제출됐어요. 채점을 기다리고 있어요 ✍️",
    unsupported: "이 문제 유형은 아직 지원되지 않아요. 다른 문제로 넘어가 주세요.",
    saveQuestion: "문제 저장",
    removeSaved: "저장 해제",
    audioPlay: "듣기 재생",
    audioPause: "듣기 멈춤",
    audioLoading: "불러오는 중",
    audioError: "오디오를 재생하지 못했어요.",
    scoreA11y: "점수 {percent}점",
  },

  /** Saved-item review session. */
  reviewSession: {
    sentenceTitle: "저장한 문장",
    questionTitle: "저장한 문제",
    restart: "다시 시작",
    complete: "완료",
    rewardTitle: "복습 완료!",
    rewardSubtitle: "확실히 익히고, 포인트까지",
    confirm: "확인",
    closeA11y: "복습 완료 창 닫기",
    rewardA11y: "복습을 완료하고 {points}포인트를 획득했어요.",
    reviewSentenceA11y: "이 문장 복습하기",
    reviewQuestionA11y: "이 문제 복습하기",
    startError: "복습을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.",
    loadError: "복습할 내용을 불러오지 못했어요.",
  },

  /** Notices list / detail. */
  notice: {
    title: "공지사항",
    empty: "아직 등록된 공지사항이 없어요",
    errorTitle: "공지사항을 불러오지 못했어요",
    notFoundTitle: "공지사항을 찾을 수 없어요",
    notFoundBody: "삭제되었거나 주소가 올바르지 않아요.",
    backToList: "공지사항 목록으로",
    newBadgeLabel: "새 공지",
  },

  /** Daily attendance completion modal. */
  attendance: {
    // MAI-003 KO — 794:76182 (base, 연속 3일) and 794:76193 (연속 7일) use the
    // same templated copy, so the streak count is the only thing that varies.
    title: "오늘 출석 완료!",
    streak: "연속 {days}일 달성",
    points: "+{points}P",
    confirm: "확인", // I794:76173;3021:65365
    closeA11y: "출석 완료 창 닫기",
    confirmA11y: "출석 완료 확인",
    dialogA11y: "오늘 출석 완료",
  },

  /** Add-friend sheet + incoming friend-request sheet. */
  addFriend: {
    title: "친구 추가",
    close: "친구 추가 닫기",
    infoAcceptance: "친구가 신청을 수락하면 서로 친구가 됩니다.",
    infoVisibility: "친구는 내 리그 현황과 프로필을 볼 수 있습니다.",
    /* 2382:25195 is the field LABEL; 2382:25225 is the placeholder. The app had
       been using the label text as the placeholder and drawing no label. */
    searchLabel: "전화번호로 찾기",
    searchPlaceholder: "'-'를 제외하고 입력하세요",
    searchAria: "전화번호로 친구 찾기",
    search: "검색",
    suggested: "추천 친구",
    suggestedSub: "*연락처 기반으로 친구를 추천했어요",
    noRecommendations: "추천할 친구가 없어요",
    invite: "친구 신청 링크 보내기",
    inviteAria: "친구 신청 링크 공유하기",
    sendRequest: "친구 신청",
    cancelRequest: "요청 취소",
    accept: "수락",
    friendsLabel: "친구",
    notFoundTitle: "해당 전화번호로 가입한 사용자를 찾을 수 없어요",
    notFoundSub: "번호를 확인하거나 친구 신청 링크를 보내보세요.",
    requestSent: "친구 신청을 보냈어요",
    requestCancelled: "요청을 취소했어요",
    requestAccepted: "친구가 되었어요!",
    linkCopied: "링크가 복사되었어요. 친구에게 링크를 보내보세요!",
    linkCopyFailed: "링크를 복사하지 못했어요. 다시 시도해 주세요.",
    ctaFriends: "{name}, 이미 친구",
    ctaRequestSent: "{name}, 요청 취소 가능",
    ctaRequestReceived: "{name}, 수락 가능",
    ctaCanRequest: "{name}, 친구 신청 가능",
  },

  /** Incoming friend-request sheet. */
  incomingRequest: {
    title: "친구 요청",
    close: "친구 요청 닫기",
    infoRequested: "{name}님이 친구를 신청했어요",
    infoVisibility: "수락하면 서로의 리그 현황과 프로필을 볼 수 있습니다",
    reject: "거절",
    accept: "수락",
    loadError: "요청을 불러오지 못했어요.",
    accepted: "{name}님과 친구가 되었어요!",
    rejected: "요청을 거절했어요",
  },

  /** Friend management / LEG social screens. */
  friends: {
    title: "친구 관리",
    add: "친구 추가",
    addShort: "친구 추가",
    tabFriends: "친구",
    tabReceived: "받은 요청",
    tabSent: "보낸 요청",
    remove: "삭제",
    reject: "거절",
    accept: "수락",
    openRequest: "요청 열기",
    friendsEmptyTitle: "아직 친구가 없어요",
    friendsEmptyDesc1: "친구를 추가하고",
    friendsEmptyDesc2: "함께 공부해 보세요!",
    receivedEmptyTitle: "받은 친구 요청이 없어요",
    receivedEmptyDesc1: "친구가 요청을 보내면",
    receivedEmptyDesc2: "이곳에 표시돼요",
    sentEmptyTitle: "보낸 친구 요청이 없어요",
    sentEmptyDesc1: "함께 공부하고 싶은 친구에게",
    sentEmptyDesc2: "요청을 보내보세요",
    listError: "목록을 불러오지 못했어요.",
    modalTitle: "{name}님을 친구에서 삭제할까요?",
    modalDesc: "상대방에게 알림은 가지 않습니다.",
    toastAccepted: "{name}님과 친구가 되었어요!",
    toastRejected: "요청을 거절했어요",
    toastCancelled: "요청을 취소했어요",
    toastRemoved: "친구를 삭제했어요",
    requestAge: "{age} 요청",
    addFriendCta: "+ 친구 추가",
  },

  /** Relative time shared by friend requests and other lists. */
  time: {
    justNow: "방금 전",
    minutesAgo: "{n}분 전",
    hoursAgo: "{n}시간 전",
    daysAgo: "{n}일 전",
  },

  /** My Points (league point ledger). */
  points: {
    currentLeague: "이번 리그 포인트",
    emptyTitle: "아직 이번 리그에서 적립된 포인트가 없어요",
    emptyDesc: "학습을 시작하면 이번 리그 포인트가 적립됩니다.",
    error: "포인트를 불러오지 못했어요.",
    loadMore: "더 보기",
    listAria: "포인트 적립 내역",
    reasonAttendance: "출석 체크",
    reasonSentence: "맞춤 학습",
    reasonLecture: "강의 시청",
    reasonReview: "복습",
    reasonLevelUp: "레벨업",
    descAttendance: "일일 출석",
    descStreakBonusDays: "연속 {days}일 출석 보너스",
    descStreakBonus: "연속 출석 보너스",
    descQuestionDone: "문제 학습 완료",
    descSentenceDone: "문장 학습 완료",
    descLectureDone: "강의 시청 완료",
    descQuestionReview: "문제 복습 완료",
    descSentenceReview: "문장 복습 완료",
    descLevelReached: "레벨 {level} 달성",
    descLevelUpBonus: "레벨업 보너스",
    rowA11y: "{title}, {desc}, {amount}포인트 {direction}, {date}",
    directionEarned: "적립",
    directionDeducted: "차감",
  },

  /** League history. */
  leagueHistory: {
    title: "리그 히스토리",
    ongoing: "진행 중",
    emptyTitle: "이 시즌의 리그 기록이 없어요",
    emptyDesc: "참여한 리그 기록이 생기면 여기에 표시됩니다.",
    seasonError: "시즌 정보를 불러오지 못했어요.",
    listError: "리그 기록을 불러오지 못했어요.",
    loadMore: "다시 불러오기",
    listAria: "리그 기록",
    seasonPickerAria: "시즌 목록",
    heroName: "{quarter} 시즌 리그",
    optionLabel: "{year} {quarter} 시즌",
    selectAria: "{label} 선택됨, 시즌 변경",
    rangeA11y: "{from}부터 {to}까지",
    rankA11y: ", {current}{rank}위",
    currentPrefix: "현재 ",
    pointsA11y: ", {points}포인트",
    quarterSpring: "봄",
    quarterSummer: "여름",
    quarterFall: "가을",
    quarterWinter: "겨울",
    spokenDate: "{m}월 {d}일",
  },

  /** Friend League empty state. */
  friendLeague: {
    emptyTitle: "친구 리그에 참가할 친구가 없어요",
    emptyLine1: "친구를 추가하고",
    emptyLine2: "함께 경쟁해보세요!",
    rankingAria: "친구 리그 순위",
    podiumA11y: "{rank}위, {name}, {points}포인트",
    rowA11y: "{rank}위, {name}{league}, {points}포인트{me}",
    leagueSuffix: ", {league}",
    meSuffix: ", 현재 사용자",
    addFriend: "친구 추가",
  },

  /** Shared UI primitives (states, fields, selects) and network errors. */
  ui: {
    loading: "불러오는 중…",
    emptyTitle: "아직 항목이 없어요",
    errorTitle: "문제가 생겼어요",
    errorBody: "오류가 발생했어요.",
    countrySelect: "국가 선택",
    countrySelectA11y: "국가 선택, 현재 {name}",
    /* Country names for the phone-prefix selector. Every entry goes through
       the catalog — the table in lib/format.ts holds only ISO codes, dial
       codes and flags, so no country name is hardcoded outside i18n. */
    countries: {
      KR: "대한민국",
      US: "미국",
      JP: "일본",
      CN: "중국",
      VN: "베트남",
      TH: "태국",
      ID: "인도네시아",
      FR: "프랑스",
      DE: "독일",
    },
  },

  /** Network / API error messages surfaced by the http layer. */
  httpError: {
    forbidden: "권한이 없어요.",
    network: "네트워크에 연결할 수 없어요. 인터넷 연결을 확인해 주세요.",
    unknown: "알 수 없는 오류가 발생했어요.",
    badRequest: "요청을 처리하지 못했어요.",
    notFound: "요청한 정보를 찾을 수 없어요.",
    server: "일시적인 서버 오류예요. 잠시 후 다시 시도해 주세요.",
  },

  /** Password rules shown under the field. */
  validation: {
    passwordLength: "8~64자로 입력해 주세요.",
    passwordComposition: "영문·숫자·특수문자를 모두 포함해야 해요.",
    passwordMismatch: "비밀번호가 일치하지 않아요.",
  },

  /** FAQ / FAQ-001, Figma 175:7363. */
  faq: {
    catBilling: "결제 · 구독",
    catAccount: "계정",
    catError: "오류",
    catHowTo: "이용방법",
    catPartnership: "제휴 · 제안",
    searchAria: "FAQ 검색",
    noResults: "검색 결과가 없어요",
    noResultsDesc: "다른 검색어로 다시 찾아보세요",
    noQuestions: "등록된 질문이 없어요",
    askAnything: "무엇이든 물어보세요",
    searchResults: "검색 결과",
    notFoundTitle: "찾을 수 없는 질문이에요",
    notFoundBody: "삭제되었거나 주소가 올바르지 않아요.",
    chatSupport: "채팅 상담하기",
    chatSupportError: "상담 채팅을 열 수 없어요. 잠시 후 다시 시도해 주세요.",
  },

  /** Small shared components. */
  misc: {
    brandLogoA11y: "한귤 Hangyul",
    aiName: "한귤AI",
    askAnything: "무엇이든 물어보세요!",
    explanationError: "설명을 불러오지 못했어요.",
    tossPay: "토스페이",
    naverPay: "네이버페이",
    sunNotStudied: "오늘 아직 학습하지 않았어요",
    sunStudied: "오늘 학습을 시작했어요",
    sunLoading: "학습 현황을 불러오는 중",
    sectionStreak: "연속 학습",
    sectionManagement: "학습 관리",
    sectionAria: "학습 섹션",
    sectionChangeA11y: "학습 섹션 변경",
    logoutTitle: "로그아웃 하시겠습니까?",
    logoutBody: "학습 기록은 계정에 안전하게 저장돼요.",
    logout: "로그아웃",
    unsavedTitle: "변경사항을 저장하지 않고 나갈까요?",
    unsavedBody: "변경사항이 적용되지 않습니다",
    unsavedContinue: "계속하기",
    unsavedLeave: "나가기",
  },

  /** Learn hub (더 배우기). */
  learn: {
    title: "학습",
    conversation: "회화 학습",
    conversationDesc: "문장을 듣고 따라 말하며 배워요",
    topik: "TOPIK 학습",
    topikDesc: "급수별 문제로 실전 감각을",
    recommendations: "AI 추천 문장",
    recommendationsDesc: "상황별 문장을 추천받고 대화해요",
    exams: "TOPIK 기출 모의고사",
    examsDesc: "실제 기출로 실전 감각 키우기",
    courses: "강의",
    coursesDesc: "코스별 영상 강의로 차근차근",
    saved: "저장 · 복습",
    savedDesc: "즐겨찾기와 오답을 모아봐요",
    aiTutor: "AI 튜터와 대화",
    aiTutorDesc: "원하는 상황의 맞춤 문장 받기",
    more: "더 배우기",
  },

  /** Personalized learning hub. */
  personalized: {
    title: "맞춤 학습",
    /* The dashboard card's heading. The API sends one untranslated track name,
       so the title is resolved from the track's category instead. */
    conversationTrack: "실전 회화",
    topikTrack: "TOPIK",
    settings: "맞춤 학습 설정",
    review: "복습하기",
    goalAchieved: "오늘 목표 100% 달성! 대단해요 ✨",
    keepGoing: "할 수 있어! 화이팅!",
    startNow: "바로 시작하기",
    continueLearning: "이어서 학습하기",
    retryWrong: "오답 다시 풀기",
    reviewFavorites: "즐겨찾기 복습",
    dailyGoal: "하루 목표",
    learningModes: "학습 모드",
    streakCalendarA11y: "연속 학습 {days}일, 달력 열기",
    chatbotA11y: "AI 챗봇과 자유롭게 대화하기",
    grade: "{n}급",
  },

  /** Practice settings / TAL-034, Figma 1825:32476. */
  personalizedSettings: {
    title: "학습 설정",
    hint: "맨 위 학습이 홈에 먼저 표시돼요",
    dragHint: "{handle}를 끌어 순서를 바꿀 수 있어요",
    empty: "사용 중인 맞춤 학습이 없어요.",
    loadError: "학습 설정을 불러오지 못했어요.",
    listAria: "맞춤 학습 목록",
    conversationTrack: "실전 회화",
    reorderError: "순서를 저장하지 못했어요. 다시 시도해 주세요.",
    summaryLevelTopik: "{level}급",
    summaryLevelConversation: "Lv.{level}",
    summaryGoal: "목표 {goal}",
    /* TAL-034 KO lists 실전 회화 as "Lv.2" and TOPIK as "1급" — the conversation
       track uses Lv. in Korean too, where this said 레벨. */
    levelTopik: "{n}급",
    levelConversation: "Lv.{n}",
    reorderA11y: "{name} 순서 변경, 위아래 방향키로 이동",
    itemA11y: "{name}, {level}, 하루 목표 {goal}, {pos}번째 항목 (총 {total}개)",
    movedA11y: "{name} {pos}번째로 이동했어요",
    openDetailA11y: "{summary}, 상세 설정 열기",
  },

  /** Track settings (level + daily goal). */
  trackSettings: {
    levelSection: "레벨 선택",
    goalSection: "하루 목표",
    save: "저장하기",
    saved: "저장했어요",
    loadError: "설정을 불러오지 못했어요.",
    conversationTrack: "실전 회화",
    topikTitle: "TOPIK",
    selectedSuffix: ", 선택됨",
    gradeLabel: "{n}급",
    levelLabelConversation: "Lv.{n}",
    topikLevelA11y: "TOPIK {n}급",
    conversationLevelA11y: "회화 레벨 {n}",
    goalA11y: "하루 목표 {n}개, {mode}",
  },

  /** Learning management (study records). */
  learningManagement: {
    title: "내 학습 기록",
    todayHeading: "오늘의 학습",
    todayTime: "오늘 공부한 시간",
    sentences: "학습한 문장 수",
    questions: "학습한 문제 수",
    countUnit: "{n}개", // 1916:25920
    periodHeading: "기간별 학습 시간",
    /* Weekly x-axis label. The 7일/3개월/1년 axes come from Intl, which has no
       week formatter — matches what the API used to send. */
    weekLabel: "{n}주",
    period: "기간",
    periodAria: "기간 선택",
    thisMonth: "이번 달",
    last7: "최근 7일",
    last3m: "최근 3개월",
    last1y: "최근 1년",
    emptyTitle: "학습 기록이 아직 없어요",
    emptyLine1: "첫 학습을 시작하고",
    emptyLine2: "당신의 기록을 만들어 보세요!",
    startLearning: "학습 시작하기",
    startLearningA11y: "학습 시작하기, 맞춤 학습으로 이동",
    waiting: "첫 학습을 기다리고 있어요!",
    praise: "꾸준히 쌓이는 기록, 대단해요!",
    loading: "불러오는 중",
    loadError: "학습 기록을 불러오지 못했어요.",
  },

  /** Streak calendar. */
  streak: {
    litTitle: "연속 학습으로 태양이 빛나는 중",
    unlitTitle: "연속 학습이 멈췄어요",
    unlitDesc: "학습하면 태양이 다시 빛날 거예요!",
    done: "완료",
    loadError: "학습 기록을 불러오지 못했어요.",
    streakDays: "꾸준히 {days}일!",
    prevMonth: "이전 달",
    nextMonth: "다음 달",
    monthAria: "{y}년 {m}월 학습 달력",
    monthLabel: "{y}년 {m}월",
    dayA11y: "{y}년 {m}월 {d}일",
    dayDoneA11y: "{y}년 {m}월 {d}일, 학습 완료",
    sun: "일",
    mon: "월",
    tue: "화",
    wed: "수",
    thu: "목",
    fri: "금",
    sat: "토",
  },

  /** Level-up celebration. */
  levelUp: {
    title: "한 단계 더 나아갔어요!",
    praise: "대단해요!",
    studyTime: "공부한 시간",
    nextLevel: "다음 레벨 학습하기",
    resultA11y: "레벨업 결과",
    characterA11y: "레벨업을 축하하는 한결 캐릭터",
    reachedLevel: "레벨 {n} 달성!", // 744:46884
    /* 572:23250 — the TOPIK frame drops "토픽" and adds the 🎉 that the
       conversation frame (744:46884) does not carry. */
    reachedGrade: "{n}급 달성! 🎉",
    fromToLevel: "레벨 {prev}에서 {next}으로 올라갔어요",
    fromToGrade: "토픽 {prev}급에서 {next}급으로 올라갔어요",
    studyTimeA11y: "공부한 시간 {duration}",
    rewardA11y: "레벨업 보상 {points} 포인트",
    itemsA11y: "학습한 {unit} {count}개",
    gradeLabel: "{n}급",
    unitSentence: "문장",
    unitQuestion: "문제",
    /* 744:46901 labels the stat directly. */
    studiedSentences: "학습한 문장",
    studiedQuestions: "학습한 문제",
    /* Speech bubble over the mascot — inputField 3179:36144 / 3179:36110. */
    bubbleConversation: "이 정도 쯤이야!✨",
    bubbleTopik: "대단한걸!✨",
  },

  /** Session chrome + completion / part-selection modals. */
  session: {
    backA11y: "뒤로",
    progressA11y: "세션 진행률",
    askAiA11y: "현재 문제를 한귤AI에게 물어보기",
    askAiHint: "헷갈린 부분 내가 알려줄게!",
    expandInput: "맞춤 설정 입력창 펼치기",
    collapseInput: "맞춤 설정 입력창 접기",
    scoreA11y: "현재 학습 세트 {total}개 중 {correct}개 정답",
    completeTitle: "학습 완료!",
    completeA11y: "학습 완료",
    completeCloseA11y: "학습 완료 창 닫기",
    completeSummaryA11y: "학습 완료. 이번 세션에서 총 {count}{unit} 학습했고 {points}포인트를 획득했습니다.",
    unitSentence: "문장",
    unitQuestion: "문제",
    /* 744:46901 labels the stat directly. */
    additionalTitle: "학습을 조금 더 이어가 볼까요?",
    additionalStart: "시작할게요!",
    additionalPrompt: "추가할 {unit} 수를 선택해 주세요",
    countUnit: "{n}개",
    completeCount: "총 {count}{unit} 학습했어요 👏",
    additionalCloseA11y: "닫기",
    additionalA11y: "추가 {unit} {count}개로 학습 시작할게요",
    partTitle: "오늘은 어떤 파트를 학습해볼까요?",
    partSubtitle: "학습할 파트를 선택하세요",
    partReading: "읽기",
    partListening: "듣기",
    partWriting: "쓰기",
    partA11y: "{label} 파트로 학습 시작할게요",
    answerNext: "정답, 다음으로",
    nextQuestion: "다음 문제로",
    /** TAL-018 / COU-019 label the quiz-session restart 다시 풀기. */
    solveAgain: "다시 풀기",
    /* The left tile re-arms the current step. TAL-042's sentence review reads
       다시 시작 (784:60714), and every English twin of these two-tile sheets
       reads Retry — the 다시 듣기 in the Korean TAL-008/011 frames is stale. */
    retry: "다시 시작",
    complete: "완료",
    learningComplete: "학습 완료",
    next: "다음",
    questionLabel: "문제",
    answerLabel: "정답",
    answerWrite: "답안 작성",
    answerPlaceholder: "답을 입력하세요",
    answerFree: "자유롭게 작성하세요",
    blankAnswerA11y: "{label} 답",
    blank: "빈칸",
    blankWord: "빈칸에 들어갈 말",
    blankHint: "힌트: {hint}",
    /** TAL-006 (1718:29976) revises TAL-005's "완성해요" to "완성해봐요". */
    fillBlank: "빈칸을 채워 완성해봐요✨", // 1718:30000
    correctExclaim: "정답이에요!",
    correctA11y: "정답입니다. {korean}. {translation}",
    alreadyDone: "이 문제는 완료되었어요",
    sentenceLoadError: "문장을 불러오지 못했어요.",
    questionLoadError: "문제를 불러오지 못했어요.",
    dailySentenceGoal: "목표 하루 학습 문장",
    dailyQuestionGoal: "목표 하루 학습 문제",
    customPlaceholder: "✨ 원하는 상황을 입력하면 맞춤 문장을 추천해드려요",
    customInputA11y: "맞춤 문장 상황 입력",
    customSubmitA11y: "맞춤 문장 추천 받기",
    topikTypeAria: "TOPIK 문제 유형",
    topikTypeLabel: "[유형{n}] {title}",
    topikTypePrompt: "✨ 더 집중해서 풀어보고 싶은 문제 유형을 선택해보세요",
    topikGrade: "토픽 {n}급",
    selected: "선택됨",
    excellent: "훌륭해요! 👏",
    pointsEarned: "⚡ +{points} 포인트",
    levelLabel: "레벨 {n}",
    hint: "힌트",
  },

  /** Chat sheet (Ask AI). */
  chat: {
    ask: "물어보기",
    closeA11y: "물어보기 창 닫기",
    inputA11y: "채팅 입력",
    inputPlaceholder: "채팅을 입력하세요.",
    send: "메시지 보내기",
    loading: "답변을 불러오는 중",
    disclaimer: "AI 답변은 완벽하지 않거나 실수할 수 있어요. 참고용으로 활용해주세요.",
  },

  /** Conversation / TOPIK / practice / exam screens. */
  study: {
    conversationTitle: "회화 학습",
    noSentences: "이 레벨엔 문장이 없어요",
    tryAnotherLevel: "다른 레벨을 선택해 보세요.",
    prev: "‹ 이전",
    next: "다음 ›",
    nextSentence: "다음 문장 →",
    speak: "따라 말하기",
    stopRecording: "● 녹음 멈추기",
    mySpeech: "내가 말한 내용",
    pronunciation: "발음",
    pronunciationEval: "발음 평가",
    translation: "번역",
    micPermission: "마이크 권한이 필요해요. 브라우저 설정을 확인해 주세요.",
    practiceMore: "조금 더 연습해요 💪",
    points: "점",
    topikTitle: "TOPIK 학습",
    topikQuestions: "TOPIK 문제",
    todayQuestion: "📅 오늘의 문제",
    dailyRefresh: "매일 갱신",
    questionBank: "문제 은행",
    all: "전체",
    todayError: "오늘의 문제를 불러오지 못했어요.",
    noQuestions: "문제가 없어요",
    tryAnotherGrade: "다른 급수를 선택해 보세요.",
    typeMultiple: "객관식",
    typeShort: "단답형",
    typeEssay: "서술형",
    skillReading: "읽기",
    skillListening: "듣기",
    skillWriting: "쓰기",
    quizTitle: "문제 풀기",
    quizCorrect: "정답이에요! 🎉",
    quizWrong: "아쉬워요 😢",
    quizSubmitted: "제출 완료 ✍️",
    submit: "제출하기",
    answerPrefix: "정답:",
    backToList: "목록으로",
    reviewTitle: "복습 문제",
    reviewDesc: "복습 문제로 실력을 더 다져보세요.",
    /** COU-011 (442:9757) / COU-013 (442:9812) — the practice question card. */
    solvePrompt: "문제를 풀어보세요", // 1718:24772
    tryAgain: "다시 풀어보세요", // 1718:24826
    correctTitle: "정답이에요!", // 1718:24885 (COU-012)
    practiceCount: "연습 문제 {current}/{total}", // COU-018 511:10284
    cardNext: "다음", // 1718:24899 — plain, unlike study.next ("다음 ›")
    saveQuestion: "문제 저장",
    unsaveQuestion: "문제 저장 해제",
    /** COU-003 (1464:21369) — the review-count modal. */
    reviewPrompt: "오늘 배운 내용, 문제로 확인해보세요", // 1464:21691
    howManyQuestions: "몇 문제 풀어볼까요?", // 1464:21692
    startNow: "시작할게요!", // I1464:21699;3021:65365
    questionCount: "{n}문제",
    preparing: "문제를 준비하고 있어요…",
    seeResults: "결과 보기",
    reviewComplete: "복습 완료!",
    reviewCompleteShort: "복습 완료",
    goBack: "돌아가기",
    answer: "정답",
    submitShort: "제출",
    premiumOnly: "프리미엄 전용 기능이에요",
    upgrade: "업그레이드",
    examTitle: "TOPIK 기출 모의고사",
    examDesc: "기출 모의고사로 실전을 대비하세요.",
    examNone: "모의고사가 없어요",
    examNoItems: "문항이 없어요",
    examMock: "모의고사",
    examFree: "무료",
    examPremium: "프리미엄 전용이에요",
    examSubmit: "제출하고 채점",
    examGraded: "채점 완료",
    gradeSuffix: "{n}급",
    scoreBadge: "채점 {score}점",
    correctPct: "정답 {pct}%",
    examMeta: "{year}년 · {section} · {count}문항 · TOPIK {band}",
  },

  /** Courses / lectures. */
  /** Classes / COU-001, Figma 2407:27021. */
  courses: {
    title: "강의",
    trackAll: "전체",
    trackConversation: "회화",
    trackTopik: "토픽", // 2407:27021
    trackFilter: "트랙 필터",
    trackLabel: "{name} 강의",
    freeSuffix: ", 무료 강의",
    loadError: "강의를 불러오지 못했어요.",
    empty: "아직 등록된 강의가 없어요",
    noBanners: "표시할 배너가 없어요",
    bannerAria: "광고 배너",
    bannerItemA11y: "{alt} (배너 {i}/{total})",
    streakCalendarA11y: "연속 학습 {days}일, 달력 열기",
    streakCalendarPlainA11y: "연속 학습, 달력 열기",
    chatbotA11y: "AI 챗봇과 자유롭게 대화하기",
    resume: "이어보기",
    done: "완료",
    progress: "진행률",
    premiumLecture: "프리미엄 강의",
    completedToast: "학습을 완료했어요! 🎉",
    /** COU-002 (2414:27684) — the lesson row's completion chip and CTA. */
    /** COU-004 (230:7011) — the video player's chrome. */
    excludeSpeaking: "말하기 제외", // 230:7048
    askBubble: "궁금한 건 나한테 물어봐!", // 230:7052
    play: "재생",
    pause: "일시정지",
    back5: "5초 뒤로",
    fwd5: "5초 앞으로",
    speedA11y: "재생 속도 {rate}배",
    startNow: "바로 학습하기", // I2414:27803
    doneChip: "학습 완료", // 2414:27707
    notDone: "학습 미완료", // 2414:27720
    practiceA11y: "{title} 말하기 연습",
    quotaRemaining: "오늘 남은 추천: {n}회",
  },

  /** AI tutor chat. */
  aiChat: {
    title: "AI 튜터",
    titleEmoji: "AI 튜터 🤖",
    preparing: "대화를 준비하고 있어요…",
    inputPlaceholder: "메시지를 입력하세요",
    greeting: "안녕하세요! 한국어 학습을 도와드릴게요. 무엇이든 물어보세요 😊",
    error: "죄송해요, 답변을 가져오지 못했어요. 잠시 후 다시 시도해 주세요.",
  },

  /** AI sentence recommendations. */
  recommend: {
    title: "AI 추천 문장",
    heading: "맞춤 문장을 추천해드려요",
    prompt: "어떤 상황의 문장이 필요하세요?",
    placeholder: "예: 카페에서 주문하기 (선택)",
    hint: "원하는 상황을 입력하거나 그냥 추천 버튼을 눌러보세요.",
    cta: "추천",
    empty: "추천 결과가 없어요",
    emptyDesc: "다른 상황으로 다시 시도해 보세요.",
  },

  /** Billing history. */
  billing: {
    title: "결제 내역",
    empty: "결제 내역이 없어요",
    emptyDesc: "구독을 시작하면 여기에 표시돼요.",
    paid: "결제 완료",
    pending: "대기 중",
    unpaid: "미결제",
    cancelled: "취소됨",
    refunded: "환불됨",
  },

  /** Account management / MOR-002, Figma 1:5823. */
  account: {
    title: "계정관리",
    name: "이름",
    email: "이메일",
    phone: "휴대폰번호",
    password: "비밀번호",
    changePhone: "번호변경",
    changePassword: "비밀번호 변경",
    change: "변경하기",
  },

  /** Voucher success modal. */
  voucherSuccess: {
    title: "구독권이 등록됐습니다", // MOR-018 (1234:22843) — was "쿠폰이 등록됐습니다"
    appliedPlan: "적용된 구독",
    plan: "플랜",
    subType: "구독 유형",
    validity: "유효기간",
    singleUse: "1회 사용 후 재사용 불가",
  },

  /** League lifecycle modals + result. */
  leagueLifecycle: {
    startedTitle: "리그가 시작됐어요!",
    startedDesc: "지금부터 학습하면 순위가 바로 반영돼요",
    join: "바로 참여하기",
    finishedTitle: "지난 리그가 마무리됐어요!",
    finishedDesc: "지금 바로 결과를 확인해 보세요",
    seeResult: "결과 보러가기",
    /* 3329:37278 redraws the waiting card in Korean: same title and start-time
       line as before, now on a 217-tall card with a primary CTA. */
    preparingTitle: "다음 리그를 준비 중이에요!",
    startsAt: "{day} {time}(ET)에 시작됩니다",
    startingSoon: "곧 시작됩니다",
    backToHome: "홈화면으로 돌아가기", // 3329:37283
    /* LEG-006 (378:7138) / LEG-007 (960:25821) / LEG-008 (960:26046). */
    resultCongrats: "축하합니다!",
    resultWellDone: "잘 버텼어요!",
    resultPromoted: "상위 {rank}위 안에 들어\n{tier}로 승급했어요! 🎉",
    resultRetained: "{tier}를 지켜냈어요!\n다음엔 꼭 올라가봐요 💪",
    resultDemoted: "{tier}에서 다시 출발해요.\n작은 걸음이 큰 도약이 될 거예요🌱",
    resultTryAgain: "아쉬워요...",
    finalRank: "최종 순위 {rank}위 / {total}명",
    keepGoing: "계속 도전하기",
  },

  /** Find Email / AME-007, Figma 1:3298. */
  findEmail: {
    title: "이메일 찾기", // I1:3300;2537:25942
    subtitle: "가입 시 입력한 이름과 휴대폰번호를 입력해주세요.", // I1:3300;2537:25944
    nameLabel: "이름", // I1:3302;3021:65594
    namePlaceholder: "이름을 입력하세요", // I1:3302;3021:65597
    phoneLabel: "휴대폰번호", // 1:3305
    phonePlaceholder: "'-'를 제외하고 입력하세요", // 1234:22678
    verify: "인증하기", // I1234:22679;3021:65406
    verified: "인증완료",
    codeLabel: "인증번호 입력", // 1:3312
    codePlaceholder: "인증번호 6자리를 입력하세요", // 1612:23519
    check: "확인", // I1612:23521;3021:65406
    checkDone: "완료",
    submit: "이메일 찾기", // I1:3318;3034:65139;3021:65367
    /* app-authored validation / a11y (no Figma node). */
    nameRequired: "이름을 입력해 주세요.",
    phoneInvalid: "휴대폰 번호를 정확히 입력해 주세요.",
    phoneA11y: "휴대폰 번호",
    requestCodeA11y: "휴대폰 인증번호 요청",
    codeA11y: "인증번호",
    checkCodeA11y: "인증번호 확인",
    submitBlockedA11y: "휴대폰 인증을 완료하면 이메일을 찾을 수 있어요",
  },

  /** Find Email — result / AME-008, Figma 1:3340. */
  findEmailResult: {
    title: "이메일을 찾았어요!", // I1:3343;2537:25942
    subtitle: "다음 이메일로 가입되어 있어요.", // I1:3343;2537:25944
    forgotPrompt: "비밀번호를 잊으셨나요?", // 1:3347
    forgotLink: "비밀번호 찾기", // 1:3348
    goToLogin: "로그인하러 가기", // I1:3345;3034:65139;3021:65365
    emailA11y: "가입된 이메일 {email}", // app-authored (a11y)
  },

  /**
   * More / MOR-005 (Figma KO 1:5635 / EN 893:33047).
   *
   * The menu follows the ENGLISH frame (893:33108), which lists the eight
   * entries the app actually ships. The Korean frame (1:5697) is stale — it
   * still shows a nine-item list including 오프라인 동영상 학습 and 1:1 문의하기,
   * features that do not exist — so its wording is reused only for the entries
   * common to both.
   */
  more: {
    account: "계정 관리",
    payment: "결제수단 관리",
    language: "언어 설정", // 1:5700
    notifications: "알림 설정", // 1:5704
    friends: "친구 관리",
    announcements: "공지 사항", // 1:5618
    faq: "FAQ", // 1:5702
    terms: "약관 및 정책", // 1:5706
    /** Stats row — MOR-001_더보기메인 1:5582 / 1:5599 / 1:5611. */
    totalStudyDays: "총 학습일",
    bestStreak: "최고 연속일",
    currentStreak: "현재 연속 출석일",
    /** Comp_subs_box (1:5716). */
    myPlan: "이용 구독 플랜",
    freeTrial: "무료체험중",
    nextBilling: "다음 결제일",
    subscribe: "구독하기",
    noPlan: "이용 중인 구독 플랜이 없어요",
    subLoadError: "구독 정보를 불러오지 못했어요",
    planFallback: "구독 플랜",
    withdraw: "탈퇴하기",
    logout: "로그아웃",
    /* app-authored accessibility labels (no Figma node). */
    editProfile: "프로필 변경",
    noPlanA11y: "이용 중인 구독 플랜이 없어요. 구독 관리로 이동",
    subscribeA11y: "구독하기, 요금제와 가격 보기",
    daysSuffix: "{n}일",
  },

  /**
   * Sign-out and account-deletion outcome modals.
   *
   * app-authored: the designs cover the confirmation step (MOR-005 overlay) but
   * not the success/failure results, which exist only in the implementation.
   */
  accountFlow: {
    logoutDoneTitle: "로그아웃됐습니다",
    logoutDoneDesc: "학습 기록 및 데이터는 계정에 안전하게 보관됩니다",
    logoutFailTitle: "로그아웃에 실패했어요",
    withdrawFailTitle: "탈퇴에 실패했어요",
    temporaryError: "일시적인 오류가 발생했어요",
    tryAgainLater: "잠시 후 다시 시도해 주세요",
    withdrawDoneTitle: "탈퇴가 완료됐습니다",
    withdrawDoneLine1: "그동안 이용해 주셔서 감사합니다",
    withdrawDoneLine2: "더 나은 서비스로 다시 찾아뵙겠습니다",
    nextBillingA11y: "{plan}{billing}. 구독 관리로 이동",
    nextBillingSuffix: ", 다음 결제일 {date}",
  },

  /** Account deletion / MOR-005 overlay cp_G_01_modals (Figma 1:5719). */
  withdraw: {
    title: "회원 탈퇴", // 3085:26783
    /** 3085:26784 — an explicit two-line break (the English frame has one too),
        so it travels in the message and renders via `white-space: pre-line`. */
    subtitle: "아래의 안내 사항을 확인 후\n맨 아래의 탈퇴 신청 버튼을 눌러주세요",
    noticeTitle: "서비스 탈퇴 안내 사항", // 3085:26786
    /** 3085:26787 — a three-bullet list; the last bullet is Negative-coloured. */
    notice1: "탈퇴 이후에는 해당 계정으로 다시 가입할 수 없습니다.",
    notice2:
      "탈퇴 이후 '학습 기록, 코스 기록 등'에 대한 복구는 불가능하며 로그인이 필요한 모든 서비스를 이용하실 수 없습니다.",
    notice3:
      "탈퇴하신 경우 결제하신 서비스 이용 권한과 구독권을 포기하는 것으로 간주하며 구독권이 자동 해지되며 구독료가 환불되지 않습니다.",
    cancel: "취소", // I3085:26789;3021:65365
    confirm: "탈퇴", // I3085:26790;3021:65365
    confirmA11y: "회원 탈퇴 진행", // app-authored (a11y)
  },

  /** Notification Settings / PUS-003, Figma 1:1589. */
  notificationSettings: {
    title: "알림 설정",
    service: "서비스 알림", // 1:1594
    marketing: "광고성 알림", // 1:1597
    error: "설정을 변경하지 못했어요.", // app-authored
  },

  /** Language Settings / SET-002, Figma 1332:21988. */
  languageSettings: {
    title: "언어 설정",
    save: "저장",
    saveA11y: "언어 설정 저장", // app-authored (a11y)
    selected: "선택됨", // app-authored (a11y)
    savedModalTitle: "언어 설정이 저장됐습니다",
    savedModalDesc: "이제부터 선택하신 언어로 이용하실 수 있어요",
    errorToast: "언어 설정을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.", // app-authored
  },

  /** Friend invitation deep link (app-authored: no Figma frame for this route). */
  invite: {
    title: "친구 초대",
    invalid: "유효하지 않은 초대 링크예요",
    invalidSub: "링크가 만료되었거나 취소되었을 수 있어요.",
    isSelf: "본인의 초대 링크예요.",
    alreadyFriends: "이미 친구예요.",
    sendRequest: "친구 신청",
    accept: "수락",
    requested: "요청을 보냈어요",
    requestSent: "친구 신청을 보냈어요",
    accepted: "친구가 되었어요!",
    goToFriends: "친구 관리로 이동",
    goHome: "홈으로",
  },
};

export type Catalog = typeof ko;
