import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { Policy, PolicyList } from "./Policy";
import { I18nProvider } from "../i18n";
import { POLICIES, type PolicyId } from "../lib/policies";
import type { AppLanguage } from "../lib/language";

function tree(language: AppLanguage, initial: string) {
  return (
    <I18nProvider language={language}>
      <MemoryRouter initialEntries={["/profile", initial]} initialIndex={1}>
        <Routes>
          <Route path="/profile" element={<div>MORE</div>} />
          <Route path="/policy" element={<PolicyList />} />
          <Route path="/policy/:doc" element={<Policy />} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>
  );
}

function renderFlow(initial = "/policy", language: AppLanguage = "ko") {
  return render(tree(language, initial));
}

/** Any Hangul syllable — the marker for Korean copy leaking into English. */
const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힣]/;

describe("Terms & Policies list (TRM-001)", () => {
  it("uses a Hangul detector that actually detects Hangul", () => {
    // Guards the `not.toMatch(HANGUL)` assertions below from passing vacuously.
    expect("이용약관").toMatch(HANGUL);
    expect("한귤 운영팀 드림").toMatch(HANGUL);
    expect("Terms of Service — HanGyul Team").not.toMatch(HANGUL);
  });

  it("lists exactly three legal items and the business-info footer in Korean", () => {
    renderFlow();
    expect(screen.getByRole("heading", { name: "약관 및 정책" })).toBeInTheDocument();
    ["이용약관", "개인정보처리 방침", "구독 해지 및 환불 정책"].forEach((label) =>
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument(),
    );
    const footer = screen.getByRole("region", { name: "사업자 정보" });
    expect(
      Array.from(footer.querySelectorAll(".pol__biz-line"), (line) => line.textContent),
    ).toEqual([
      "대표이사: 유재희",
      "사업부문: 남우준",
      "이메일: support@talkhangyul.com",
      "사업자등록번호: 403-87-03380",
      "통신판매업 신고번호: 제2026-서울도봉-0542호",
      "Copyright © 2025 HanGyul. All Rights Reserved.",
    ]);
  });

  it("lists the same three items in English", () => {
    renderFlow("/policy", "en");
    expect(screen.getByRole("heading", { name: "Terms & Policy" })).toBeInTheDocument();
    ["Terms of Service", "Privacy Policy", "Cancellation & Refund Policy"].forEach((label) =>
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument(),
    );
    const footer = screen.getByRole("region", { name: "Business Information" });
    expect(
      Array.from(footer.querySelectorAll(".pol__biz-line"), (line) => line.textContent),
    ).toEqual([
      "CEO: Jaehee Lew",
      "Business Division: Woojun Nam",
      "Email: support@talkhangyul.com",
      "Business Registration No.: 403-87-03380",
      "E-Commerce Permit No.: 2026-Seoul Dobong-0542",
      "Copyright © 2025 HanGyul. All Rights Reserved.",
    ]);
  });
});

describe("Terms of Service detail (TRM-002)", () => {
  it("renders the Korean frame's 17 articles, supplementary provision and sign-off", async () => {
    renderFlow();
    await userEvent.click(screen.getByRole("button", { name: "이용약관" }));
    expect(await screen.findByRole("heading", { name: "이용약관" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "제1조 (목적)" })).toBeInTheDocument();
    // The document previously stopped at 제16조; the frame carries 17 articles.
    expect(screen.getByRole("heading", { name: "제17조 (준거법 및 관할)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "부칙" })).toBeInTheDocument();
    expect(screen.getByText("한귤 운영팀 드림")).toBeInTheDocument();
    // 제2조 is a bullet list in the frame, not running prose.
    expect(screen.getByText(/"계정"이란 이용자가 서비스 이용을 위해/)).toBeInTheDocument();
    // The country of the phone number is fixed at sign-up (제5조, 제7조), and
    // the store-payment clauses are gone from the current frame.
    expect(
      screen.getByText("회원가입 시 등록한 휴대폰 번호의 국가는 변경할 수 없으며, 번호 변경은 동일 국가 내에서만 가능합니다."),
    ).toBeInTheDocument();
    expect(screen.getByText(/등록한 휴대폰 번호의 국가는 가입 이후 변경할 수 없습니다\.$/)).toBeInTheDocument();
    expect(screen.queryByText(/App Store|Google Play|다음 결제일부터 변경된 국가/)).not.toBeInTheDocument();
    expect(screen.getByText("이 약관은 2026년 10월 26일부터 시행합니다.")).toBeInTheDocument();
  });

  it("renders the English frame's copy with no Korean left behind", () => {
    const { container } = renderFlow("/policy/terms-of-use", "en");
    expect(screen.getByRole("heading", { name: "Terms of Service" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Article 1 (Purpose)" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Article 17 (Governing Law and Jurisdiction)" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Supplementary Provision" })).toBeInTheDocument();
    expect(screen.getByText("HanGyul Team")).toBeInTheDocument();
    expect(
      screen.getByText(
        "The country of the mobile phone number registered at sign-up cannot be changed. Phone number changes are only permitted within the same country.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/The country of the registered mobile phone number cannot be changed after sign-up\.$/),
    ).toBeInTheDocument();
    expect(container.textContent ?? "").not.toMatch(/App Store|Google Play|fees based on the new country/);
    expect(
      screen.getByText("These Terms of Service shall take effect as of [October 26, 2026]."),
    ).toBeInTheDocument();
    expect(container.textContent ?? "").not.toMatch(HANGUL);
  });
});

describe("Privacy Policy detail (TRM-003)", () => {
  it("renders the Korean frame's nine numbered sections", () => {
    renderFlow("/policy/purchase-privacy");
    expect(screen.getByRole("heading", { name: "개인정보처리 방침" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "1. 수집하는 개인정보 항목" })).toBeInTheDocument();
    expect(screen.getByText(/회원가입 시: 이름\(닉네임\)/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "8. EU 이용자 개인정보 보호 (GDPR)" })).toBeInTheDocument();
    // The frame's trailing "개인정보" is a duplicated fragment and is dropped.
    expect(screen.getByRole("heading", { name: "9. 개인정보 보호책임자" })).toBeInTheDocument();
  });

  it("links the support address as mailto in both languages", () => {
    for (const language of ["ko", "en"] as const) {
      const view = render(tree(language, "/policy/purchase-privacy"));
      const links = screen.getAllByRole("link", { name: "support@talkhangyul.com" });
      expect(links.length, language).toBeGreaterThanOrEqual(3);
      // The address ends several sentences; the period must stay outside it.
      links.forEach((a) =>
        expect(a.getAttribute("href")).toBe("mailto:support@talkhangyul.com"),
      );
      view.unmount();
    }
  });

  it("renders the English frame's copy with no Korean left behind", () => {
    const { container } = renderFlow("/policy/purchase-privacy", "en");
    expect(screen.getByRole("heading", { name: "Privacy Policy" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "1. Personal Information Collected" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "8. Privacy Protection for EU Users (GDPR)" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "9. Privacy Officer" })).toBeInTheDocument();
    expect(container.textContent ?? "").not.toMatch(HANGUL);
  });
});

describe("Cancellation & Refund Policy detail (TRM-004)", () => {
  it("renders the Korean frame's nine numbered sections", () => {
    renderFlow("/policy/refund");
    expect(screen.getByRole("heading", { name: "구독 해지 및 환불 정책" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "1. 기본 원칙" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "3. 7일 무료 체험" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "9. 정책 변경 안내" })).toBeInTheDocument();
    // The frame states the refund rules as prose; it has no comparison tables.
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("deducts one regular month in the currency paid from an annual refund", () => {
    renderFlow("/policy/refund");
    expect(screen.getByText("공제 금액: 원화 결제 시 22,000원, 달러 결제 시 $12.99")).toBeInTheDocument();
    expect(screen.getByText(/144,000원\) 결제 후 20일째.*122,000원이 환불됩니다/)).toBeInTheDocument();
    // The frame starts this example with a stray space; it is not carried over.
    expect(
      screen.getByText("예시: 연간 구독($95.88) 결제 후 20일째 환불 요청 시, $12.99를 공제한 $82.89가 환불됩니다."),
    ).toBeInTheDocument();
    // §6 lists the non-refundable cases as bullets, not one run-on paragraph.
    expect(screen.getByText("월간 구독 결제일로부터 7일 초과 후 단순 변심에 의한 환불 요청").tagName).toBe("LI");
  });

  it("follows the current frame: any payment method starts a trial, and an auto-charge is final once used", () => {
    renderFlow("/policy/refund");
    expect(screen.getByText(/무료 체험 시작 시 결제 수단 등록이 필요하며/)).toBeInTheDocument();
    expect(screen.queryByText(/신용카드 등록이 필요/)).not.toBeInTheDocument();
    expect(
      screen.getByText("7일 무료 체험 종료 후 자동 결제되어 서비스를 이용한 건(체험 기간 내 미취소)").tagName,
    ).toBe("LI");
  });

  it("renders the English frame's copy with no Korean left behind", () => {
    const { container } = renderFlow("/policy/refund", "en");
    expect(screen.getByRole("heading", { name: "Cancellation & Refund Policy" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "1. General Principles" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "9. Policy Updates" })).toBeInTheDocument();
    expect(
      screen.getByText("Deduction amount: ₩22,000 for KRW payments, $12.99 for USD payments"),
    ).toBeInTheDocument();
    expect(screen.getByText(/paying \$95\.88 .*\$82\.89 is refunded\./)).toBeInTheDocument();
    // The frame runs "receipt.Refunds" together; the app keeps the space.
    expect(screen.getByText(/of receipt\. Refunds are returned/)).toBeInTheDocument();
    expect(screen.getByText(/A payment method is required to start the free trial\./)).toBeInTheDocument();
    expect(screen.getByText(/where the service has since been used \(not cancelled within the trial period\)/)).toBeInTheDocument();
    expect(container.textContent ?? "").not.toMatch(HANGUL);
  });
});

describe("switching language", () => {
  it("re-renders an open detail page in the newly selected language", () => {
    const { rerender, container } = render(tree("ko", "/policy/terms-of-use"));
    expect(screen.getByRole("heading", { name: "제1조 (목적)" })).toBeInTheDocument();

    rerender(tree("en", "/policy/terms-of-use"));
    expect(screen.getByRole("heading", { name: "Article 1 (Purpose)" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "제1조 (목적)" })).not.toBeInTheDocument();
    expect(container.textContent ?? "").not.toMatch(HANGUL);

    // …and back again, so neither direction is a one-way door.
    rerender(tree("ko", "/policy/terms-of-use"));
    expect(screen.getByRole("heading", { name: "제1조 (목적)" })).toBeInTheDocument();
  });
});

describe("catalog shape", () => {
  const ids = Object.keys(POLICIES.ko) as PolicyId[];

  it("defines every document in both languages", () => {
    expect(Object.keys(POLICIES.en).sort()).toEqual(ids.slice().sort());
  });

  it.each(["ko", "en"] as const)("has no empty section in %s", (language) => {
    for (const id of ids) {
      for (const section of POLICIES[language][id].sections) {
        expect(section.heading.length).toBeGreaterThan(0);
        expect(section.body.length).toBeGreaterThan(0);
      }
    }
  });

  it("keeps the two languages structurally parallel", () => {
    for (const id of ids) {
      const ko = POLICIES.ko[id];
      const en = POLICIES.en[id];
      // Same section count and the same paragraph/bullet shape per section, so
      // one language cannot silently lose a clause the other still states.
      expect(en.sections.length, id).toBe(ko.sections.length);
      expect(Boolean(en.closing), id).toBe(Boolean(ko.closing));
      ko.sections.forEach((section, i) => {
        const kinds = (doc: typeof section) =>
          doc.body.map((b) => (typeof b === "string" ? "p" : "ul")).join("");
        // Bullet lists are part of the design, so a list must stay a list.
        expect(kinds(en.sections[i]).replace(/p+/g, "p"), `${id} §${i + 1}`).toBe(
          kinds(section).replace(/p+/g, "p"),
        );
      });
    }
  });

  it("romanises the privacy officer the same way the business card does", () => {
    // 유재희 appears as the CEO on TRM-001 and as the privacy officer in
    // TRM-003; the frames spell the two differently. One spelling wins.
    const text = POLICIES.en["purchase-privacy"].sections
      .flatMap((s) => s.body.flatMap((b) => (typeof b === "string" ? [b] : b.bullets)))
      .join(" ");
    expect(text).toContain("Jaehee Lew");
    expect(text).not.toMatch(/Yoo/);
  });

  it("carries no Korean in the English catalog", () => {
    for (const id of ids) {
      const doc = POLICIES.en[id];
      const text = [
        doc.title,
        doc.intro ?? "",
        doc.closing ?? "",
        ...doc.sections.flatMap((s) => [
          s.heading,
          ...s.body.flatMap((b) => (typeof b === "string" ? [b] : b.bullets)),
        ]),
      ].join(" ");
      expect(text, id).not.toMatch(HANGUL);
    }
  });
});
