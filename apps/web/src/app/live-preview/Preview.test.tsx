import { render, screen, act } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";

import Preview from "./Preview";

const session = "11111111-1111-4111-8111-111111111111";
const origin = "http://localhost:49101";
const message = {
  type: "nextpress:preview",
  session,
  snapshot: {
    title: "Exact old revision",
    slug: "old",
    content: '{"version":1,"blocks":[]}',
    excerpt: null,
    layout: "STANDARD",
    pageDocument: null,
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
  window.location.hash = "";
});

describe("preview boundary", () => {
  it("accepts only the configured host, session and validated snapshot", () => {
    vi.stubGlobal("opener", window);
    window.location.hash = session;
    render(<Preview adminOrigin={origin} />);

    function deliver(
      data: unknown,
      sender = origin,
      source: Window | null = window,
    ) {
      act(() =>
        window.dispatchEvent(
          new MessageEvent("message", { origin: sender, source, data }),
        ),
      );
    }

    deliver(message, "https://attacker.invalid");
    deliver(message, origin, null);
    deliver({ ...message, session: "22222222-2222-4222-8222-222222222222" });
    deliver({ ...message, snapshot: { title: "Invalid" } });
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    deliver(message);
    expect(
      screen.getByRole("heading", { name: "Exact old revision" }),
    ).toBeInTheDocument();
  });
});
