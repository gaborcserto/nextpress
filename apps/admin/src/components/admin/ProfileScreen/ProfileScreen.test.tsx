import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ProfileScreen from "./ProfileScreen";

const { useSessionMock } = vi.hoisted(() => ({
  useSessionMock: vi.fn(),
}));

vi.mock("@/lib/auth/auth-client", () => ({
  useSession: useSessionMock,
}));

describe("ProfileScreen", () => {
  beforeEach(() => {
    useSessionMock.mockReturnValue({
      data: {
        user: {
          name: "Ada Lovelace",
          email: "ada@example.com",
          image: null,
        },
      },
      isPending: false,
    });
  });

  it("shows session details without unfinished mutation controls", () => {
    render(<ProfileScreen />);

    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Profile editing and account management are not available",
    );
    expect(screen.queryByRole("button", { name: /save/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /delete account/i }),
    ).not.toBeInTheDocument();
  });
});
