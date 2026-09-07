import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { I18nProvider } from "../../i18n";
import { ToastProvider } from "../../hooks/toast";

vi.mock("../../api/endpoints", () => ({
  supportApi: { channelTalkIdentity: vi.fn() },
}));
vi.mock("../../lib/customerSupport", () => ({
  openCustomerSupportChat: vi.fn(() => true),
}));

let mockMe: { user_id: string; name?: string; nickname?: string } | null = null;
vi.mock("../../hooks/auth", () => ({ useAuth: () => ({ me: mockMe }) }));

import { supportApi } from "../../api/endpoints";
import { openCustomerSupportChat } from "../../lib/customerSupport";
import { SupportChatButton } from "./SupportChatButton";

const identity = supportApi.channelTalkIdentity as unknown as ReturnType<typeof vi.fn>;
const openChat = openCustomerSupportChat as unknown as ReturnType<typeof vi.fn>;

function wrap(node: ReactNode) {
  // No retry override here: the component owns its own retry policy, and the
  // tests assert on it.
  const qc = new QueryClient();
  return render(
    <I18nProvider language="ko">
      <QueryClientProvider client={qc}>
        <ToastProvider>{node}</ToastProvider>
      </QueryClientProvider>
    </I18nProvider>,
  );
}

/** The `memberHash` the component handed to the ChannelTalk wrapper. */
function lastHash(): string | null | undefined {
  const calls = openChat.mock.calls;
  return calls[calls.length - 1]?.[0]?.memberHash;
}

/** A promise plus its resolve/reject handles, for controlling request timing. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.clearAllMocks();
  openChat.mockReturnValue(true);
  mockMe = { user_id: "usr_a", name: "규현", nickname: "규현" };
});

describe("SupportChatButton identity", () => {
  it("identifies the member with the prefetched hash", async () => {
    identity.mockResolvedValue({ member_hash: "hash_a" });
    wrap(<SupportChatButton />);
    await waitFor(() => expect(identity).toHaveBeenCalled());

    await userEvent.click(screen.getByRole("button"));

    expect(openChat).toHaveBeenCalledTimes(1);
    expect(openChat.mock.calls[0][0]).toMatchObject({ id: "usr_a", memberHash: "hash_a" });
  });

  it("waits for an in-flight prefetch instead of opening unverified", async () => {
    // Tapping the instant the FAQ screen mounts, before the hash has landed.
    const pending = deferred<{ member_hash: string }>();
    identity.mockReturnValue(pending.promise);
    wrap(<SupportChatButton />);

    const click = userEvent.click(screen.getByRole("button"));
    expect(openChat).not.toHaveBeenCalled();

    pending.resolve({ member_hash: "hash_a" });
    await click;

    await waitFor(() => expect(openChat).toHaveBeenCalledTimes(1));
    expect(lastHash()).toBe("hash_a");
    // The tap joined the in-flight request rather than starting a second one.
    expect(identity).toHaveBeenCalledTimes(1);
  });

  it("retries a failed prefetch on tap rather than staying unverified until reload", async () => {
    // Prefetch fails outright (both the initial attempt and its one retry).
    identity.mockRejectedValueOnce(new Error("boom")).mockRejectedValueOnce(new Error("boom"));
    wrap(<SupportChatButton />);
    // One automatic retry, whose backoff outlasts waitFor's default timeout.
    await waitFor(() => expect(identity).toHaveBeenCalledTimes(2), { timeout: 3000 });

    // The network recovers; the tap re-resolves the identity on demand.
    identity.mockResolvedValue({ member_hash: "hash_a" });
    await userEvent.click(screen.getByRole("button"));

    await waitFor(() => expect(openChat).toHaveBeenCalledTimes(1));
    expect(lastHash()).toBe("hash_a");
  });

  it("stays verified on a later tap once the hash has been resolved", async () => {
    identity.mockRejectedValueOnce(new Error("boom")).mockRejectedValueOnce(new Error("boom"));
    wrap(<SupportChatButton />);
    await waitFor(() => expect(identity).toHaveBeenCalledTimes(2), { timeout: 3000 });

    identity.mockResolvedValue({ member_hash: "hash_a" });
    await userEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(lastHash()).toBe("hash_a"));

    const callsAfterRecovery = identity.mock.calls.length;
    await userEvent.click(screen.getByRole("button"));

    await waitFor(() => expect(openChat).toHaveBeenCalledTimes(2));
    expect(lastHash()).toBe("hash_a");
    // The cached hash is reused — no second round trip.
    expect(identity).toHaveBeenCalledTimes(callsAfterRecovery);
  });

  it("still opens support unverified when identity signing is unavailable", async () => {
    identity.mockRejectedValue(new Error("boom"));
    wrap(<SupportChatButton />);
    await waitFor(() => expect(identity).toHaveBeenCalled());

    await userEvent.click(screen.getByRole("button"));

    await waitFor(() => expect(openChat).toHaveBeenCalledTimes(1));
    expect(lastHash()).toBeNull();
    expect(openChat.mock.calls[0][0]).toMatchObject({ id: "usr_a" });
  });

  it("passes a null hash through when no verification secret is configured", async () => {
    identity.mockResolvedValue({ member_hash: null });
    wrap(<SupportChatButton />);
    await waitFor(() => expect(identity).toHaveBeenCalledTimes(1));

    await userEvent.click(screen.getByRole("button"));

    await waitFor(() => expect(openChat).toHaveBeenCalledTimes(1));
    expect(lastHash()).toBeNull();
    // A legitimately null hash is cached, not re-requested on every tap.
    expect(identity).toHaveBeenCalledTimes(1);
  });

  it("never signs a second account in with the first account's hash", async () => {
    identity.mockResolvedValue({ member_hash: "hash_a" });
    const view = wrap(<SupportChatButton />);
    await waitFor(() => expect(identity).toHaveBeenCalledTimes(1));

    // Same tab, different member: the cache is keyed by user id, so the hash
    // that signs usr_a must not be replayed for usr_b.
    mockMe = { user_id: "usr_b", name: "민지", nickname: "민지" };
    identity.mockResolvedValue({ member_hash: "hash_b" });
    view.rerender(
      <I18nProvider language="ko">
        <QueryClientProvider client={new QueryClient()}>
          <ToastProvider>
            <SupportChatButton />
          </ToastProvider>
        </QueryClientProvider>
      </I18nProvider>,
    );
    await waitFor(() => expect(identity).toHaveBeenCalledTimes(2));

    await userEvent.click(screen.getByRole("button"));

    await waitFor(() => expect(openChat).toHaveBeenCalledTimes(1));
    expect(openChat.mock.calls[0][0]).toMatchObject({ id: "usr_b", memberHash: "hash_b" });
  });

  it("opens anonymously and never requests an identity when logged out", async () => {
    mockMe = null;
    wrap(<SupportChatButton />);

    await userEvent.click(screen.getByRole("button"));

    expect(identity).not.toHaveBeenCalled();
    expect(openChat).toHaveBeenCalledWith(null);
  });

  it("surfaces a retryable error when no support channel is reachable", async () => {
    identity.mockResolvedValue({ member_hash: "hash_a" });
    openChat.mockReturnValue(false);
    wrap(<SupportChatButton />);
    await waitFor(() => expect(identity).toHaveBeenCalled());

    await userEvent.click(screen.getByRole("button"));

    expect(await screen.findByText(/잠시 후 다시 시도/)).toBeTruthy();
  });
});
