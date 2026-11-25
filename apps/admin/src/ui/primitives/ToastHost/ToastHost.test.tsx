import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { showToast } from "@/ui/utils";

import { ToastHost } from "./ToastHost";

describe("ToastHost", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("announces a neutral success toast and dismisses it after four seconds", () => {
    vi.useFakeTimers();
    render(<ToastHost />);

    act(() =>
      showToast("Saved", "success", { desc: "Your changes are ready." }),
    );

    expect(screen.getByRole("status")).toHaveTextContent("Saved");
    expect(
      screen.getByText("Saved").closest("[data-stack-mode]"),
    ).toHaveAttribute("data-placement", "top-center");
    expect(screen.getByText("Your changes are ready.")).toBeVisible();

    act(() => vi.advanceTimersByTime(4000));
    expect(screen.getByRole("status").parentElement).toHaveStyle({
      opacity: "0",
    });
  });

  it("keeps loading notifications until dismissed and suppresses duplicate active messages", () => {
    render(<ToastHost />);

    act(() => {
      showToast("Uploading", "loading");
      showToast("Uploading", "loading");
    });

    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: "Dismiss notification" }),
    ).toBeVisible();
  });

  it("announces errors assertively", () => {
    render(<ToastHost />);

    act(() => showToast("Could not save", "error"));

    expect(screen.getByRole("alert")).toHaveAttribute("aria-live", "assertive");
  });

  it.each(["success", "error", "warning", "info", "attention"] as const)(
    "renders the decorative %s status icon",
    (type) => {
      render(<ToastHost />);

      act(() => showToast(`${type} notice`, type));

      const icon = screen
        .getByText(`${type} notice`)
        .closest("[role='status'], [role='alert']")
        ?.querySelector("[aria-hidden='true']");
      expect(icon).toHaveAttribute("aria-hidden", "true");
      expect(icon?.querySelector("svg")).toBeInTheDocument();
    },
  );

  it("uses configured placement and expands the collapsed stack on interaction", () => {
    render(
      <ToastHost placement="top-center" maxVisible={3} stackMode="collapsed" />,
    );

    act(() => {
      showToast("First", "info");
      showToast("Second", "info");
    });

    const viewport = screen.getByText("Second").closest("[data-stack-mode]");
    expect(viewport).toHaveAttribute("data-placement", "top-center");
    expect(viewport).toHaveAttribute("data-expanded", "false");
    expect(screen.getAllByRole("status")).toHaveLength(2);

    if (!viewport) {
      throw new Error("Expected the configured toast viewport to render.");
    }

    act(() => fireEvent.pointerEnter(viewport));
    expect(viewport).toHaveAttribute("data-expanded", "true");
  });
});
