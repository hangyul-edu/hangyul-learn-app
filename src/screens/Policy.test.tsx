import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { Policy, PolicyList } from "./Policy";

function renderFlow(initial = "/policy") {
  return render(
    <MemoryRouter initialEntries={["/profile", initial]} initialIndex={1}>
      <Routes>
        <Route path="/profile" element={<div>MORE</div>} />
        <Route path="/policy" element={<PolicyList />} />
        <Route path="/policy/:doc" element={<Policy />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Terms & Policies flow", () => {
  it("lists exactly three legal items and the business-info footer", () => {
    renderFlow();
    expect(screen.getByRole("heading", { name: "약관 및 정책" })).toBeInTheDocument();
    ["이용약관", "개인정보처리 방침", "구독 해지 및 환불 정책"].forEach((label) =>
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument(),
    );
    expect(screen.getByText("사업자 정보")).toBeInTheDocument();
    expect(screen.getByText("대표이사: 유재희")).toBeInTheDocument();
    expect(screen.getByText("사업자등록번호: 403-87-03380")).toBeInTheDocument();
    expect(screen.getByText(/Copyright © 2025 HanGyul/)).toBeInTheDocument();
  });

  it("opens the Terms of Use detail with bold numbered sections", async () => {
    renderFlow();
    await userEvent.click(screen.getByRole("button", { name: "이용약관" }));
    expect(await screen.findByRole("heading", { name: "이용약관" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "제1조 (목적)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "제16조 (준거법 및 관할)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "부칙" })).toBeInTheDocument();
  });

  it("renders the privacy detail's sections and bullet list", async () => {
    renderFlow();
    await userEvent.click(screen.getByRole("button", { name: "개인정보처리 방침" }));
    expect(await screen.findByRole("heading", { name: "1. 수집하는 개인정보 항목" })).toBeInTheDocument();
    expect(screen.getByText(/회원가입 시: 이름\(닉네임\)/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "9. 개인정보 보호책임자" })).toBeInTheDocument();
  });

  it("opens the refund policy detail with its sections and refund tables", async () => {
    renderFlow("/policy/refund");
    expect(await screen.findByRole("heading", { name: "구독 해지 및 환불 정책" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "7일 무료 체험" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "월간 구독 환불" })).toBeInTheDocument();
    // Refund tables render with header cells + data rows.
    expect(screen.getAllByRole("columnheader", { name: "결제 후 경과" }).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole("cell", { name: "미사용 개월 수 × 월정액" })).toBeInTheDocument();
  });
});
