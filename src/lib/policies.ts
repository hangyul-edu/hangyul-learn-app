/**
 * In-app legal documents: the three shown from the sign-up agreement sheet and
 * the three reachable from More → 약관 및 정책 at /policy/:doc.
 *
 * Documents are keyed by language first, so the detail screen renders the copy
 * for whatever language the app is in rather than a hardcoded locale. The three
 * Terms & Policies documents are transcribed from Figma, which authors each one
 * as a Korean frame and an English frame:
 *
 *   terms-of-use      TRM-002  ko 926:19237   en 926:19320
 *   purchase-privacy  TRM-003  ko 1:1621      en 784:49783
 *   refund            TRM-004  ko 924:19180   en 925:19205
 *
 * The three sign-up consent summaries (`terms`, `privacy`, `third-party`) have
 * no Figma frame of their own; they are app-authored plain-language summaries
 * and the English side is a translation of the Korean.
 */
import type { AppLanguage } from "./language";

export type PolicyId =
  | "privacy"
  | "third-party"
  | "terms-of-use"
  | "purchase-privacy"
  | "refund";

/**
 * The Terms of Service, referenced by id rather than spelled out at each call
 * site: the sign-up agreement sheet and the Terms & Policies detail page must
 * show the same document, so there is one copy (a separate sign-up summary
 * would drift from TRM-002).
 */
export const TERMS_OF_SERVICE = "terms-of-use" satisfies PolicyId;

/** A content block within a section: a plain paragraph or a bullet list. */
export type PolicyBlock = string | { bullets: string[] };

export interface PolicyDoc {
  title: string;
  updated?: string;
  intro?: string;
  sections: { heading: string; body: PolicyBlock[] }[];
  /** Sign-off rendered after the final section — TRM-002 ends with one. */
  closing?: string;
}

/* ------------------------------- Korean --------------------------------- */

const KO: Record<PolicyId, PolicyDoc> = {
  privacy: {
    title: "개인정보 수집 및 이용동의",
    updated: "2026-07-01",
    intro: "회사는 회원가입 및 서비스 제공을 위하여 아래와 같이 개인정보를 수집·이용합니다.",
    sections: [
      {
        heading: "1. 수집하는 항목",
        body: [
          "필수: 이름, 휴대폰번호, 이메일 주소, 비밀번호, 국가정보.",
          "서비스 이용 과정에서 학습 기록, 접속 로그, 기기정보가 자동으로 생성·수집될 수 있습니다.",
        ],
      },
      {
        heading: "2. 이용 목적",
        body: [
          "본인 확인 및 회원 관리, 서비스 제공 및 개선, 고객 문의 대응, 부정 이용 방지를 위해 이용합니다.",
        ],
      },
      {
        heading: "3. 보유 및 이용 기간",
        body: [
          "회원 탈퇴 시 지체 없이 파기하는 것을 원칙으로 합니다. 다만 관계 법령에 따라 보관이 필요한 경우 해당 기간 동안 보관합니다.",
        ],
      },
      {
        heading: "4. 동의를 거부할 권리",
        body: [
          "회원은 개인정보 수집·이용 동의를 거부할 수 있으나, 필수 항목에 동의하지 않을 경우 회원가입이 제한될 수 있습니다.",
        ],
      },
    ],
  },

  "third-party": {
    title: "개인정보 제3자 제공동의",
    updated: "2026-07-01",
    intro: "회사는 원칙적으로 회원의 개인정보를 외부에 제공하지 않으나, 서비스 제공을 위해 아래의 경우 제3자에게 제공할 수 있습니다.",
    sections: [
      {
        heading: "1. 제공받는 자",
        body: ["본인 인증(SMS/이메일), 결제, 클라우드 인프라 등 서비스 운영에 필요한 제휴사 및 수탁사."],
      },
      {
        heading: "2. 제공하는 항목",
        body: ["본인 확인 및 서비스 이행에 필요한 최소한의 정보(예: 휴대폰번호, 이메일 주소, 결제 관련 정보)."],
      },
      {
        heading: "3. 제공받는 자의 이용 목적",
        body: ["본인 인증, 결제 처리, 서비스 제공 및 안정적 운영."],
      },
      {
        heading: "4. 보유 및 이용 기간",
        body: [
          "제공 목적 달성 시까지 보유하며, 관계 법령에서 정한 기간이 있는 경우 해당 기간 동안 보관 후 파기합니다.",
          "회원은 제3자 제공 동의를 거부할 수 있으며, 이 경우 관련 서비스 이용이 제한될 수 있습니다.",
        ],
      },
    ],
  },

  /* --- Terms & Policies flow (약관 및 정책, reachable from the More page) --- */

  /** TRM-002 (926:19237). */
  "terms-of-use": {
    title: "이용약관",
    sections: [
      {
        heading: "제1조 (목적)",
        body: [
          `이 약관은 한귤(이하 "회사")이 제공하는 한국어 학습 서비스(이하 "서비스")의 이용 조건 및 절차, 회사와 이용자 간의 권리·의무 및 책임 사항을 규정하는 것을 목적으로 합니다.`,
        ],
      },
      {
        heading: "제2조 (용어의 정의)",
        body: [
          {
            bullets: [
              `"서비스"란 회사가 제공하는 한귤 앱 및 관련 부가 서비스를 의미합니다.`,
              `"이용자"란 이 약관에 동의하고 서비스를 이용하는 회원을 의미합니다.`,
              `"계정"이란 이용자가 서비스 이용을 위해 설정한 이메일 및 비밀번호 등의 고유 정보를 의미합니다.`,
            ],
          },
        ],
      },
      {
        heading: "제3조 (약관의 효력 및 변경)",
        body: [
          "이 약관은 서비스 화면에 게시하거나 이용자에게 통지함으로써 효력이 발생합니다. 회사는 필요한 경우 약관을 변경할 수 있으며, 변경 시 최소 7일 전에 공지합니다. 단, 이용자에게 불리한 변경의 경우 30일 전에 공지합니다.",
        ],
      },
      {
        heading: "제4조 (이용 자격)",
        body: [
          "누구나 회사가 정한 절차에 따라 회원가입 후 서비스를 이용할 수 있습니다. 단, 만 14세 미만의 경우 법정대리인의 동의가 필요합니다.",
        ],
      },
      {
        heading: "제5조 (회원가입 및 계정 관리)",
        body: [
          {
            bullets: [
              "이용자는 회사가 정한 절차에 따라 회원가입을 완료한 후 서비스를 이용할 수 있습니다.",
              "이용자는 자신의 계정 정보를 타인에게 양도하거나 공유할 수 없습니다.",
              "계정 도용 또는 부정 이용이 발생한 경우 즉시 회사에 통보해야 합니다.",
            ],
          },
        ],
      },
      {
        heading: "제6조 (서비스 이용)",
        body: [
          {
            bullets: [
              "회사는 무료 플랜과 프리미엄 플랜을 제공하며, 플랜별 이용 가능한 기능이 다를 수 있습니다.",
              "프리미엄 플랜은 구독 시작일로부터 7일 무료 체험이 제공되며, 무료 체험 종료 후 자동으로 유료 결제가 진행됩니다.",
              "구독 해지를 원하는 경우 무료 체험 기간 내에 직접 해지하셔야 합니다.",
              "무료 체험 종료 1일 전, 자동 결제 예정 안내가 이메일로 발송됩니다. 해지를 원하시면 안내 수신 후 체험 종료 전까지 직접 해지하시기 바랍니다.",
            ],
          },
        ],
      },
      {
        heading: "제7조 (결제 및 요금)",
        body: [
          {
            bullets: [
              "프리미엄 플랜의 이용 요금은 서비스 내 안내된 금액에 따르며, 회사는 사전 공지 후 요금을 변경할 수 있습니다.",
              "결제는 이용자가 등록한 신용카드·체크카드, 토스페이 등의 간편결제수단, 또는 App Store·Google Play의 인앱결제를 통해 이루어집니다.",
              "연간 구독은 결제일로부터 12개월치 요금이 일괄 청구되며, 월간 구독은 매월 결제일에 자동 청구됩니다.",
              "요금은 이용자가 등록한 휴대폰 번호의 국가에 따라 원화(KRW) 또는 미국 달러(USD)로 책정되며, 해당 통화로 청구됩니다. 등록 휴대폰 번호의 국가가 변경되는 경우, 다음 결제일부터 변경된 국가 기준의 요금이 적용됩니다.",
              "미성년자가 법정대리인의 동의 없이 결제한 경우, 법정대리인은 해당 결제를 취소할 수 있습니다.",
            ],
          },
        ],
      },
      {
        heading: "제8조 (구독 해지 및 환불)",
        body: [
          {
            bullets: [
              "구독 해지는 언제든지 신청할 수 있으며, 해지 후 현재 구독 기간 종료일까지 서비스를 이용할 수 있습니다.",
              "환불은 원결제 수단으로만 처리되며, 세부 환불 기준은 서비스 내 환불 정책에 따릅니다.",
              "월간 구독은 결제일로부터 7일 이내 미사용 시 전액 환불되며, 7일 초과 시 환불이 불가합니다.",
              "연간 구독은 결제일로부터 7일 이내 미사용 시 전액 환불되며, 그 외 결제일로부터 30일 이내에는 결제 금액에서 월간 구독 정상가 1개월분을 공제한 잔액이 환불됩니다. 결제일로부터 30일 초과 시 환불이 불가합니다.",
              "결제 오류 또는 이중결제 발생 시 앱 내 채널톡 채팅 상담으로 접수하면 확인 후 전액 환불 처리됩니다.",
              "회사의 귀책 사유로 서비스가 장기 중단된 경우, 중단 기간에 해당하는 요금을 일할 계산하여 환불합니다.",
              "App Store·Google Play를 통해 결제한 경우, 구독 해지와 환불은 해당 스토어의 정책과 절차에 따라 처리됩니다.",
            ],
          },
        ],
      },
      {
        heading: "제9조 (지식재산권)",
        body: [
          {
            bullets: [
              "서비스 내 모든 콘텐츠(강의, 문장, 음성, 이미지, UI 등)의 저작권 및 지식재산권은 회사에 귀속됩니다.",
              "이용자는 회사의 사전 동의 없이 서비스 내 콘텐츠를 복제·배포·수정·상업적으로 이용할 수 없습니다.",
              "이용자가 서비스 이용 중 생성한 학습 데이터의 저작권은 이용자에게 귀속되나, 회사는 서비스 개선 목적으로 익명화하여 활용할 수 있습니다.",
            ],
          },
        ],
      },
      {
        heading: "제10조 (개인정보 보호)",
        body: [
          "회사는 이용자의 개인정보를 관련 법령 및 회사의 개인정보처리방침에 따라 수집·이용·보관합니다. 개인정보처리방침은 서비스 내 약관 및 정책 메뉴에서 확인할 수 있습니다.",
        ],
      },
      {
        heading: "제11조 (AI 기능 이용)",
        body: [
          {
            bullets: [
              "회사는 발음 피드백, AI 질문 응답 등 AI 기반 기능을 제공합니다.",
              "AI 기능의 결과물은 참고용이며, 회사는 AI 답변의 정확성을 보장하지 않습니다.",
              "AI 기능 제공을 위해 이용자의 음성 데이터 및 학습 데이터가 일시적으로 처리될 수 있습니다.",
            ],
          },
        ],
      },
      {
        heading: "제12조 (금지 행위)",
        body: [
          "이용자는 다음 행위를 할 수 없습니다.",
          {
            bullets: [
              "타인의 계정을 도용하거나 허위 정보로 가입하는 행위",
              "서비스의 정상적인 운영을 방해하는 행위",
              "회사의 사전 동의 없이 서비스 내 콘텐츠를 복제·배포·상업적으로 이용하는 행위",
              "다른 이용자에게 불쾌감을 주거나 명예를 훼손하는 행위",
              "계정을 타인과 공유하거나 양도하는 행위",
            ],
          },
        ],
      },
      {
        heading: "제13조 (서비스 중단 및 변경)",
        body: [
          "회사는 시스템 점검, 장애, 운영상의 이유로 서비스를 일시 중단할 수 있습니다. 사전에 공지가 가능한 경우 최소 24시간 전에 안내드립니다.",
        ],
      },
      {
        heading: "제14조 (계약 해지 및 이용 제한)",
        body: [
          "이용자는 언제든지 서비스 내 더보기 메뉴를 통해 회원 탈퇴를 요청할 수 있습니다. 회사는 금지 행위를 한 이용자에 대해 사전 통보 후 이용을 제한하거나 계약을 해지할 수 있습니다.",
        ],
      },
      {
        heading: "제15조 (계정 비활성화)",
        body: [
          "최종 접속일로부터 1년 이상 서비스를 이용하지 않은 계정은 휴면 계정으로 전환될 수 있습니다. 휴면 전환 30일 전 등록된 이메일로 사전 안내드립니다.",
        ],
      },
      {
        heading: "제16조 (책임의 한계)",
        body: [
          "회사는 천재지변, 서비스 장애 등 불가항력적인 사유로 인한 서비스 중단에 대해 책임을 지지 않습니다. 이용자가 서비스를 이용하여 발생한 손해에 대해 회사의 고의 또는 중과실이 없는 경우 책임을 지지 않습니다.",
        ],
      },
      {
        heading: "제17조 (준거법 및 관할)",
        body: [
          "이 약관은 대한민국 법률에 따라 해석되며, 서비스 이용과 관련한 분쟁은 회사의 소재지를 관할하는 법원을 전속 관할 법원으로 합니다.",
        ],
      },
      {
        heading: "부칙",
        body: ["이 약관은 2026년 10월 26일부터 시행합니다."],
      },
    ],
    closing: "한귤 운영팀 드림",
  },

  /** TRM-003 (1:1621). */
  "purchase-privacy": {
    title: "개인정보처리 방침",
    sections: [
      {
        heading: "1. 수집하는 개인정보 항목",
        body: [
          "한귤 앱은 원활한 서비스 제공을 위해 다음과 같은 최소한의 정보를 수집합니다.",
          "회원가입 시: 이름(닉네임), 이메일 주소, 비밀번호, 서비스 이용 기록.",
          "학습 서비스 이용 시: 학습 기록(진도율, 오답 기록, 퀴즈 점수), 발음 연습을 위한 음성 데이터(일시적 수집 후 파기).",
          "결제 시: 결제 수단 정보(카드사명, 카드 번호 일부), 결제 내역, 거래 기록.",
          "자동 수집 정보: 서비스 이용 기록, 접속 로그, 쿠키, 기기 정보(OS, IP 주소) 등.",
        ],
      },
      {
        heading: "2. 개인정보의 수집 및 이용 목적",
        body: [
          "수집된 개인정보는 오직 다음의 목적으로만 이용됩니다.",
          "서비스 제공: 학습 콘텐츠 제공, 진도 관리, 맞춤형 학습 추천.",
          "회원 관리: 본인 확인, 서비스 이용 약관 위반 행위 제재, 공지사항 전달.",
          "결제 및 환불 처리: 구독 결제, 환불, 결제 오류 처리.",
          "학습 환경 개선: 사용 패턴 분석을 통한 서비스 기능 개선 및 신규 서비스 개발.",
          "고객 지원: 문의 및 불만 사항 처리.",
          "AI 서비스 개선: 발음 피드백, AI 질문 응답 등 AI 기반 기능 제공 및 품질 향상을 위해 이용자의 음성 데이터 및 학습 데이터가 익명화 처리 후 활용될 수 있습니다. 이용자는 해당 활용에 대해 서비스 가입 시 동의하며, 언제든지 support@talkhangyul.com을 통해 동의를 철회할 수 있습니다.",
        ],
      },
      {
        heading: "3. 개인정보의 보유 및 이용 기간",
        body: [
          "한귤 앱은 이용자의 개인정보를 원칙적으로 회원 탈퇴 시 또는 개인정보 수집 및 이용 목적이 달성된 후 지체 없이 파기합니다.",
          "다만, 관계 법령에 따라 일정 기간 보존이 필요한 경우에는 해당 기간 동안 안전하게 보관합니다.",
          "계약 또는 청약철회 등에 관한 기록: 5년 보존. 소비자의 불만 또는 분쟁 처리에 관한 기록: 3년 보존. 결제 및 거래 기록: 5년 보존.",
        ],
      },
      {
        heading: "4. 개인정보의 제3자 제공",
        body: [
          "회사는 원칙적으로 이용자의 개인정보를 외부에 제공하지 않습니다. 다만, 결제 처리를 위해 아래와 같이 최소한의 정보를 제공합니다.",
          "제공받는 자: 토스페이먼츠(주) 등 이용자가 선택한 결제사",
          "제공 목적: 결제 처리 및 결제 내역 관리",
          "제공 항목: 결제 수단 정보, 결제 금액, 거래 기록 보유 기간: 결제 완료 후 5년 (관계 법령에 따름)",
        ],
      },
      {
        heading: "5. 개인정보의 파기 절차 및 방법",
        body: [
          "개인정보는 목적 달성 후 별도의 DB로 옮겨져 관계 법령에 따라 일정 기간 보존된 후 파기됩니다.",
          "전자적 파일 형태: 복구 및 재생이 불가능하도록 기술적 방법으로 영구 삭제됩니다. 종이 문서 형태: 분쇄기로 분쇄하거나 소각하여 파기됩니다.",
        ],
      },
      {
        heading: "6. 아동 개인정보 보호",
        body: [
          "한귤 앱은 만 14세 미만 아동의 개인정보 보호에 특별히 주의를 기울입니다.",
          "한귤 앱은 만 14세 미만 이용자의 경우 보호자(부모 또는 법정대리인)의 동의 하에 이용하시기 바랍니다. 보호자는 아동의 개인정보 열람, 정정, 삭제 요청을 support@talkhangyul.com을 통해 접수하실 수 있습니다.",
        ],
      },
      {
        heading: "7. 이용자 및 법정대리인의 권리와 그 행사 방법",
        body: [
          "이용자는 언제든지 본인의 개인정보에 대해 다음과 같은 권리를 행사할 수 있습니다.",
          "개인정보 열람, 정정, 삭제 요구. 개인정보 처리 정지 요구. 회원 탈퇴 요청.",
          "이러한 권리 행사는 앱 내 채널톡 채팅 상담 또는 support@talkhangyul.com을 통해 가능하며, 요청 시 본인 확인 절차를 거칩니다.",
        ],
      },
      {
        heading: "8. EU 이용자 개인정보 보호 (GDPR)",
        body: [
          "유럽경제지역(EEA) 이용자에게는 GDPR이 적용됩니다. 회사는 동의, 계약 이행, 정당한 이익에 근거하여 개인정보를 처리하며, EEA 이용자는 열람, 정정, 삭제, 처리 제한, 데이터 이동, 처리 반대 권리를 행사할 수 있습니다. 권리 행사 및 문의는 support@talkhangyul.com으로 연락하시기 바랍니다. 개인정보는 대한민국 서버에 저장되며, EEA 외부 이전 시 GDPR이 요구하는 보호 조치를 적용합니다.",
        ],
      },
      {
        // The frame reads "9. 개인정보 보호책임자 개인정보"; the trailing "개인정보"
        // duplicates the start of the heading and is an authoring slip — the
        // English frame is just "Privacy Officer" — so it is dropped here.
        heading: "9. 개인정보 보호책임자",
        body: ["보호책임자: 유재희 문의: support@talkhangyul.com 또는 앱 내 채널톡 채팅 상담"],
      },
    ],
  },

  /** TRM-004 (924:19180). */
  refund: {
    title: "구독 해지 및 환불 정책",
    sections: [
      {
        heading: "1. 기본 원칙",
        body: [
          "본 환불 정책은 전자상거래 등에서의 소비자보호에 관한 법률에 따라 운영됩니다. 법령이 정한 소비자 권익은 본 정책보다 우선합니다. 환불은 원결제 수단으로만 처리되며, 다른 수단으로의 환불은 제공되지 않습니다.",
        ],
      },
      {
        heading: "2. 구독 해지",
        body: [
          "구독은 언제든지 취소할 수 있습니다. 해지는 다음 결제일 이전에 신청해야 하며, 해지 신청 후 현재 구독 기간 종료일까지 서비스를 정상적으로 이용할 수 있습니다. 이후 자동 결제는 중단됩니다. 해지는 환불과 다르며, 이미 결제된 금액의 반환을 의미하지 않습니다.",
        ],
      },
      {
        heading: "3. 7일 무료 체험",
        body: [
          "구독 시작 전 7일간 프리미엄 플랜의 모든 기능을 무료로 체험할 수 있습니다. 무료 체험 시작 시 신용카드 등록이 필요하며, 체험 종료 당일 선택한 플랜으로 자동 결제됩니다. 체험 기간 내 취소 시 요금이 청구되지 않습니다.",
        ],
      },
      {
        heading: "4. 월간 구독 환불",
        body: [
          "결제일로부터 7일 이내 미사용 시 전액 환불됩니다. 7일 초과 시 환불이 불가하며, 다음 결제일까지 서비스를 이용할 수 있습니다.",
        ],
      },
      {
        heading: "5. 연간 구독 환불",
        body: [
          "결제일로부터 7일 이내 미사용 시 전액 환불됩니다. 그 외 결제일로부터 30일 이내에 환불을 요청하는 경우, 월간 구독 정상가 1개월분을 공제한 후 잔액이 환불됩니다. 공제 금액은 결제한 통화를 기준으로 적용됩니다.",
          { bullets: ["공제 금액: 원화 결제 시 22,000원, 달러 결제 시 $12.99"] },
          // The frame indents the second example with a stray leading space.
          "예시: 연간 구독(144,000원) 결제 후 20일째 환불 요청 시, 22,000원을 공제한 122,000원이 환불됩니다.",
          "예시: 연간 구독($95.88) 결제 후 20일째 환불 요청 시, $12.99를 공제한 $82.89가 환불됩니다.",
          "결제일로부터 30일이 지나면 환불이 불가하며, 구독 기간 종료일까지 서비스를 이용할 수 있습니다.",
        ],
      },
      {
        heading: "6. 환불이 되지 않는 경우",
        body: [
          {
            bullets: [
              "월간 구독 결제일로부터 7일 초과 후 단순 변심에 의한 환불 요청",
              "연간 구독 결제일로부터 30일 초과 후 환불 요청",
              "계정 공유, 어뷰징 등 이용약관 위반으로 서비스 이용이 제한된 경우",
              "7일 무료 체험 종료 후 자동 결제된 건(체험 기간 내 미취소)",
            ],
          },
        ],
      },
      {
        heading: "7. 결제 오류 및 이중결제",
        body: [
          "결제 오류 또는 이중결제가 발생한 경우 채널톡 채팅 상담으로 접수해 주세요. 확인 후 전액 환불 처리되며, 결제 오류는 환불 기간 제한과 무관하게 처리됩니다.",
        ],
      },
      {
        heading: "8. 환불 신청 방법",
        body: [
          "별도의 인앱 환불 버튼은 제공되지 않습니다. 환불을 원하시는 경우 앱 내 채널톡 채팅 상담으로 접수해 주세요.",
          "채널톡 운영시간 AI 상담: 24시간 상담사 직접 연결: 평일 09:00 – 18:00 (KST)",
          "접수 후 영업일 기준 3~5일 내 처리되며, 환불 금액은 원결제 수단으로 3~10 영업일 내 반환됩니다.",
          "신용카드·체크카드: 카드사 환불. 간편결제수단(토스페이 등): 해당 결제사 환불 처리.",
        ],
      },
      {
        heading: "9. 정책 변경 안내",
        body: ["본 정책이 변경될 경우 앱 내 공지사항을 통해 사전 안내합니다."],
      },
    ],
  },
};

/* ------------------------------- English -------------------------------- */

const EN: Record<PolicyId, PolicyDoc> = {
  privacy: {
    title: "Consent to Collection and Use of Personal Information",
    updated: "2026-07-01",
    intro:
      "The Company collects and uses personal information as set out below in order to register members and provide the Service.",
    sections: [
      {
        heading: "1. Information Collected",
        body: [
          "Required: name, mobile number, email address, password, country.",
          "Learning records, access logs, and device information may be generated and collected automatically while the Service is used.",
        ],
      },
      {
        heading: "2. Purpose of Use",
        body: [
          "Used for identity verification and member management, provision and improvement of the Service, responding to customer inquiries, and prevention of misuse.",
        ],
      },
      {
        heading: "3. Retention and Use Period",
        body: [
          "As a rule, information is deleted without delay upon withdrawal of membership. Where retention is required by applicable law, it is kept for the period that law prescribes.",
        ],
      },
      {
        heading: "4. Right to Refuse Consent",
        body: [
          "Members may refuse consent to the collection and use of personal information; registration may be unavailable without consent to the required items.",
        ],
      },
    ],
  },

  "third-party": {
    title: "Consent to Third-Party Provision of Personal Information",
    updated: "2026-07-01",
    intro:
      "As a rule the Company does not provide members' personal information to outside parties, but it may do so in the following cases in order to provide the Service.",
    sections: [
      {
        heading: "1. Recipients",
        body: [
          "Partners and processors required to operate the Service, such as identity verification (SMS/email), payments, and cloud infrastructure.",
        ],
      },
      {
        heading: "2. Items Provided",
        body: [
          "The minimum information needed for identity verification and performance of the Service (for example mobile number, email address, and payment-related information).",
        ],
      },
      {
        heading: "3. Purpose of Use by the Recipient",
        body: ["Identity verification, payment processing, and stable provision of the Service."],
      },
      {
        heading: "4. Retention and Use Period",
        body: [
          "Retained until the purpose of provision is fulfilled; where a period is prescribed by applicable law, it is kept for that period and then destroyed.",
          "Members may refuse consent to third-party provision, in which case the related parts of the Service may be unavailable.",
        ],
      },
    ],
  },

  /* --- Terms & Policies flow --- */

  /** TRM-002 (926:19320). */
  "terms-of-use": {
    title: "Terms of Service",
    sections: [
      {
        heading: "Article 1 (Purpose)",
        body: [
          `These Terms of Service govern the conditions and procedures for use of the Korean language learning service (hereinafter "Service") provided by HanGyul (hereinafter "Company"), as well as the rights, obligations, and responsibilities of the Company and its users.`,
        ],
      },
      {
        heading: "Article 2 (Definitions)",
        body: [
          {
            bullets: [
              `"Service" refers to the HanGyul app and any related supplementary services provided by the Company.`,
              `"User" refers to any member who agrees to these Terms and uses the Service.`,
              `"Account" refers to the unique credentials, including email address and password, set by the user for accessing the Service.`,
            ],
          },
        ],
      },
      {
        heading: "Article 3 (Effectuation and Amendment of Terms)",
        body: [
          "These Terms take effect upon posting on the Service or notification to users. The Company may amend these Terms as necessary and will provide at least 7 days' notice prior to any changes. In cases where amendments are unfavorable to users, at least 30 days' notice will be given.",
        ],
      },
      {
        heading: "Article 4 (Eligibility)",
        body: [
          "Anyone may use the Service after completing registration in accordance with the Company's procedures. Users under the age of 14 require consent from a legal guardian.",
        ],
      },
      {
        heading: "Article 5 (Registration and Account Management)",
        body: [
          {
            bullets: [
              "Users may access the Service after completing registration in accordance with the Company's procedures.",
              "Users may not transfer or share their account credentials with others.",
              "In the event of unauthorized access or misuse of an account, users must notify the Company immediately.",
            ],
          },
        ],
      },
      {
        heading: "Article 6 (Use of Service)",
        body: [
          {
            bullets: [
              "The Company offers a Free Plan and a Premium Plan, with different features available under each plan.",
              "The Premium Plan includes a 7-day free trial from the subscription start date, after which paid billing begins automatically.",
              "Users who wish to cancel must do so within the free trial period.",
              "One day before your free trial ends, you will receive an email notifying you of the upcoming automatic charge. If you wish to cancel, please do so before the trial period ends.",
            ],
          },
        ],
      },
      {
        heading: "Article 7 (Payments and Fees)",
        body: [
          {
            bullets: [
              "Premium Plan fees are as stated within the Service, and the Company may adjust pricing with prior notice.",
              "Payments are processed via credit card, debit card, simple payment methods (such as Toss Pay) registered by the user, or in-app purchase through the App Store or Google Play.",
              "Annual subscriptions are billed in full for 12 months from the billing date. Monthly subscriptions are billed automatically on the same date each month.",
              "Fees are set in Korean Won (KRW) or US Dollars (USD) based on the country of the user's registered phone number and are charged in that currency. If the country of the registered phone number changes, fees based on the new country will apply from the next billing date. However, for payments made through the App Store or Google Play, fees are based on the country and currency registered with the respective store.",
              "If a minor completes a payment without consent from a legal guardian, the legal guardian may cancel the transaction.",
            ],
          },
        ],
      },
      {
        heading: "Article 8 (Cancellation and Refunds)",
        body: [
          {
            bullets: [
              "Subscriptions may be cancelled at any time. Following cancellation, the Service remains accessible until the end of the current subscription period.",
              "Refunds are processed to the original payment method only. Detailed refund criteria are governed by the Refund Policy within the Service.",
              "Monthly subscriptions are fully refunded if requested within 7 days of the billing date with no usage. No refund is available after 7 days.",
              "Annual subscriptions are fully refunded if requested within 7 days of the billing date with no usage. For any other refund request made within 30 days of the billing date, one month at the monthly standard price is deducted from the amount paid and the remaining balance is refunded. No refund is available more than 30 days after the billing date.",
              "Payment errors or duplicate charges may be submitted via in-app Channel Talk chat support and will be fully refunded upon verification.",
              "In the event of a prolonged service outage due to the Company's fault, fees corresponding to the outage period will be refunded on a pro-rata basis.",
              "For payments made through the App Store or Google Play, subscription cancellation and refunds are handled according to the respective store's policies and procedures.",
            ],
          },
        ],
      },
      {
        heading: "Article 9 (Intellectual Property)",
        body: [
          {
            bullets: [
              "All copyrights and intellectual property rights to content within the Service (including lectures, sentences, audio, images, and UI) are held by the Company.",
              "Users may not reproduce, distribute, modify, or commercially use any content within the Service without prior written consent from the Company.",
              "Copyrights to learning data generated by users during use of the Service belong to the respective users. However, the Company may use such data in anonymized form for the purpose of service improvement.",
            ],
          },
        ],
      },
      {
        heading: "Article 10 (Privacy)",
        body: [
          "The Company collects, uses, and stores personal information in accordance with applicable laws and the Company's Privacy Policy. The Privacy Policy is available in the Terms & Policies section within the Service.",
        ],
      },
      {
        heading: "Article 11 (AI Features)",
        body: [
          {
            bullets: [
              "The Company provides AI-based features including pronunciation feedback and AI question-and-answer functionality.",
              "Outputs generated by AI features are for reference only. The Company does not guarantee the accuracy of AI responses.",
              "Voice data and learning data may be processed temporarily to enable AI features.",
            ],
          },
        ],
      },
      {
        heading: "Article 12 (Prohibited Activities)",
        body: [
          "Users may not engage in any of the following activities.",
          {
            bullets: [
              "Unauthorized use of another user's account or registration using false information.",
              "Any act that interferes with the normal operation of the Service.",
              "Reproduction, distribution, or commercial use of Service content without prior written consent from the Company.",
              "Any act that causes discomfort to other users or damages their reputation.",
              "Sharing or transferring an account to another person.",
            ],
          },
        ],
      },
      {
        heading: "Article 13 (Service Suspension and Changes)",
        body: [
          "The Company may temporarily suspend the Service for system maintenance, technical issues, or operational reasons. Where advance notice is possible, users will be informed at least 24 hours in advance.",
        ],
      },
      {
        heading: "Article 14 (Termination and Restriction of Use)",
        body: [
          "Users may request account deletion at any time through the More menu within the app. The Company may restrict access or terminate agreements with users who engage in prohibited activities, following prior notice.",
        ],
      },
      {
        heading: "Article 15 (Account Inactivity)",
        body: [
          "Accounts that have not been accessed for one year or more from the date of last login may be converted to dormant status. Users will be notified via their registered email address at least 30 days prior to dormant conversion.",
        ],
      },
      {
        heading: "Article 16 (Limitation of Liability)",
        body: [
          "The Company is not liable for service interruptions caused by force majeure events including natural disasters or technical failures. The Company is not liable for damages incurred by users in connection with use of the Service, except in cases of intentional misconduct or gross negligence by the Company.",
        ],
      },
      {
        heading: "Article 17 (Governing Law and Jurisdiction)",
        body: [
          "These Terms shall be interpreted in accordance with the laws of the Republic of Korea. Any disputes arising from use of the Service shall be subject to the exclusive jurisdiction of the court having jurisdiction over the Company's registered address.",
        ],
      },
      {
        heading: "Supplementary Provision",
        body: ["These Terms of Service shall take effect as of [October 26, 2026]."],
      },
    ],
    closing: "HanGyul Team",
  },

  /** TRM-003 (784:49783). */
  "purchase-privacy": {
    title: "Privacy Policy",
    sections: [
      {
        heading: "1. Personal Information Collected",
        body: [
          "HanGyul collects the following minimum information necessary to provide our services.",
          "Upon registration: Name (nickname), email address, password, service usage records.",
          "During learning services: Learning records (progress rate, incorrect answers, quiz scores), voice data for pronunciation practice (collected temporarily and deleted immediately after use).",
          "Upon payment: Payment method information (card issuer, partial card number), payment history, transaction records.",
          "Automatically collected: Service usage logs, access logs, cookies, device information (OS, IP address), etc.",
        ],
      },
      {
        heading: "2. Purpose of Collection and Use",
        body: [
          "Collected personal information is used solely for the following purposes.",
          "Service provision: Delivering learning content, managing progress, providing personalized learning recommendations.",
          "Member management: Identity verification, enforcement of Terms of Service violations, delivery of notices.",
          "Payment and refund processing: Subscription billing, refunds, and payment error resolution.",
          "Service improvement: Analyzing usage patterns to improve features and develop new services.",
          "Customer support: Handling inquiries and complaints.",
          "AI Service Improvement: To provide and improve AI-based features such as pronunciation feedback and AI Q&A, users' voice and learning data may be used after anonymization. Users consent to this use upon signing up and may withdraw consent at any time by contacting support@talkhangyul.com.",
        ],
      },
      {
        heading: "3. Retention and Use Period",
        body: [
          "Personal information is deleted without delay upon membership withdrawal or upon fulfillment of the collection purpose.",
          "However, the following records are retained as required by applicable law.",
          "Records related to contracts or withdrawal of offers: Retained for 5 years. Records related to consumer complaints or disputes: Retained for 3 years. Payment and transaction records: Retained for 5 years.",
        ],
      },
      {
        heading: "4. Sharing with Third Parties",
        body: [
          "We do not share personal information with third parties in principle. However, the following minimum information is shared for payment processing purposes.",
          "Recipient: Toss Payments Co., Ltd. and other payment providers selected by the user. Purpose: Payment processing and transaction management. Items shared: Payment method information, payment amount, transaction records. Retention period: 5 years after payment completion (as required by applicable law).",
        ],
      },
      {
        heading: "5. Disposal of Personal Information",
        body: [
          "Personal information is transferred to a separate database after its purpose is fulfilled, retained for the legally required period, and then securely deleted.",
          "Electronic files: Permanently deleted using technical methods that prevent recovery or restoration. Physical documents: Shredded or incinerated.",
        ],
      },
      {
        heading: "6. Protection of Children's Personal Information",
        body: [
          "Han Gyul app takes special care to protect the personal information of users under the age of 14. Users under the age of 14 are advised to use the service with the consent of a parent or legal guardian. Parents or guardians may request access, correction, or deletion of a child's personal information by contacting support@talkhangyul.com.",
        ],
      },
      {
        heading: "7. Rights of Users and Legal Representatives",
        body: [
          "Users may exercise the following rights regarding their personal information at any time: right to access, correct, or delete personal information; right to request suspension of processing; right to withdraw membership. These rights can be exercised through the in-app Channel Talk chat or by emailing support@talkhangyul.com. Identity verification may be required upon request.",
        ],
      },
      {
        heading: "8. Privacy Protection for EU Users (GDPR)",
        body: [
          "GDPR applies to users in the European Economic Area (EEA). The company processes personal data based on consent, contract performance, and legitimate interests. EEA users may exercise the rights of access, rectification, erasure, restriction of processing, data portability, and objection. For inquiries, please contact support@talkhangyul.com. Personal data is stored on servers located in the Republic of Korea and, when transferred outside the EEA, appropriate safeguards as required by GDPR will be applied.",
        ],
      },
      {
        heading: "9. Privacy Officer",
        body: [
          // The frame romanises 유재희 as "Yoo Jaehee"; the business-info card
          // (TRM-001) spells the same person "Jaehee Lew", which wins here too
          // so the English pages name the same person the same way.
          "Privacy Officer: Jaehee Lew Contact: support@talkhangyul.com or in-app chat support via Channel Talk",
        ],
      },
    ],
  },

  /** TRM-004 (925:19205). */
  refund: {
    title: "Cancellation & Refund Policy",
    sections: [
      {
        heading: "1. General Principles",
        body: [
          "This refund policy is operated in accordance with the Act on Consumer Protection in Electronic Commerce. Consumer rights prescribed by law take precedence over this policy. Refunds are processed only to the original payment method and cannot be issued via alternative means.",
        ],
      },
      {
        heading: "2. Subscription Cancellation",
        body: [
          "Subscriptions may be cancelled at any time. Cancellation must be requested before the next billing date. Following cancellation, the service remains accessible until the end of the current subscription period, after which automatic billing will cease. Cancellation is distinct from a refund and does not entitle the user to a return of any amount already charged.",
        ],
      },
      {
        heading: "3. 7-Day Free Trial",
        body: [
          "A 7-day free trial of all Premium Plan features is available before your subscription begins. A credit card is required to start the free trial. On the day the trial ends, automatic billing for the selected plan will occur. No charge will be made if cancelled within the trial period.",
        ],
      },
      {
        heading: "4. Monthly Subscription Refunds",
        body: [
          "A full refund is available if requested within 7 days of the billing date with no usage. No refund is available after 7 days. The service remains accessible until the next billing date.",
        ],
      },
      {
        heading: "5. Annual Subscription Refunds",
        body: [
          "A full refund is available if requested within 7 days of the billing date with no usage. For any other refund request made within 30 days of the billing date, one month at the monthly standard price is deducted and the remaining balance is refunded. The deduction is applied in the currency of the original payment.",
          { bullets: ["Deduction amount: ₩22,000 for KRW payments, $12.99 for USD payments"] },
          // The frame indents the second example with a stray leading space.
          "Example: If a refund is requested on day 20 after paying ₩144,000 for an annual subscription, ₩22,000 is deducted and ₩122,000 is refunded.",
          "Example: If a refund is requested on day 20 after paying $95.88 for an annual subscription, $12.99 is deducted and $82.89 is refunded.",
          "No refund is available more than 30 days after the billing date. The service remains accessible until the end of the subscription period.",
        ],
      },
      {
        heading: "6. Non-Refundable Cases",
        body: [
          {
            bullets: [
              "Refund requests due to a change of mind made more than 7 days after the monthly subscription billing date",
              "Refund requests made more than 30 days after the annual subscription billing date",
              "Cases where service access has been restricted due to violations of the Terms of Service, including account sharing or abuse",
              "Automatic billing that occurred after the 7-day free trial ended due to failure to cancel within the trial period",
            ],
          },
        ],
      },
      {
        heading: "7. Payment Errors and Duplicate Charges",
        body: [
          "If a payment error or duplicate charge occurs, please submit a request via in-app Channel Talk chat support. Upon verification, a full refund will be processed. Payment errors are handled regardless of the standard refund period restrictions.",
        ],
      },
      {
        heading: "8. How to Request a Refund",
        body: [
          "No in-app refund button is provided. To request a refund, please contact us through in-app Channel Talk chat support.",
          "Channel Talk Support Hours AI support: Available 24 hours Live agent support: Weekdays 09:00 – 18:00 (KST)",
          // The frame runs these together as "…of receipt.Refunds are…"; the
          // missing space after the sentence break is a slip and is restored.
          "Requests are processed within 3–5 business days of receipt. Refunds are returned to the original payment method within 3–10 business days.",
          "Credit/debit card: Refunded via card issuer. Simple payment methods (Toss Pay, etc.): Refunded via the respective payment provider.",
        ],
      },
      {
        heading: "9. Policy Updates",
        body: ["Any changes to this policy will be announced in advance through the in-app notice board."],
      },
    ],
  },
};

export const POLICIES: Record<AppLanguage, Record<PolicyId, PolicyDoc>> = { ko: KO, en: EN };

/** Narrows a raw route param to a known document id. */
export function isPolicyId(value: string | undefined): value is PolicyId {
  return value !== undefined && value in KO;
}

/** The document to render for the app's current language. */
export function policyDoc(language: AppLanguage, id: PolicyId): PolicyDoc {
  return POLICIES[language][id];
}
