import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// --- Mocks (must be declared before importing the component) ---
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: null, loading: false, signInWithGoogle: vi.fn(), logout: vi.fn() }),
  AuthProvider: ({ children }: any) => children,
}));

vi.mock("@/services/chats", () => ({
  createChat: vi.fn(),
  deleteChat: vi.fn(),
  updateChat: vi.fn(),
  subscribeUserChats: vi.fn(() => () => {}),
}));

vi.mock("@/lib/extractFile", () => ({
  extractPdfText: vi.fn(),
  fileToDataUrl: vi.fn(),
  readTextFile: vi.fn(),
}));

vi.mock("@/components/HeroScene", () => ({
  HeroScene: () => null,
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
  Toaster: () => null,
}));

import Index from "./Index";

// jsdom doesn't implement scrollTo on elements
beforeEach(() => {
  Element.prototype.scrollTo = vi.fn() as any;
  // @ts-ignore
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function makeSseStream(chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) {
        const payload = JSON.stringify({ choices: [{ delta: { content: c } }] });
        controller.enqueue(enc.encode(`data: ${payload}\n\n`));
      }
      controller.enqueue(enc.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
}

describe("Chat e2e (guest mode)", () => {
  it("sends a message, streams the response, and persists the conversation across remount", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: makeSseStream(["Hello", " ", "world!"]),
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    const { unmount } = render(<Index />);

    const textarea = await screen.findByPlaceholderText(/Paste a JD/i);
    await user.type(textarea, "What skills for a frontend role?");

    const sendBtn = screen
      .getAllByRole("button")
      .find((b) => b.querySelector("svg.lucide-send"));
    expect(sendBtn).toBeTruthy();
    await user.click(sendBtn!);

    // User bubble appears
    expect(await screen.findByText("What skills for a frontend role?")).toBeInTheDocument();

    // Streamed assistant content renders
    await waitFor(() =>
      expect(screen.getByText(/Hello\s+world!/)).toBeInTheDocument(),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Persistence check: the guest store writes to localStorage; remount and verify.
    await waitFor(() => {
      const raw = localStorage.getItem("jdbot.guest.chats");
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw!);
      expect(parsed.length).toBeGreaterThan(0);
      expect(parsed[0].messages.some((m: any) => m.role === "assistant")).toBe(true);
    });

    // Simulate a "refresh" by unmounting and rendering again.
    unmount();
    render(<Index />);

    // The user message and streamed assistant response should still be visible.
    expect(await screen.findByText("What skills for a frontend role?")).toBeInTheDocument();
    expect(await screen.findByText(/Hello\s+world!/)).toBeInTheDocument();
  });
});
