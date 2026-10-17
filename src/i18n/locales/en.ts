/**
 * English catalog.
 *
 * Typed as `Catalog`, so it must cover exactly the keys `ko` defines. Entries
 * carrying a Figma node id are transcribed from the English frame of that
 * screen — they are NOT translations of the Korean strings, and several differ
 * structurally from their Korean counterparts (word order around placeholders,
 * which segment is emphasised). Entries marked `app-authored` have no English
 * frame in the designs; those are written to match the product voice.
 */
import type { Catalog } from "./ko";

export const en: Catalog = {
  common: {
    confirm: "Confirm",
    cancel: "Cancel",
    back: "Go back", // app-authored (a11y)
    close: "Close", // app-authored (a11y)
    retry: "Try again",
    notRegistered: "Not registered", // app-authored
    networkError: "Check your network connection and try again.", // app-authored
  },

  /** Boot splash / GEN-002, Figma 784:53146 — the English frame breaks the
      tagline across two lines. */
  splash: {
    tagline: "When life gives you a tangerine\nTalk Hangyul",
    a11y: "Opening Hangyul",
  },

  /** Figma 1825:28553 — note these render at 11px, not the Korean 12px. */
  nav: {
    home: "Home",
    classes: "Classes",
    practice: "Practice",
    league: "League",
    more: "More",
  },

  /** Home / MAI-001, Figma 1825:28549. */
  home: {
    /** 1825:28613 — "Welcome, Elsy!": the greeting leads, the name is emphasised. */
    greeting: "Welcome, <s>{name}!</s>",
    /** 1825:28601 — "100-Day Streak": the count leads, unlike the Korean. */
    streak: "{days}-Day Streak",
    /** 1848:24665 */
    /** 1848:24663 */
    /** 1825:28585 / 1825:28591 */
    shortcutClasses: "Classes",
    shortcutReview: "Review",
    /** 1825:28579 / 1825:28580 */
    promoQuestion: "Not a Hangyul member yet?",
    promoCta: "Subscribe now!",
    /* app-authored accessibility labels (no Figma node). */
    notifications: "Notifications",
    notificationsUnread: "Notifications, unread items",
    trackStatus: "{name} learning progress",
    goalProgress: "{current} of {target} {label} complete, {percent} percent",
    defaultNickname: "Member",
  },

  /** Login / AME-003, Figma 784:50343. */
  login: {
    heading: "Log in", // 784:50346
    tagline: "When life gives you a tangerine Talk Hangyul", // 888:22467
    emailLabel: "Email", // I784:50366;3021:65472
    emailPlaceholder: "Enter your email", // I784:50366;3021:65475
    passwordLabel: "Password", // I784:50367;3021:65472
    passwordPlaceholder: "Enter your password", // I784:50367;3021:65475
    autoLogin: "Stay logged in", // I784:50368;3021:65722
    submit: "Log in", // I784:50369;3021:65365
    findEmail: "Find email", // 784:50371
    findPassword: "Forgot password", // 784:50372
    signup: "Sign up", // 784:50373
    /* app-authored validation / failure states (no Figma node). */
    missingFields: "Enter your email and password.",
    invalidCredentials: "That email or password isn't correct.",
  },

  /** Welcome / AME-002, Figma 784:53415. */
  welcome: {
    login: "Log in", // I784:53459;3021:65365
    signup: "Sign up", // I784:53463;3021:65374
    google: "Continue with Google", // 784:53466
    apple: "Continue with Apple", // 784:53468
    /* The three circular marks carry no label in the design; these are
       app-authored accessible names for them. */
    facebook: "Continue with Facebook",
    kakao: "Continue with Kakao",
    line: "Continue with LINE",
  },

  /** Forgot Password / AME-010, Figma 784:50299. */
  findPassword: {
    title: "Forgot password", // I784:50301;2537:25942
    subtitle: "Enter your email and phone used at sign-up.", // I784:50301;2537:25944
    submit: "Reset password", // I784:50319;3034:65139;3021:65365
    /* app-authored validation / a11y (no Figma node). */
    emailInvalid: "That email address isn't valid.",
    submitBlockedA11y: "Confirm your email and verify your phone number first",
  },

  /** Reset Password / AME-011, Figma 784:50329. */
  resetPassword: {
    title: "Reset password", // I784:50333;2537:25942
    passwordLabel: "Password", // I784:50331;3021:65472
    passwordPlaceholder: "8+ chars: letters, numbers & symbols", // I784:50331;3021:65475
    confirmLabel: "Confirm password", // I784:50332;3021:65472
    confirmPlaceholder: "Re-enter password", // I784:50332;3021:65475
    submit: "Reset password", // I784:50335;3034:65139;3021:65367
    changed: "Your password has been changed", // app-authored (toast)
  },

  /** Account changes — password screen from AME-012 (784:54846); the phone and
      email variants are app-authored (no design frame located). */
  accountChanges: {
    passwordTitle: "Change Password", // I784:54851;2537:25942
    currentPassword: "Current password", // I784:54848;3021:65472
    currentPasswordPlaceholder: "Enter current password", // I784:54848;3021:65475
    newPassword: "New password", // I784:54849;3021:65472
    newPasswordPlaceholder: "8+ chars: letters, numbers & symbols", // I784:54849;3021:65475
    confirmPassword: "Confirm new password", // I784:54850;3021:65472
    confirmPasswordPlaceholder: "Re-enter new password", // I784:54850;3021:65475
    change: "Change", // I784:54853;3034:65139;3021:65367
    passwordMismatch: "The new passwords don't match.",
    passwordWeak: "Use at least 8 characters with letters, numbers and symbols.",
    passwordSameAsCurrent: "Choose a password different from your current one.",
    passwordChanged: "Password changed. Please log in again.",
    passwordBlockedA11y: "Meet every requirement to change your password",
    phoneTitle: "Change Phone Number",
    phoneLabel: "Phone",
    phoneSame: "That's already your current number",
    phoneOtherCountry: "You can only change to a number from the country you signed up with ({country} {dial})",
    phoneCountryA11y: "Country {name}, can't be changed after sign-up",
    phoneChanged: "Your phone number has been changed",
    phoneBlockedA11y: "Verify your number to change it",
    emailTitle: "Change Email",
    emailLabel: "Email",
    emailSame: "That's already your current email",
    codeSentEmail: "We sent a verification code by email",
    verifiedPeriod: "Verified.",
    emailChanged: "Your email has been changed",
    emailBlockedA11y: "Verify your email to change it",
    verifiedWithPeriod: "Verification complete.",
    codeExpired: "The code has expired. Please resend it.",
    sending: "Sending",
    resend: "Resend",
    resendIn: "Resend {n}",
    resendA11y: "Resend verification code",
    requestCodeA11y: "Request verification code",
    emailVerifiedA11y: "Email verified",
    verifiedDoneA11y: "Verified",
    remainingA11y: "{m} minutes {s} seconds remaining",
  },

  /** Profile registration / edit — AME-006, Figma 784:55888. */
  profileSetup: {
    setupTitle: "Set up profile",
    setupSubtitle: "Let's set up your profile before you start.",
    // 893:32895 verbatim. NOTE: the EN AME-006 frame carries AME-005's heading,
    // so this screen and /setup/profile now show the same words. Applied on the
    // user's explicit "text must match Figma exactly"; KO is 프로필 변경.
    editTitle: "Set up profile",
    imageLabel: "Profile image", // 784:55890
    characterLabel: "Choose your character", // 784:55891
    choosePhoto: "Choose Photo", // 784:55981
    nicknameLabel: "Nickname", // 1612:22749
    nicknamePlaceholderSetup: "Up to 10 characters", // 1612:22753
    nicknamePlaceholderEdit: "Enter a nickname",
    checkDuplicate: "Check", // I1612:22754;3021:65406
    changeNickname: "Change", // I893:32903 renders it lowercase; capitalised on request
    start: "Start",
    save: "Save",
    /* 1612:22755 renders this helper in Positive blue. */
    nicknameAvailable: "Nickname available.",
    nicknameTaken: "That nickname is already taken.",
    nicknameTooShort: "Enter at least 2 characters.",
    nicknameCurrent: "That's your current nickname.",
    checkFirst: "Check nickname availability first.",
    /* app-authored accessibility labels (no Figma node). */
    previewA11y: "Profile image preview",
    choosePhotoA11y: "Choose photo, open photo library",
    nicknameA11y: "Nickname",
    checkDuplicateA11y: "Check nickname availability",
    changeNicknameA11y: "Confirm nickname change",
    startBlockedA11y: "Check your nickname to continue",
    saveBlockedA11y: "Nothing to save, or the nickname still needs checking",
    imageUploadedA11y: "Profile image: uploaded photo",
    imageCharacterA11y: "Profile image: {name}",
    imageDefaultA11y: "Profile image: default image",
    // 1795:23994 verbatim.
    exitTitle: "Leave without saving?",
    exitSubtitle: "Your changes won't be saved if you leave",
    // 2231:24627 / 2231:24634 verbatim.
    savedTitle: "Profile Changed",
    savedBody: "Your profile information has been updated",
    saveFailTitle: "Profile Change Failed",
    saveFailBody: "Something went wrong\nPlease try again in a moment",
  },

  /** app-authored accessible names for the three default characters. */
  avatars: {
    AVATAR_01: "Tangerine character with glasses",
    AVATAR_02: "Tangerine character in a green graduation cap",
    AVATAR_03: "Tangerine character with a graduation cap and book",
  },

  /** Subscription management / MOR-010, Figma 784:62109. */
  subscription: {
    title: "Subscription",
    myPlanHeading: "My Plan", // 784:62116
    planLabel: "Plan", // 784:62119
    nextBilling: "Next billing date", // 784:62122
    renewalLabel: "Renewal price",
    renewalYear: "{amount}/yr",
    renewalMonth: "{amount}/mo",
    statusLabel: "Status", // 784:62274
    statusCanceling: "Canceling", // 784:62275
    cancel: "Cancel Plan", // 784:62125
    resume: "Reactivate", // MOR-014 784:62258
    /** MOR-014's grey band — three lines, the first dated. */
    cancelNotice1: "Access until {date}",
    cancelNotice2: "No further charges after this date",
    cancelNotice3: "You can reactivate anytime",
    subscribe: "Subscribe",
    noPlanTitle: "No active plan", // MOR-016 1217:21852
    noPlanSub: "Subscribe to unlock all content", // MOR-016 1217:21852
    voucherLabel: "Enter Subscription Code", // 2181:24986
    billingHeading: "Billing History", // 784:62127
    colDate: "Date", // 784:62131
    colDescription: "Description", // 784:62132
    colAmount: "Amount", // 784:62133
    loadError: "Couldn't load your subscription.",
    billingLoadError: "Couldn't load your billing history.",
    noBilling: "No payment records yet",
    loadMore: "Load more",
    planFallback: "Premium",
    voucherType: "Subscription code applied",
    voucherScheduled: "Your {plan} subscription is scheduled",
    voucherApplied: "Your {plan} subscription is active",
    subPending: "We're confirming your payment. You'll get access as soon as it goes through.",
    cancelScheduled: "Cancellation scheduled",
    resumed: "Your subscription has resumed",
    voucherFailTitle: "Couldn't register that code",
    cancelConfirmTitle: "Cancel your subscription?", // 893:33756
    cancelConfirmText: "Some features will be limited after cancellation.", // 893:33757
    cancelConfirmText2:
      "Auto-renewal stops on your next billing date. You can still use the app until your period ends.", // 893:33758
    /** 893:33759 labels the dismiss button "Keep Plan", not a bare "Cancel". */
    cancelConfirmKeep: "Keep Plan",
    /** 893:33760 reads "Cancle Plan" — a typo in the frame, corrected here. */
    cancelConfirmGo: "Cancel Plan",
    register: "Redeem", // 784:62109 — the English frame says "Redeem"
    invalidCode: "That code is invalid or already used",
    invalidCodeSub: "Check the code and try again",
    invoiceA11y: "{date}, {plan}, covering {from} to {to}, charged {amount}",
  },

  /** app-authored: no design frame exists for payment-method management. */
  paymentRecovery: {
    reasonInsufficientFunds: "Your payment failed due to insufficient funds.", // 1492:21668
    reasonCardExpired: "Your saved card has expired, so the payment failed.",
    reasonDeclined: "Your card issuer declined the payment.",
    reasonMethodRevoked: "Your saved payment method can no longer be used.",
    reasonProviderOutage: "A temporary payment error stopped the automatic charge.",
    reasonGeneric: "The automatic charge to your saved payment method didn't go through.",
    reasonCurrencyMismatch: "Your saved card is charged in a different currency than your plan. Add a card charged in the plan's currency.",
    failCurrencyTitle: "Your card's currency doesn't match the plan",
    failCurrencySub: "Add a card charged in the plan's currency",
    noticeGuidance: "You can retry with a different payment method below.", // 1492:21668
    failInsufficientTitle: "The payment failed due to insufficient funds",
    failInsufficientSub: "Choose another payment method or check your balance",
    failUnusableTitle: "That payment method can't be used",
    failUnusableSub: "Choose another payment method and try again",
    failTemporaryTitle: "A temporary error stopped the payment",
    failTemporarySub: "Please try again shortly",
    failGenericTitle: "We couldn't process your subscription payment", // 1542:23322
    failGenericSub: "Choose another card or try again later", // 1542:23322
    today: "Today at {time}",
    tomorrow: "Tomorrow at {time}",
    /** app-authored: why "Pay now" is unavailable (retry limits). */
    blockedCooldown: "Your card was just tried. You can try it again from {time}, or pay now with a different payment method.",
    blockedDailyLimit: "You've retried this payment several times today. You can try again from {time}.",
    blockedAttemptCap: "This payment has been tried the maximum number of times. Please contact support.",
    blockedInProgress: "Your last payment is still being processed. Check back in a few minutes.",
    blockedNeedsMethod: "This payment method can't be charged. Add or select another payment method below.",
    blockedCancelled: "Your subscription is cancelled. Resume it to pay now.",
    blockedClosed: "This payment can no longer be retried.",
    successPlanLine: "Your {plan} subscription was renewed", // 1542:23312
  },

  /** app-authored: payment-method management has no design frame. */
  /** Payment methods / SET-001, Figma 1332:23012. */
  paymentMethods: {
    title: "Payment Methods",
    loadError: "Couldn't load your payment methods.",
    failNoticeA11y: "Automatic payment failure notice",
    failNoticeTitle: "Payment failed", // 1492:21668
    nextRetry: "Next automatic retry: {date}", // 1492:21668
    payNow: "Pay now",
    paying: "Processing…",
    payNowA11y: "Pay the subscription fee now",
    cardsSection: "Credit/Debit Card", // 1332:23012
    addDomestic: "Add Card(Korean Card)", // 1332:23012
    addInternational: "Add Card(International Card)", // 1332:23012
    addDomesticA11y: "Add a domestic card",
    addInternationalA11y: "Add an international card",
    easyPaySection: "Easy payment", // 1332:23012
    defaultMethodA11y: "{name}, default payment method {state}",
    selected: "selected",
    notSelected: "not selected",
    noticeSection: "Important", // 1332:23012
    notice1: "Charges apply automatically after your first registration.",
    notice2:
      "Payment availability and cancellation policies vary by method. Please check the terms for each payment method.",
    notice3: "Korean Card : Kookmin, BC, Samsung, Lotte, Woori, Hana, Shinhan, Hyundai, Nonghyup, etc.",
    notice4: "International Card : VISA, Master, JCB",
    domesticCardTitle: "Register a domestic card",
    internationalCardTitle: "Register an international card",
    authKeyPlaceholder: "The authKey issued in the payment window",
    registerFailed: "We couldn't register the payment method. Please try again.",
    authValueLabel: "Verification value",
    registerDone: "Finish registration",
    registered: "Registered",
    selectFirst: "Choose the payment method to charge first.",
    checkingResult: "We're confirming the payment. The status will update shortly.",
    alreadyProcessed: "That payment was already processed, so the list has been refreshed.",
    deleteTitle: "Delete this payment method?",
    deleteText: "It can't be restored once deleted",
    paySuccessA11y: "Payment complete",
    payFailA11y: "Payment failed",
    paySuccessTitle: "Payment complete", // 1542:23311
    payFailTitle: "Payment failed", // 1542:23321
    paySuccessSub: "You can keep enjoying all learning content", // 1542:23312
    paySuccessConfirmA11y: "Confirm payment completion",
    payFailConfirmA11y: "Choose another payment method",
    chooseAnother: "Choose another method",
    tossPay: "Toss Pay",
    naverPay: "Naver Pay",
    planFallback: "Premium",
    disconnectA11y: "Disconnect {name}",
    connectA11y: "Connect {name}",
    connect: "Connect",
    deleteA11y: "Delete {name}",
    flowHint: "Finish verification in the payment window and you'll come back here with registration complete. If you don't, paste the value it issued.",
    delete: "Delete",
    retryingStatus: "Processing your payment",
    changingDefaultStatus: "Changing default payment method",
    addDomesticSub: "Issued in Korea · charged in won (KRW)",
    addInternationalSub: "Visa, Mastercard, JCB etc. issued abroad · charged in {currency}",
    regionDomestic: "Korean",
    regionInternational: "International",
    cardTag: "{region} · {currency}",
    currencyLockedA11y: "{name}, can't be the default: its currency differs from your subscription's",
    currencyName: {
      KRW: "Korean won (KRW)",
      USD: "US dollars (USD)",
      JPY: "Japanese yen (JPY)",
    },
    currencyMismatchKrwCard: "This card can only be charged in Korean won (KRW). For a plan billed in {plan}, add an international card.",
    currencyMismatch: "This card can only be charged in {card}. Pay for a plan billed in {plan} with a card charged in {plan}.",
    currencyMismatchGeneric: "This card's billing currency doesn't match the plan's. Please choose another payment method.",
    registerDomesticOnly: "Members with a +82 phone number pay in Korean won (KRW) and can register only a Korean card.",
    registerInternationalOnly: "Members with a phone number outside +82 pay in {currency} and can register only an international card.",
    intl: {
      intro: "Register a card issued outside Korea.",
      currencyLabel: "Billing currency",
      currencyHint: "You'll be charged in this currency. This card can only pay for plans billed in {currency}.",
      currencyRequired: "You're billed in {currency}, so the card can only be registered in {currency}.",
      requiredUnavailable: "You're billed in {currency}, but {currency} international cards can't be registered right now. Please try again later.",
      cardNumberLabel: "Card number",
      cardNumberPlaceholder: "0000 0000 0000 0000",
      brandDetected: "{brand} card",
      brandNotListed: "{brand} cards may not be supported for {currency} billing.",
      expiryLabel: "Expiry date (MM/YY)",
      expiryPlaceholder: "MM/YY",
      birthLabel: "Cardholder's date of birth (YYMMDD)",
      birthPlaceholder: "e.g. 900101",
      security: "We never ask for the CVC or card PIN. Your card details are used only for this registration and aren't saved on this device.",
      verificationCharge: "To verify the card, ₩100 (or the same amount in your currency) is charged when you register it and cancelled right away.",
      consent: "I agree that my subscription fee is charged to this card automatically every billing period until I cancel.",
      consentRequired: "Please agree to automatic payments to register the card.",
      submit: "Register",
      unavailableTitle: "International cards can't be registered right now",
      unavailableText: "Please try again later.",
      optionsError: "Couldn't load the registration details.",
      cleared: "For your security, we cleared the card details. Please enter them again.",
      errors: {
        currencyRequired: "Choose a billing currency.",
        cardNumberRequired: "Enter your card number.",
        cardNumberInvalid: "Check your card number.",
        expiryRequired: "Enter the expiry date.",
        expiryInvalid: "Enter the expiry date as MM/YY.",
        expiryExpired: "This card has expired.",
        birthRequired: "Enter your 6-digit date of birth.",
        birthInvalid: "Enter your date of birth as YYMMDD.",
        invalidCardNumber: "The card number isn't valid. Please check it.",
        invalidExpiry: "The expiry date isn't valid. Please check it.",
        invalidHolder: "The date of birth is invalid or doesn't match the card.",
        cardNotSupported: "This card can't be registered. Please try another card.",
        declined: "Your card was declined. Try another card or contact your bank.",
        unsupportedCurrency: "That currency isn't available right now. Please choose another.",
        currencyMismatch: "Your subscription is billed in {currency}. Please register the card in {currency}.",
        retryFresh: "The registration didn't finish. Check your card details and try again.",
        providerUnavailable: "We couldn't reach the payment provider. Please try again shortly — retrying won't register the card twice.",
        rateLimited: "Too many attempts. Please wait a moment and try again.",
        generic: "We couldn't register the card. Please try again.",
      },
    },
  },

  /** Terms & policies / TRM-001, Figma 784:49774. */
  policy: {
    title: "Terms & Policy",
    termsOfUse: "Terms of Service", // 784:49780
    privacy: "Privacy Policy", // 926:19316
    refund: "Cancellation & Refund Policy", // 784:49781
    businessTitle: "Business Information", // 784:49776
    /** 784:49782 */
    bizCeo: "CEO: Jaehee Lew",
    bizDivision: "Business Division: Woojun Nam",
    bizEmail: "Email: support@talkhangyul.com",
    bizRegNo: "Business Registration No.: 403-87-03380",
    bizMailOrder: "E-Commerce Permit No.: 2026-Seoul Dobong-0542",
    bizCopyright: "Copyright © 2025 HanGyul. All Rights Reserved.",
    effectiveDate: "Effective {date}",
  },

  /** League — LEG-002, Figma 784:57704. That frame is only partially localized,
      so entries without a node id are app-authored. */
  league: {
    tierLabel: "{tier} League", // 1423:22087
    tabRegular: "Pro", // 784:57704
    /* 2304:29786 — the guide hero spells the league out; the tab abbreviates. */
    guideTitle: "Pro League",
    tabFriends: "Friends", // 784:57704
    manageFriends: "Manage", // 798:77164
    history: "History", // 893:24879
    historyA11y: "View league history",
    progressA11y: "League progress",
    tablistA11y: "League",
    currentLeague: "current league",
    locked: "locked",
    timeLeft: "Time left: {time}",
    endingSoon: "Ending soon",
    loadError: "Couldn't load the league.",
    noLeague: "No active league yet", // LEG-000 1681:27531
    noRanking: "No rankings yet",
    openGuide: "Open league guide",
    rankRowA11y: "Rank {rank}, {name}{me}, {points} points",
    meSuffix: " (you)",
    /* guide sheet */
    noDemotion: "(no demotion)",
    noPromotion: "(no promotion)",
    ruleAttendance: "Attendance",
    ruleAttendanceDetail: "+10P for a 7-day streak",
    ruleAttendanceDay: "Once a day, resets at midnight in your device's time zone",
    ruleAttendanceAria:
      "Attendance, 5 points, 10 bonus points for a 7-day streak, once a day, resets at midnight in your device's time zone",
    ruleLearning: "Practice",
    ruleLearningDetail1: "+10P per sentence or question",
    ruleLearningDetail2: "+100P for clearing a level",
    ruleLearningAria: "Practice, 10 points, 10 points per sentence or question, 100 points for clearing a level",
    ruleCourse: "Classes",
    ruleCourseDetail: "+100P for finishing a full class",
    ruleCourseAria: "Classes, 100 points, 100 points for finishing a full class",
    ruleReview: "Review",
    ruleReviewDetail: "+5P for reviewing a saved sentence or question",
    ruleReviewAria: "Review, 5 points, 5 points for reviewing a saved sentence or question",
    /* 2304:29787 — LEG-004's own four lines, which the hand-written copy had
       drifted from (its third line also overflowed to a fifth row at 230px). */
    intro1: "Compete with learners globally",
    intro2: "to build your Korean skills",
    intro3: "Study more to raise your score",
    intro4: "and rank \u2014 grow even faster.",
    scheduleRange: "Every Monday 00:00 — Sunday 21:00",
    scheduleAnnounce: "(results announced Sunday at 21:00)",
    scheduleTimezone: "* League times are US Eastern Time (ET)",
    promotionHeadline: "Only the top 20% move up a league",
    promotionAria:
      "Only the top 20% move up a league; Green League has no demotion, Golden League has no promotion",
    emptyLine1: "Start learning", // LEG-000 1681:27530
    emptyLine2: "and join the league!",
    // Matches guideTitle above — the sheet's accessible name has to be the
    // name on the sheet, and the EN catalogue calls it "Pro League".
    guideA11y: "Pro League guide",
    guideCloseA11y: "Close Pro League guide",
    pointsTitle: "The more you learn, the more league points (P) you earn",
    defaultNickname: "Member",
    countdown: "{d}d {h}h {m}m",
    myPoints: "My Point", // 784:57704
  },

  /** Sign-up. app-authored: no sign-up form frame exists in the design file. */
  signup: {
    title: "Sign up",
    subtitle: "Please fill in your details.", // 784:55065
    nameLabel: "Name",
    namePlaceholder: "Enter your name",
    emailPlaceholder: "Enter your email",
    passwordLabel: "Password",
    passwordPlaceholder: "8+ chars: letters, numbers & symbols",
    confirmLabel: "Confirm password",
    confirmPlaceholder: "Re-enter password",
    phoneCodeLabel: "Phone verification code",
    emailCodeLabel: "Email verification code",
    phoneCodeA11y: "Check phone verification code",
    emailCodeA11y: "Check email verification code",
    phoneRequestA11y: "Request phone verification code",
    emailRequestA11y: "Request email verification code",
    termsTitle: "Terms & conditions", // 784:55065
    agreeAll: "Agree to all",
    agreeAge: "[Required] 14+ (or guardian consent)",
    /** Named after the document it opens (TRM-002), not the frame's wording. */
    agreeTerms: "Terms of Service (required)",
    agreePrivacy: "Privacy policy (required)",
    agreeThird: "3rd-party data sharing (required)",
    /* Optional consents — the English frame lists all three. */
    agreeMarketing: "Email & SMS marketing (optional)",
    agreeServiceNotice: "Service notifications (optional)",
    agreeAdNotice: "Promotional alerts (optional)",
    submit: "Sign up",
    errName: "Enter your name.",
    errPhoneVerify: "Verify your phone number.",
    errEmailVerify: "Verify your email address.",
    errConfirm: "The passwords don't match.",
    errAgree: "Agree to all required terms.",
    errForm: "Please check your details again.",
    viewDetailA11y: "View {name} in detail",
  },

  lineConsent: {
    title: "Email use for LINE sign-in",
    description:
      "With your consent, we receive your LINE account’s email address to create or link your Hangyul account and send account-related notifications.",
    privacyPolicy: "Privacy Policy",
    agree: "Agree and continue with LINE",
    closeA11y: "Close",
  },

  socialTerms: {
    title: "Please agree to the terms\nto use Hangyul",
    next: "Next",
    closeA11y: "Stop signing up",
  },

  phoneSetup: {
    title: "Verify your phone number",
    intro: "Verify your phone number to start using Hangyul.",
    submit: "Next",
    saved: "Phone number saved",
    blockedA11y: "Finish verification to continue",
    quitA11y: "Stop signing up",
  },

  /** Find Email — no match. app-authored (no design frame located). */
  findEmailNoMatch: {
    titleLine1: "No matching",
    titleLine2: "account found",
    descLine1: "We couldn't find an account matching those details",
    descLine2: "Please check your information again",
    prompt: "New here?",
    signupLink: "Sign up",
    retry: "Try again",
    retryA11y: "Try again, return to the find-email screen",
  },

  /** Social-login callback. app-authored (no design frame). */
  authComplete: {
    loading: "Logging in…",
    cancelled: "Login was cancelled.",
    invalidState: "Your login session expired. Please try again.",
    notConfigured: "Login with this provider isn't set up yet.",
    providerUnavailable: "We can't reach the login service right now. Please try again in a moment.",
    emailRegistered: "An account with this email already exists. Please log in the way you originally signed up.",
    accountInactive: "This account has been deleted or suspended.",
    loginFailed: "Couldn't complete login. Please try again.",
  },

  /** Withdrawal password step. app-authored (no design frame located). */
  withdrawPassword: {
    title: "Enter Password", // 3085:29130
    /** 3085:29131 sets this as ONE line, unlike the Korean. */
    guide: "Enter your password to confirm deletion.",
    placeholder: "Enter your password", // I3085:29132;3021:65660
    a11y: "Current password",
    empty: "Enter your password.",
  },

  /**
   * Withdrawal step for an account created by social login (no password):
   * confirm by signing in with the linked provider again. app-authored.
   */
  withdrawReauth: {
    title: "Confirm It's You",
    guide: "You signed up with a social account.\nSign in with it again to confirm deletion.",
    unavailable: "This account's sign-in method can't be confirmed on the web.\nPlease delete your account in the app.",
    deleting: "Deleting your account",
    mismatch: "That social account isn't linked to this account. Sign in with the one you signed up with.",
    expired: "Your confirmation expired. Please sign in again.",
    cancelled: "Sign-in was cancelled, so your account was not deleted.",
    providerUnavailable: "We can't reach the sign-in service right now. Please try again in a moment.",
    failed: "We couldn't confirm it's you. Please try again.",
  },

  /** First-run language chooser — AME-001 (EN 784:53343). */
  languagePicker: {
    /** The English frame sets this as two lines. */
    title: "Choose your language\nto start learning Korean",
    start: "Let\u2019s start!",
  },

  /** Cancellation-reason step — MOR-012 / MOR-013 (EN 893:33828 / 893:33920). */
  cancelReason: {
    title: "Why are you canceling?",
    subtitle: "Your feedback helps us improve (optional)",
    price: "It's too expensive",
    usage: "I don't use it enough",
    features: "Missing features I expected",
    competitor: "I'm using another service",
    other: "Other (write your own)",
    placeholder: "Tell us more...",
    skip: "Skip",
    submit: "Submit",
  },

  /** Subscription-code modal. app-authored (no design frame located). */
  voucher: {
    title: "Enter Subscription Code",
    closeA11y: "Close the subscription-code dialog",
    codeA11y: "Subscription code",
    empty: "Enter a code.",
    note1: "Applied to your subscription as soon as the code is verified",
    note2: "Queued to start after your current subscription ends",
    submit: "Register",
  },

  /** Subscription purchase / SET-030–032. app-authored. */
  purchase: {
    planYear: "12 months",
    planMonth: "1 month",
    selectedSuffix: ", selected",
    perMonth: "/mo",
    /** `<s>` marks the cream-highlighted run in the CTA. */
    // 784:50762 splits this as white "Start " + #FCEEC1 "7-day free trial";
    // the marker was around "Start 7-day", which inverted the two colours.
    startTrial: "Start <s>7-day free trial</s>", // 784:50692
    startNow: "Start now",
    close: "Close",
    productsTitle: "Plans",
    cancelAnytime: "Cancel anytime.", // 784:50692
    // One paragraph, wrapped by its 324px box (1421:21525) — unlike ko, no break.
    trialNote:
      "7-day free trial ends with automatic billing for your selected plan. Annual subscriptions are non-refundable after 30 days from the billing date.",
    // SET-032 EN (1421:21533): the refund sentence only.
    paidNote: "Annual subscriptions are non-refundable after 30 days from the billing date.",
    loading: "Loading…",
    loadError: "Couldn't load this information.",
    eyebrow: "Try it free for a week",
    heroLine1: "Start now,",
    heroLine2: "and unlock everything.",
    heroDesc: "Your Korean will change with Hangyul.",
    noProducts: "No plans are available right now. Please check back shortly.",
    refundPolicy: "[View Refund Policy]",
    // 2525:26578 — the title states the condition; the body carries the action.
    needMethodTitle: "Payment method required",
    needMethodLine1: "Please add a payment method before",
    needMethodLine2: "starting your free trial or subscription",
    planYearA11y: "12-month plan{selected}. About {monthly} per month, billed {total} yearly.",
    planMonthA11y: "1-month plan{selected}. {monthly} per month.",
    registerMethod: "Add Method", // 2525:26578
    currencyTitle: "This payment method can't pay for this plan",
    currencySwitchDefault: "Make your {currency} payment method the default to continue.",
    currencyAddIntl: "Add international card",
    currencyManage: "Manage methods",
    discountedPrice: "<s>up to {pct}% off</s>", // 898:19697
    discountPct: "{pct}% off",
    perMonthPriceWithTotal: "{price}/mo ({total})",
    priceChanged: "The price changed. Please review the new price and try again.",
  },

  /** Saved sentences / TAL-038, Figma 798:76840. */
  saved: {
    sortRecent: "Latest", // 798:76840
    sortMostWrong: "Most missed",
    sortLeastRecent: "Least reviewed", // 784:60593
    filterAll: "All",
    filterReading: "Reading",
    filterListening: "Listening",
    filterWriting: "Writing",
    savedSentences: "Saved Sentences", // 798:76840
    savedQuestions: "Saved Questions",
    audioError: "Couldn't play the audio.",
    /* 3161:34414 / 3253:36942 — one string per mode, both tabs. */
    emptySentences: "No saved sentences yet",
    emptyQuestions: "No saved questions yet",
    sourceLabel: "Source",
    wrongSentences: "Mistakes", // 798:76840
    likedSentences: "Favorites", // 798:76840
    wrongQuestions: "Mistakes",
    likedQuestions: "Favorites",
    search: "Search",
    topikSection: "TOPIK section",
    noResults: "No results",
    removeFromWrong: "Remove from missed",
    unbookmark: "Remove bookmark",
    reviewSentenceA11y: "Review the sentence {sentence}",
    reviewQuestionA11y: "Review question {title}",
    playSentenceA11y: "Play {sentence}",
    stopSentenceA11y: "Stop playing {sentence}",
    // 784:60833 renders this as "[TOPIK Lv.1 · Grammer]" (the frame's own
    // misspelling of "Grammar" is not reproduced).
    quizTitle: "[TOPIK Lv.{level}{skill}]",
    loadError: "Couldn't load these.",
    loadMore: "Load more",
  },

  /** Notifications / NOT-001. app-authored. */
  /** Notification centre / PUS-001, Figma 784:63494. */
  notifications: {
    title: "Notifications",
    all: "All",
    learning: "Study", // 784:63494
    notice: "Notice", // 784:63494
    social: "Social",
    emptyFiltered: "No notifications here",
    emptyAll: "No new notifications yet", // 1678:25881
    categoriesA11y: "Notification categories",
    filterA11y: "View {name} notifications",
    newPrefix: "New notification. ",
    read: "read",
    unread: "unread",
    loadError: "Couldn't load your notifications.",
    loadMore: "Load more",
    cardA11y: "{newFlag}{group} notification, {readState}. {title}. {body} {time}",
    today: "Today",
    yesterday: "Yesterday",
    justNow: "Just now",
    minutesAgo: "{n}m ago",
    hoursAgo: "{n}h ago",
    monthDay: "{m}/{d}",
    yearMonthDay: "{y}/{m}/{d}",
  },

  /** Offline state — Figma SYS-001 (1567:25152). */
  offline: {
    title: "Check your internet connection",
    line1: "You're not connected to the internet",
    line2: "Turn on Wi-Fi or mobile data",
    retry: "Try again",
    unreachableTitle: "Couldn't connect",
    unreachableLine1: "We couldn't reach the server",
    unreachableLine2: "Please try again in a moment",
  },

  /** Onboarding questionnaire. app-authored. */
  onboarding: {
    progressA11y: "Onboarding progress",
    next: "Next",
    startNow: "Start now",
    goStart: "Let's go!", // 784:53665
    recommendedPill: "Best", // 1803:24240 — "Best Basic" / "Best Routine"
    introTitle: "Welcome!",
    introLine1: "We have a few quick questions to better",
    introLine2: "understand your learning goals.",
    introLine3: "No pressure - your answers will help us",
    introLine4: "build the perfect learning plan for you!",
    introArtA11y: "Illustration of the Hangyul characters welcoming you",
    purposeA11y: "Choose your learning goal",
    purposeLine1: "Why do you want to", // 784:54432
    purposeLine2: "learn Korean?",
    purposeConv: "Speaking",
    purposeConvSub: "(Conversation)",
    purposeConvA11y: "Speaking, conversation focused",
    purposeTopik: "TOPIK",
    purposeTopikSub: "(Exam prep)",
    purposeTopikA11y: "TOPIK, exam preparation",
    speakingQ: "What's your Korean speaking level?", // 784:53576
    speakingA11y: "Korean speaking level",
    speakingNone: "Complete beginner",
    speakingWords: "Words only",
    speakingSimple: "Simple sentences",
    speakingDaily: "Everyday conversation",
    speakingFluent: "Fluent",
    topikQ: "Choose your target TOPIK level", // 1803:24240
    topikA11y: "Target TOPIK level",
    topikBasic: "Basic",
    topikBeginner: "Easy",
    topikIntermediate: "Medium",
    topikUpperIntermediate: "Hard",
    topikAdvanced: "Pro",
    topikMastery: "Expert",
    goalLast: "Last question!", // 784:53665
    goalA11y: "Daily study goal",
    goalBasic: "Basic",
    goalRoutine: "Best Routine",
    goalRoutineRec: "Best",
    goalRoutineBase: "Routine",
    goalFocus: "Focus",
    goalImmersion: "Immersion",
    goalConquer: "Conqueror",
    sentenceCount: "{n}",
    goalOptionA11y: "{n} per day, {mode}",
    gradeLabel: "Lv.{n}",
    gradeOptionA11y: "Level {n}, {badge}",
    sentenceHeading: "How many sentences a day?",
    questionHeading: "How many questions per day?", // 1803:24464
    /* The free-plan notice above the options (784:53665 / 1803:24464). The
       English TOPIK frame reuses the sentence wording; the Korean frames say
       문장 / 문제, so the question branch follows the Korean split. */
    goalNoticeSentences: "Free plan caps at 5 sentences a day — your goal applies automatically once you upgrade to Premium.",
    goalNoticeQuestions: "Free plan caps at 5 questions a day — your goal applies automatically once you upgrade to Premium.",
  },

  /** Conversation session — incorrect/retry/pronunciation states. */
  sessionConversation: {
    incorrectStatus: "Give it another try",
    hint: "Hint",
    answer: "Answer",
    voiceMode: "Voice mode",
    keyboardMode: "Keyboard Mode", // 798:76717
    pronunciationTitle: "Pronunciation accuracy",
    pronunciationFallback: "Try saying it a little more clearly.",
    scoreA11y: "Pronunciation accuracy: {percent} percent",
    evaluationError: "We couldn't score that. Please try again shortly.",
    micPermission: "Microphone access is needed. Please check your browser settings.",
    bookmarkSave: "Save",
    bookmarkUnsave: "Remove from saved",
    recordA11y: "Speak the sentence",
    stopRecordA11y: "Stop recording",
    micRetryA11y: "Record again",
    levelTitle: "Conversation Lv.{level}",
  },

  /** TOPIK session. */
  topikSession: {
    title: "Try this question", // 1718:32055
    submit: "Submit",
    next: "Next",
    complete: "Done",
    resultCorrectTitle: "Correct!",
    resultRetryTitle: "Try again",
    audioTrack: "Track 1",
    answerPlaceholder: "Type your answer",
    blankPlaceholder: "Type your answer",
    charCount: "{current}/{max}",
    minLengthHint: "Please write at least {min} characters.",
    overMaxHint: "Please keep it within {max} characters.",
    correct: "Correct! 🎉",
    incorrect: "Not quite 💪",
    correctAnswerLabel: "Answer: {answer}",
    scoreLabel: "{score} / {max}",
    suggestionsTitle: "Suggestions",
    grammarTitle: "Grammar feedback",
    correctedTitle: "Corrected version",
    awaitingReview: "Submitted — waiting to be graded ✍️",
    unsupported: "This question type isn't supported yet. Please move on to another question.",
    saveQuestion: "Save question",
    removeSaved: "Remove saved question",
    audioPlay: "Play audio",
    audioPause: "Pause audio",
    audioLoading: "Loading",
    audioError: "Couldn't play the audio.",
    scoreA11y: "Score {percent}",
  },

  /** Saved-item review session. */
  reviewSession: {
    sentenceTitle: "Saved sentence",
    questionTitle: "Saved question",
    /* 784:60714 / 893:23120 — every English twin of these two-tile sheets labels
       the left tile "Retry". */
    restart: "Retry",
    complete: "Done",
    rewardTitle: "Review complete!",
    /* 1976:29395 — TAL-047 EN carries the 🔥 that the Korean frame (794:76274)
       does not; the CTA reads OK, not Confirm (1976:29386). */
    rewardSubtitle: "Mastered it, points too! 🔥",
    confirm: "OK",
    closeA11y: "Close review complete dialog",
    rewardA11y: "Review complete. You earned {points} points.",
    reviewSentenceA11y: "Review this sentence",
    reviewQuestionA11y: "Review this question",
    startError: "Couldn't start the review. Please try again shortly.",
    loadError: "Couldn't load the review content.",
  },

  /** Notices list / detail. */
  notice: {
    title: "Notices", // I784:49753;3021:65311
    empty: "There are no notices yet", // 2431:26084 — no trailing period
    errorTitle: "Couldn't load notices",
    notFoundTitle: "Notice not found",
    notFoundBody: "It may have been removed or the address is incorrect.",
    backToList: "Back to notices",
    newBadgeLabel: "New notice",
  },

  /** Daily attendance completion modal. */
  attendance: {
    // Verbatim from MAI-003 EN (1942:28711). The EN design is not a literal
    // translation of the KO frame — it reads "Checked in today!" where KO reads
    // 오늘 출석 완료!. No trailing emoji: the frame has none, so the streak
    // line ends on the exclamation mark.
    title: "Checked in today!",
    streak: "{days}-day streak going!",
    points: "+{points}P",
    // I1942:28702;3021:65365 — EN says OK where KO says 확인, so this modal keeps
    // its own key rather than borrowing common.confirm ("Confirm"), which a
    // dozen other modals share.
    confirm: "OK",
    closeA11y: "Close attendance completion modal",
    confirmA11y: "Confirm attendance completion",
    dialogA11y: "Checked in today",
  },

  /** Add-friend sheet + incoming friend-request sheet. */
  addFriend: {
    title: "Add Friend",
    close: "Close add friend",
    infoAcceptance: "When they accept, you become friends",
    infoVisibility: "You'll see each other's league and profile",
    /* The field LABEL; the placeholder is a separate node. */
    searchLabel: "Search by phone number",
    searchAria: "Find a friend by phone number",
    search: "Search",
    suggested: "Suggested",
    suggestedSub: "*Based on your contacts",
    noRecommendations: "No suggestions available",
    invite: "Send friend request link",
    inviteAria: "Share friend invitation link",
    sendRequest: "Friend Request",
    cancelRequest: "Cancel Request",
    accept: "Accept",
    friendsLabel: "Friends",
    notFoundTitle: "No user is registered with that phone number",
    notFoundSub: "Check the number or send an invitation link.",
    requestSent: "Friend request sent",
    requestCancelled: "Request cancelled",
    linkCopied: "Link copied. Send it to your friend!",
    linkCopyFailed: "Couldn't copy the link. Please try again.",
    ctaFriends: "{name}, already friends",
    ctaRequestSent: "{name}, request can be cancelled",
    ctaRequestReceived: "{name}, can accept",
    ctaCanRequest: "{name}, can send request",
  },

  /** Incoming friend-request sheet. */
  incomingRequest: {
    title: "Friend Request",
    close: "Close friend request",
    infoRequested: "{name} sent you a friend request",
    // LEG-020 (893:32612) wording.
    infoVisibility: "Accept to see each other's league and profile",
    reject: "Decline",
    accept: "Accept",
    loadError: "Couldn't load the request.",
    accepted: "You're now friends with {name}!",
    rejected: "Request rejected",
  },

  /** Friend management / LEG social screens. */
  friends: {
    title: "Manage Friends",
    add: "Add Friend",
    // LEG-013 (1815:24855) labels the header button just "Add".
    addShort: "Add",
    tabFriends: "Friends",
    tabReceived: "Received",
    tabSent: "Sent",
    remove: "Remove", // I1815:24733;1:5549
    reject: "Decline", // I1816:24135;1:5549 — the frame says Decline, not Reject
    accept: "Accept", // I1816:24134;1:5549
    openRequest: "open request",
    friendsEmptyTitle: "No friends yet", // 1653:23116
    /** 1653:23115 breaks after "and". */
    friendsEmptyDesc1: "Send a friend request and",
    friendsEmptyDesc2: "study together!",
    receivedEmptyTitle: "No friend requests received",
    /* 2318:30412 breaks it after "will". */
    receivedEmptyDesc1: "Requests from friends will",
    receivedEmptyDesc2: "show up here",
    sentEmptyTitle: "No friend requests sent",
    sentEmptyDesc1: "Send a request to a friend",
    sentEmptyDesc2: "you'd like to study with",
    listError: "Couldn't load the list.",
    // LEG-013 (1815:24869) wording.
    modalTitle: "Remove {name} as a friend?",
    modalDesc: "No notification will be sent",
    /* Sent-request cancel confirmation — cp_G_01_modals 1827:24601. */
    cancelModalTitle: "Cancel your request to {name}?",
    cancelModalDesc: "Your request to them will be removed",
    cancelModalBack: "Back",
    cancelModalConfirm: "Cancel Request",
    toastAccepted: "You're now friends with {name}!",
    toastRejected: "Request rejected",
    toastCancelled: "Request cancelled",
    toastRemoved: "Friend removed",
    /** 1816:24155 / 1816:24265 — "Requested 5h ago", "Requested 30m ago". */
    requestAge: "Requested {age}",
    addFriendCta: "+ Add Friend",
  },

  /** Relative time shared by friend requests and other lists. */
  time: {
    justNow: "just now",
    minutesAgo: "{n}m ago",
    hoursAgo: "{n}h ago",
    daysAgo: "{n}d ago",
  },

  /** My Points (league point ledger) — LEG-022, Figma 1526:22979.
      That frame is Korean-only; there is no English LEG-022, so the English
      here is app-authored to match its wording rather than copied from a node
      — the same arrangement the League block above describes. */
  points: {
    // 1526:23023 reads 리그 포인트, dropping the "이번 / this" the app had.
    currentLeague: "League Points",
    emptyTitle: "No points earned in this league yet",
    emptyDesc: "Start learning to earn points in this league.",
    error: "Couldn't load your points.",
    loadMore: "Load more",
    listAria: "Point history",
    reasonAttendance: "Attendance",
    reasonSentence: "Customized Learning",
    reasonLecture: "Course",
    reasonReview: "Review",
    reasonLevelUp: "Level Up",
    descAttendance: "Daily attendance",
    descStreakBonusDays: "{days}-day attendance streak bonus",
    descStreakBonus: "Attendance streak bonus",
    descQuestionDone: "Question completed",
    descSentenceDone: "Sentence completed",
    descLectureDone: "Course completed",
    descQuestionReview: "Question review completed",
    descSentenceReview: "Sentence review completed",
    descLevelReached: "Reached level {level}",
    descLevelUpBonus: "Level-up bonus",
    rowA11y: "{title}, {desc}, {direction}{amount} points, {date}",
    directionEarned: "plus ",
    directionDeducted: "minus ",
  },

  /** League history. */
  leagueHistory: {
    title: "League History",
    ongoing: "In Progress",
    emptyTitle: "No league history for this season",
    emptyDesc: "Your league records will appear here once you participate.",
    seasonError: "Couldn't load seasons.",
    listError: "Couldn't load league history.",
    loadMore: "Load more",
    listAria: "League history",
    seasonPickerAria: "Seasons",
    heroName: "{quarter} League",
    optionLabel: "{year} {quarter} Season",
    selectAria: "{label} selected, change season",
    rangeA11y: "{from} to {to}",
    rankA11y: ", {current}rank {rank}",
    currentPrefix: "current ",
    pointsA11y: ", {points} points",
    quarterSpring: "Spring",
    quarterSummer: "Summer",
    quarterFall: "Fall",
    quarterWinter: "Winter",
    spokenDate: "{m}/{d}",
  },

  /** Friend League empty state. */
  friendLeague: {
    /* LEG-011 (1658:23877) — English strings supplied against that frame. */
    emptyTitle: "No friends in your league yet",
    emptyLine1: "Add friends and",
    emptyLine2: "compete together!",
    rankingAria: "Friend League ranking",
    podiumA11y: "Rank {rank}, {name}, {points} points",
    rowA11y: "Rank {rank}, {name}{league}, {points} points{me}",
    leagueSuffix: ", {league}",
    meSuffix: ", you",
    addFriend: "Add",
  },

  /** Shared UI primitives (states, fields, selects) and network errors. */
  ui: {
    loading: "Loading…",
    emptyTitle: "Nothing here yet",
    errorTitle: "Something went wrong",
    errorBody: "An error occurred.",
    countrySelect: "Select country",
    countrySelectA11y: "Select country, currently {name}",
    /* Country names come from Intl.DisplayNames in the app language — the
       picker lists every country and territory (lib/phone.ts). */
    countrySearch: "Search country or code",
    countryNoMatch: "No matching country",
  },

  /** Phone-number field validation, shared by every phone-entry screen. */
  phoneInput: {
    empty: "Enter your phone number.",
    tooShort: "This number is too short for {country} ({dial}).",
    tooLong: "This number is too long for {country} ({dial}).",
    invalid: "This isn't a valid {country} ({dial}) mobile number. Check the country and the number.",
  },

  /** Network / API error messages surfaced by the http layer. */
  httpError: {
    forbidden: "You don't have permission for that.",
    network: "Can't reach the network. Please check your internet connection.",
    unknown: "Something went wrong.",
    badRequest: "We couldn't process that request.",
    notFound: "We couldn't find what you asked for.",
    server: "A temporary server error. Please try again shortly.",
    /** 422 phone_number_undeliverable: retrying the same number won't help. */
    phoneUndeliverable: "We can't send a verification text to this number. Check it or enter a different one.",
  },

  /** A recording that could not be graded; nothing was counted, so the learner just records again. */
  speechError: {
    noSpeech: "We couldn't hear you. Move closer to the microphone and speak a little louder.",
    unsupportedAudio: "We couldn't read that recording. Please record again.",
    tooLong: "That recording is too long. Please answer within 15 seconds.",
  },

  /** Password rules shown under the field. */
  validation: {
    passwordLength: "Use between 8 and 64 characters.",
    passwordComposition: "Include letters, numbers and symbols.",
    passwordMismatch: "The passwords don't match.",
  },

  /** FAQ / FAQ-001, Figma 847:22155. */
  faq: {
    catBilling: "Billing · Plans", // 847:22155
    catAccount: "Account & Settings", // 847:22155
    catError: "Troubleshooting", // 847:22155
    catHowTo: "Getting Started", // 847:22155
    catPartnership: "Partnership · Suggestions",
    searchAria: "Search FAQ",
    /** FAQ-(empty) 3393:27297. */
    noQuestions: "There are no questions here yet",
    askAnything: "Ask us anything",
    searchResults: "Results", // 847:22288 — "🔎 Results {n}", not "Search results"
    notFoundTitle: "We couldn't find that question",
    notFoundBody: "It may have been removed or the address is incorrect.",
    chatSupport: "Live Chat", // 847:22155
    chatSupportError: "Couldn't open support chat. Please try again shortly.",
  },

  /** Small shared components. */
  misc: {
    brandLogoA11y: "Hangyul",
    aiName: "Hangyul AI",
    askAnything: "Ask me anything!",
    explanationError: "Couldn't load the explanation.",
    tossPay: "Toss Pay",
    naverPay: "Naver Pay",
    sunNotStudied: "You haven't studied today yet",
    sunStudied: "You've started studying today",
    sunLoading: "Loading your study status",
    sectionStreak: "Streak",
    sectionManagement: "Study log",
    sectionAria: "Study section",
    sectionChangeA11y: "Change study section",
    logoutTitle: "Log out?",
    logoutBody: "Your study history is safely saved.", // 893:33426
    logout: "Log Out", // 893:33426
    unsavedTitle: "Leave without saving your changes?",
    unsavedBody: "Your changes will not be applied",
    unsavedContinue: "Keep editing",
    unsavedLeave: "Leave",
  },

  /** Personalized learning hub. */
  personalized: {
    title: "Practice",
    /* MAI-002 1825:28721 — the English card reads "Real Conversation". */
    conversationTrack: "Real Conversation",
    topikTrack: "TOPIK",
    settings: "Practice settings",
    review: "Review",
    goalAchieved: "Today's goal 100% complete! Amazing! ✨", // I1825:28968;8597:58503
    keepGoing: "You got this!",
    startNow: "Start Now",
    continueLearning: "Continue learning",
    retryWrong: "Retry missed items",
    reviewFavorites: "Review bookmarks",
    dailyGoal: "Daily Target",
    learningModes: "Learning modes",
    streakCalendarA11y: "{days}-day streak, open calendar",
    chatbotA11y: "Chat freely with the AI chatbot",
    /* TAL-002 / TAL-003 print the TOPIK card's level as "Lv.1" / "Lv.2" in
       English, not "Level n" (Korean keeps 급 — see ko.ts). */
    grade: "Lv.{n}",
  },

  /** Practice settings / TAL-034, Figma 1825:31630 (the EN frame is the LOWER
      node id on this screen — 1825:32476 is the Korean one). */
  personalizedSettings: {
    title: "Practice Settings", // 1825:31630 topNav + page heading
    hint: "The top course shows first on your home",
    dragHint: "Drag {handle} to reorder",
    empty: "You have no active practice tracks.",
    loadError: "Couldn't load your settings.",
    listAria: "Practice tracks",
    conversationTrack: "Real Conversation",
    reorderError: "Couldn't save the order. Please try again.",
    summaryLevelTopik: "Lv.{level}",
    summaryLevelConversation: "Lv.{level}",
    summaryGoal: "Daily Target {goal}",
    /* TAL-034 lists both tracks as "Lv.2" / "Lv.1" in English. */
    levelTopik: "Lv.{n}",
    levelConversation: "Lv.{n}",
    reorderA11y: "Reorder {name}, use up and down arrow keys",
    itemA11y: "{name}, {level}, daily goal {goal}, item {pos} of {total}",
    movedA11y: "{name} moved to position {pos}",
    openDetailA11y: "{summary}, open detailed settings",
  },

  /** Track settings (level + daily goal). */
  trackSettings: {
    // 1825:31973 / 1825:32043 — Figma's EN step labels, verbatim.
    levelSection: "Choose Level",
    goalSection: "Daily Target",
    save: "Save",
    // Post-save modal — Figma cp_G_01_modals (2678:26321), verbatim.
    savedModalTitle: "Practice Settings Saved",
    savedModalDesc: "Your level and daily goal have been updated",
    savedModalConfirm: "OK",
    // Goal-limit notice — Figma cp_G_03_toast (784:63104). Figma's copy says
    // "sentences"; the TOPIK screen counts questions.
    goalLimitConversation: "Daily goal can be set up to {n} sentences\nGo Premium for unlimited ✨",
    goalLimitTopik: "Daily goal can be set up to {n} questions\nGo Premium for unlimited ✨",
    loadError: "Couldn't load your settings.",
    conversationTrack: "Real Conversation",
    topikTitle: "TOPIK",
    selectedSuffix: ", selected",
    /* TAL-037's English chips read Lv.1..Lv.6, matching the conversation track's
       below — Korean is the one that keeps 급. */
    gradeLabel: "Lv.{n}",
    levelLabelConversation: "Lv.{n}",
    topikLevelA11y: "TOPIK level {n}",
    conversationLevelA11y: "Conversation level {n}",
    goalA11y: "Daily goal {n}, {mode}",
  },

  /** Learning management (study records). */
  learningManagement: {
    title: "My study history",
    todayTime: "Today's study time",
    /* Today's summary shows conversation and TOPIK separately — never a sum. */
    todaySentences: "Sentences today",
    todayQuestions: "Questions today",
    sentences: "Sentences learned",
    questions: "Questions learned",
    countUnit: "{n}",
    periodHeading: "Study time by period",
    /* Weekly x-axis label. HMA-002 only draws the 7-day axis, so unlike the
       weekday/month labels (which Intl derives to match the frame exactly)
       this wording is authored — it is not sourced from a Figma text node. */
    weekLabel: "Week {n}",
    period: "Period",
    periodAria: "Select period",
    thisMonth: "This month",
    last7: "Last 7 Days",
    last3m: "Last 3 months",
    last1y: "Last year",
    emptyTitle: "No study records yet",
    emptyLine1: "Start your first lesson and",
    emptyLine2: "build your learning record!",
    startLearning: "Start Learning",
    startLearningA11y: "Start learning, go to Practice",
    waiting: "Waiting for your first lesson!",
    praise: "Your progress keeps building, amazing!",
    loading: "Loading",
    loadError: "Couldn't load your study records.",
  },

  /** Streak calendar. */
  streak: {
    litTitle: "Your streak is shining!",
    unlitTitle: "Your streak has stopped",
    unlitDesc: "Study to make the sun shine again!",
    done: "Done",
    loadError: "Couldn't load your study records.",
    streakDays: "{days} days strong!",
    prevMonth: "Previous month",
    nextMonth: "Next month",
    monthAria: "Study calendar for {m}/{y}",
    monthLabel: "{m}/{y}",
    dayA11y: "{m}/{d}/{y}",
    dayDoneA11y: "{m}/{d}/{y}, studied",
    sun: "S",
    mon: "M",
    tue: "T",
    wed: "W",
    thu: "T",
    fri: "F",
    sat: "S",
  },

  /** Session chrome + completion / part-selection modals. */
  session: {
    backA11y: "Back",
    progressA11y: "Session progress",
    askAiA11y: "Ask Hangyul AI about this question",
    askAiHint: "I'll explain the tricky parts!",
    expandInput: "Expand the custom input",
    collapseInput: "Collapse the custom input",
    scoreA11y: "{correct} correct out of {total} in this set",
    completeTitle: "Session complete!",
    completeA11y: "Session complete",
    completeCloseA11y: "Close session complete dialog",
    completeSummaryA11y:
      "Session complete. You studied {count} {unit} and earned {points} points this session.",
    unitSentence: "sentences",
    unitQuestion: "questions",
    /* The level-up card labels its own stat rather than reusing the generic
       "{unit} studied" phrasing (Figma 798:88969). */
    additionalTitle: "Want to keep going a little longer?",
    additionalStart: "Let's go!",
    additionalPrompt: "How many more {unit}?",
    countUnit: "{n}",
    completeCount: "You studied {count} {unit} 👏",
    additionalCloseA11y: "Close",
    additionalA11y: "Start with {count} more {unit}",
    partTitle: "Which part shall we study today?",
    partSubtitle: "Choose a part to study",
    partReading: "Reading",
    partListening: "Listening",
    partWriting: "Writing",
    partA11y: "Start studying the {label} part",
    answerNext: "Correct, continue",
    nextQuestion: "Next question",
    solveAgain: "Retry",
    retry: "Retry",
    complete: "Done",
    learningComplete: "Session complete",
    next: "Next",
    questionLabel: "Question",
    answerLabel: "Answer",
    answerWrite: "Write your answer",
    answerPlaceholder: "Type your answer",
    answerFree: "Write freely",
    blankAnswerA11y: "Answer for {label}",
    blank: "Blank",
    blankWord: "Word for the blank",
    blankHint: "Hint: {hint}",
    fillBlank: "Fill in the blank✨", // 798:76717
    correctExclaim: "Correct!",
    correctA11y: "Correct. {korean}. {translation}",
    alreadyDone: "You already completed this one",
    sentenceLoadError: "Couldn't load the sentences.",
    questionLoadError: "Couldn't load the questions.",
    dailySentenceGoal: "Daily Target", // 798:76717
    dailyQuestionGoal: "Daily Target", // 1718:32055
    customPlaceholder: "✨ Type your situation, we'll match sentences", // 798:76717
    customInputA11y: "Describe a situation for custom sentences",
    customSubmitA11y: "Get custom sentence suggestions",
    premiumTag: "★ Premium only", // 798:89229
    premiumOnlyNotice: "This feature is available to premium members only.",
    topikTypeAria: "TOPIK question types",
    topikTypeLabel: "[Type {n}] {title}",
    /* Deliberately NOT the frame's wording. TAL-015 (1718:32055) draws
       "✨ Type a topic you want to focus on" in a text node literally named
       "↪ ✏️ Placeholder", and there "Type" reads as the verb — but the control
       selects a question *type*, it takes no input. This matches the Korean,
       which already says 문제 유형을 선택해보세요 ("choose a question type"). */
    topikTypePrompt: "✨ Choose a question type to focus on",
    topikGrade: "TOPIK Lv.{n}", // 1718:32055
    selected: "Selected",
    hint: "Hint",
    answerShownAfterTries: "That was your second try, so here's the answer. Type it in to continue.",
    topikAnswerShown: "That was your second try, so the correct answer is highlighted.",
    topikAnswerRevealedTitle: "Here's the correct answer",
    customApplied: "The rest of your set now matches your request.",
    customConflict: "Your set changed in the meantime. Please send your request again.",
    tutorAutoQuestion: "Give me a hint about why my answer was wrong.",
    tutorLimit: "You've used all your questions for this item.",
    tutorWithdrawn: "This item was withdrawn for an error, so it can't be explained.",
  },

  /** Chat sheet (Ask AI). */
  chat: {
    ask: "Ask",
    closeA11y: "Close the ask dialog",
    inputA11y: "Chat input",
    inputPlaceholder: "Type a message.",
    send: "Send message",
    loading: "Loading the answer",
    disclaimer: "AI answers aren't perfect and can make mistakes. Please use them as a reference.",
    limitReached: "You can ask up to {limit} questions today", // 784:55468
    limitUpsell: "Upgrade to Premium for unlimited questions✨",
  },

  /** Conversation / TOPIK / practice / exam screens. */
  study: {
    reviewTitle: "Review questions",
    /** COU-003 (EN 1464:22035) — the review-count modal. */
    solvePrompt: "Try this question", // EN 784:58688
    tryAgain: "Try again!", // EN 784:58746
    correctTitle: "Correct!", // EN 784:58804
    practiceCount: "Question {current}/{total}", // EN 784:58917
    cardNext: "Next",
    saveQuestion: "Save question",
    unsaveQuestion: "Remove from saved",
    reviewPrompt: "Check what you learned today",
    howManyQuestions: "How many questions?",
    startNow: "Let's start!",
    questionCount: "{n} questions",
    preparing: "Preparing your questions…",
    submitShort: "Submit",
  },

  /** Courses / lectures. */
  courses: {
    title: "Classes",
    trackAll: "All",
    trackConversation: "Conversation",
    trackTopik: "Topik", // 2397:25965
    trackFilter: "Track filter",
    freeSuffix: ", free class",
    loadError: "Couldn't load the classes.",
    empty: "No classes added yet", // 2397:25965
    noBanners: "No banner to display", // 2397:25965
    bannerAria: "Banners",
    bannerItemA11y: "{alt} (banner {i}/{total})",
    streakCalendarA11y: "{days}-day streak, open calendar",
    streakCalendarPlainA11y: "Streak, open calendar",
    chatbotA11y: "Chat freely with the AI chatbot",
    resume: "Resume",
    done: "Done",
    levelBeginner: "Beginner",
    levelIntermediate: "Intermediate",
    levelAdvanced: "Advanced",
    progress: "Progress",
    premiumRequired: "This lecture needs a Premium subscription\nGo Premium to watch every lecture ✨", // cp_G_03_toast 784:63104 style
    practicePremiumRequired: "Extra question practice is Premium only\nGo Premium for more practice ✨",
    videoLoadError: "Couldn't load the video.", // app-authored
    /** COU-002 (EN 2397:26192) — the lesson row's completion chip and CTA. */
    /** COU-004 (EN 784:55155) — the video player's chrome. */
    excludeSpeaking: "Skip speaking", // EN 784:55155
    excludePractice: "Skip practice", // EN 1135:20153
    askBubble: "Ask me anything!",
    speakPrompt: "Repeat after me!", // EN 784:50115
    speakPerfect: "Perfect!", // EN 784:50165
    speakAgain: "Try again!", // EN 784:50221
    speakRetry: "Retry",
    listenA11y: "Listen to the sentence",
    listeningA11y: "Listening. Repeat the sentence.",
    scoringA11y: "Checking your pronunciation.",
    saveSentence: "Save sentence",
    unsaveSentence: "Unsave sentence",
    micTitle: "Allow Microphone Access", // EN 1565:25072
    micText: "Microphone access is required to use this feature",
    micClose: "Close",
    micAllow: "Allow access",
    endTitle: "Amazing!", // EN 784:63425
    endWarn: "You made it to the end! 👏",
    endText: "You learned one more expression 😊",
    endCta: "Continue",
    quitTitle: "Still a bit left,\nquit the class?", // EN 784:52244
    quitText: "Finishing it will make your day 😊",
    quitGoalTitle: "Ready to stop?", // EN 1616:25238
    quitGoalText: "Today's goal is done! Look at you, still going strong 🔥",
    keepGoing: "Keep going",
    quitNow: "Quit now",
    rewardTitle: "Watched!", // EN 1421:21813
    rewardText: "You've earned your points! 👏",
    rewardA11y: "You earned {points} points",
    rewardConfirm: "OK",
    rewardClose: "Close",
    sentenceCount: "Sentence {current}/{total}", // EN 784:58866
    prevSentence: "Previous sentence",
    nextSentence: "Next sentence",
    restart: "Retry", // EN 784:59286 labels the restart tile Retry
    finish: "Done",
    noSpeakPractice: "This class has no repeat-after-me practice",
    practiceQuitTitle: "Ready to finish?", // EN 784:59355
    practiceQuitText: "You're almost there 💪",
    stopHere: "Stop here",
    explainBubble: "I'll explain the confusing part!", // EN 784:58975
    retryQuiz: "Retry", // EN 784:59157
    topikPracticeA11y: "Question practice for {title}",
    play: "Play",
    pause: "Pause",
    back5: "Back 5 seconds",
    fwd5: "Forward 5 seconds",
    speedA11y: "Playback speed {rate}x",
    startNow: "Start Class", // EN 2397:26192
    doneChip: "Done",
    notDone: "Not done",
    practiceA11y: "Speaking practice for {title}",
  },

  /** Account management. */
  /** Account management / MOR-002, Figma 784:52621 — both inline actions are
      lower-case "change" in the English frame. */
  account: {
    title: "Account",
    name: "Name",
    email: "Email",
    phone: "Phone",
    password: "Password",
    changePhone: "Change",
    changePassword: "Change password",
    change: "Change",
  },

  /** Voucher success modal. */
  voucherSuccess: {
    title: "Your code has been registered",
    appliedPlan: "Applied subscription",
    plan: "Plan",
    subType: "Subscription type",
    validity: "Valid until",
    singleUse: "Single use only",
  },

  /** League lifecycle modals + result. */
  leagueLifecycle: {
    /* 893:30887 — Figma's own English, which the hand-written copy had drifted
       from on all three strings. */
    startedTitle: "League has started!",
    startedDesc: "Study now and climb the ranks!",
    join: "Join Now",
    /* 784:57721 */
    finishedTitle: "Last league has ended!",
    finishedDesc: "Check your results now",
    seeResult: "See Results",
    /* 3329:37296 — title + start time quoted in ET, now with a primary CTA. */
    preparingTitle: "Next league coming soon!",
    startsAt: "Starts {day} at {time}(ET)",
    startingSoon: "Starting soon",
    backToHome: "Back to Home", // 3329:37301
    // 3453:27323 — see the note on the Korean pair.
    waitingTitle: "Waiting for your league!",
    waitingDesc: "Your league starts once enough learners join",
    /* LEG-006 (784:56833) / LEG-007 (960:26189) / LEG-008 (960:26295). */
    resultCongrats: "Congrats!",
    resultWellDone: "You held on!",
    resultPromoted: "You made the Top {rank} and\nmoved up to {tier}! 🎉",
    resultRetained: "You kept your place in the {tier}!\nAim higher next season 💪",
    resultDemoted: "You're back in the {tier}.\nEvery small step leads to a big leap 🌱",
    resultTryAgain: "That was tough...",
    finalRank: "Final rank {rank} of {total}",
    keepGoing: "Keep Going", // 784:56833
  },

  /** Find Email / AME-007, Figma 784:50278. */
  findEmail: {
    title: "Find email", // I784:50280;2537:25942
    subtitle: "Enter your information to find your email.", // I784:50280;2537:25944
    nameLabel: "Name", // I888:22601;3021:65594
    namePlaceholder: "Enter your name", // I888:22601;3021:65597
    phoneLabel: "Phone", // 888:22611
    verify: "Verify", // I1234:22574;3021:65406
    verified: "Verified",
    codeLabel: "Enter code", // 784:50292
    codePlaceholder: "Enter 6-digit code", // 1612:23690
    check: "Check", // I1612:23692;3021:65406
    checkDone: "Done",
    submit: "Find email", // I784:50298;3034:65139;3021:65367
    /* app-authored validation / a11y (no Figma node). */
    nameRequired: "Enter your name.",
    phoneA11y: "Phone number",
    requestCodeA11y: "Request verification code",
    codeA11y: "Verification code",
    checkCodeA11y: "Check verification code",
    submitBlockedA11y: "Verify your phone number to find your email",
  },

  /** Find Email — result / AME-008, Figma 784:50320. */
  findEmailResult: {
    title: "Email found!", // I784:50323;2537:25942
    subtitle: "You signed up with this email.", // I784:50323;2537:25944
    forgotPrompt: "Forgot your password?", // 784:50327
    forgotLink: "Reset password", // 784:50328
    goToLogin: "Go to login", // I784:50325;3034:65139;3021:65365
    emailA11y: "Registered email {email}", // app-authored (a11y)
    noEmailTitle: "We found your account!",
    noEmailSubtitle: "This account has no email registered. Sign in with the social login you signed up with.",
  },

  /** More / MOR-005, Figma 893:33047 — menu from 893:33108. */
  more: {
    account: "Account", // 784:52322
    payment: "Payment", // 784:52323
    language: "Language", // 784:52324
    notifications: "Notifications", // 784:52325
    friends: "Manage Friends", // 784:52326
    announcements: "Notices", // 784:52327 (MOR-001 is authoritative)
    faq: "FAQ", // 784:52328
    terms: "Terms & Policy", // 784:52329
    /** Stats row — MOR-001_더보기메인 784:52289 / 784:52306 / 784:52318. */
    totalStudyDays: "Total Study Days",
    bestStreak: "Best streak",
    currentStreak: "Current Streak",
    /** Comp_subs_box (893:33150). */
    myPlan: "My Plan",
    freeTrial: "Free Trial",
    nextBilling: "Next billing date",
    subscribe: "Subscribe",
    noPlan: "You have no active plan",
    subLoadError: "Couldn't load your subscription",
    planFallback: "Subscription plan",
    withdraw: "Delete Account", // 784:52264
    logout: "Log Out", // 784:52265
    /* app-authored accessibility labels (no Figma node). */
    editProfile: "Edit profile",
    noPlanA11y: "You have no active plan. Go to subscription management",
    subscribeA11y: "Subscribe, see plans and pricing",
    daysSuffix: "{n}d", // 893:33094 renders the count as "00d"
  },

  /** app-authored: sign-out / deletion outcomes have no design frame. */
  accountFlow: {
    logoutDoneTitle: "You've Been Logged Out", // 3085:29165
    /** 3085:29166 breaks after "data" — line 2 is the longer of the two, so
        this is an explicit break, not where the text would wrap on its own. */
    logoutDoneDesc: "Your learning history and data\nare safely stored in your account",
    logoutFailTitle: "Couldn't log out",
    withdrawFailTitle: "Couldn't delete your account",
    temporaryError: "Something went wrong",
    tryAgainLater: "Please try again shortly",
    withdrawDoneTitle: "Account Deleted", // 3085:29144
    withdrawDoneLine1: "Thank you for using our service",
    withdrawDoneLine2: "We hope to see you again",
    nextBillingA11y: "{plan}{billing}. Go to subscription management",
    nextBillingSuffix: ", next billing date {date}",
  },

  /** Account deletion / MOR-005 overlay, Figma 893:33228. */
  withdraw: {
    title: "Delete Account", // 893:33231
    /** 893:33232 carries an explicit break after "below," just like the Korean. */
    subtitle: "Please read the info below,\nthen tap Delete.",
    noticeTitle: "Before you go", // 893:33234
    /** 893:33235 — same three bullets; the last is Negative-coloured. */
    notice1: "If you sign up again, you'll start over with a new account. Nothing carries over from this one.",
    notice2:
      "Study & course history cannot be recovered, and all login-required features will be disabled.",
    notice3: "Deleting your account cancels all subscriptions with no refund.",
    cancel: "Cancel",
    confirm: "Delete",
    confirmA11y: "Proceed with account deletion", // app-authored (a11y)
  },

  /** Notification Settings / PUS-003, Figma 784:49764. */
  notificationSettings: {
    title: "Notifications", // I784:49767;3021:65311
    service: "Service Alerts", // 784:49769
    marketing: "Promotional Alerts", // 784:49772
    error: "Couldn't update the setting.", // app-authored
  },

  /** Language Settings / SET-002, Figma 1332:23178. */
  /** Language settings / MOR-020, Figma 784:50667. */
  languageSettings: {
    title: "Language", // 784:50670
    save: "Save",
    saveA11y: "Save language setting", // app-authored (a11y)
    selected: "selected", // app-authored (a11y)
    savedModalTitle: "Language settings have been saved",
    savedModalDesc: "You can now use the app in your selected language",
    errorToast: "Unable to save the language setting. Please try again shortly.", // app-authored
  },

  invite: {
    title: "Friend Invitation",
    invalid: "This invitation link isn't valid",
    invalidSub: "The link may have expired or been cancelled.",
    isSelf: "This is your own invitation link.",
    alreadyFriends: "You're already friends.",
    sendRequest: "Send Friend Request",
    accept: "Accept",
    requested: "Request sent",
    requestSent: "Friend request sent",
    goToFriends: "Go to Friends",
    goHome: "Go home",
  },
};
