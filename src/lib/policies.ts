/**
 * In-app legal documents shown from the sign-up agreements and reachable at
 * /policy/:doc. This is original, plain-language summary copy written for the
 * Hangyul app — replace each section with your finalized legal text before
 * production launch.
 */
export type PolicyId = "terms" | "privacy" | "third-party";

export interface PolicyDoc {
  title: string;
  updated: string;
  intro?: string;
  sections: { heading: string; body: string[] }[];
}

export const POLICIES: Record<PolicyId, PolicyDoc> = {
  terms: {
    title: "회원이용약관",
    updated: "2026-07-01",
    intro: "본 약관은 한글(Hangyul) 서비스의 이용과 관련하여 회사와 회원 간의 권리·의무 및 책임사항을 규정합니다.",
    sections: [
      {
        heading: "제1조 (목적)",
        body: [
          "본 약관은 회사가 제공하는 한국어 학습 서비스(이하 “서비스”)의 이용조건과 절차, 회사와 회원의 권리·의무를 정함을 목적으로 합니다.",
        ],
      },
      {
        heading: "제2조 (회원가입)",
        body: [
          "회원가입은 이용자가 약관에 동의하고 회사가 정한 절차에 따라 가입을 신청하면 회사가 이를 승낙함으로써 성립합니다.",
          "회원은 가입 시 정확한 정보를 제공해야 하며, 타인의 정보를 도용해서는 안 됩니다.",
        ],
      },
      {
        heading: "제3조 (서비스의 제공 및 변경)",
        body: [
          "회사는 회원에게 학습 콘텐츠, 진도 관리, 인증 및 부가 기능 등을 제공합니다.",
          "회사는 운영상·기술상 필요에 따라 제공하는 서비스의 내용을 변경할 수 있으며, 중요한 변경은 사전에 공지합니다.",
        ],
      },
      {
        heading: "제4조 (회원의 의무)",
        body: [
          "회원은 관계 법령과 본 약관을 준수해야 하며, 서비스의 정상적인 운영을 방해하는 행위를 해서는 안 됩니다.",
          "회원은 자신의 계정 및 비밀번호를 안전하게 관리할 책임이 있습니다.",
        ],
      },
      {
        heading: "제5조 (계약 해지)",
        body: [
          "회원은 언제든지 서비스 내 설정을 통해 이용계약을 해지(회원 탈퇴)할 수 있습니다.",
          "회원이 약관을 위반한 경우 회사는 사전 통지 후 이용을 제한하거나 계약을 해지할 수 있습니다.",
        ],
      },
    ],
  },
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
};
