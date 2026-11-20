import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { BlogNavigation } from "./BlogNavigation";
import { NavigationLink } from "./NavigationLink";

const route = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));

let desktop = false;
let reducedMotion = false;
let mediaChanges: EventTarget;
let animationFrameId = 0;
let animationFrames = new Map<number, FrameRequestCallback>();

const originalAnimate = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "animate",
);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete window.__nextpressBlogNavigationIndicator;

  if (originalAnimate) {
    Object.defineProperty(HTMLElement.prototype, "animate", originalAnimate);
  } else {
    delete (HTMLElement.prototype as Partial<HTMLElement>).animate;
  }
});

beforeEach(() => {
  desktop = false;
  reducedMotion = false;
  route.pathname = "/";
  mediaChanges = new EventTarget();
  animationFrameId = 0;
  animationFrames = new Map();
  delete window.__nextpressBlogNavigationIndicator;
  Object.defineProperty(HTMLElement.prototype, "animate", {
    configurable: true,
    value: vi.fn(() => ({ cancel: vi.fn() }) as unknown as Animation),
  });
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    const id = ++animationFrameId;
    animationFrames.set(id, callback);

    return id;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
    animationFrames.delete(id);
  });
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    get matches() {
      return query === "(min-width: 56rem)" ? desktop : reducedMotion;
    },
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: mediaChanges.dispatchEvent.bind(mediaChanges),
    addEventListener: mediaChanges.addEventListener.bind(mediaChanges),
    removeEventListener: mediaChanges.removeEventListener.bind(mediaChanges),
  }));
});

function flushAnimationFrame() {
  const callbacks = [...animationFrames.values()];
  animationFrames.clear();
  act(() => callbacks.forEach((callback) => callback(0)));
}

function flushAnimationFrames() {
  flushAnimationFrame();
  flushAnimationFrame();
}

function Navigation() {
  return (
    <BlogNavigation>
      <NavigationLink href="/">Home</NavigationLink>
      <NavigationLink href="/en/posts">Posts</NavigationLink>
    </BlogNavigation>
  );
}

it("starts collapsed on mobile and controls the named navigation", () => {
  render(<Navigation />);
  const toggle = screen.getByRole("button", { name: "Open navigation" });
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByRole("link", { name: "Posts" })).not.toBeInTheDocument();
  expect(
    document.getElementById(toggle.getAttribute("aria-controls") ?? ""),
  ).toHaveAttribute("inert");
  fireEvent.click(toggle);
  expect(toggle).toHaveAccessibleName("Close navigation");
  expect(toggle).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByRole("navigation", { name: "Primary" })).toBeVisible();
  expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

it("closes with Escape and returns focus to the toggle", () => {
  render(<Navigation />);
  fireEvent.click(screen.getByRole("button"));
  const posts = screen.getByRole("link", { name: "Posts" });
  posts.focus();
  fireEvent.keyDown(posts, { key: "Escape" });
  expect(screen.getByRole("button", { name: "Open navigation" })).toHaveFocus();
  expect(screen.queryByRole("link", { name: "Posts" })).not.toBeInTheDocument();
});

it("closes on link activation and route/history changes", () => {
  const { rerender } = render(<Navigation />);
  fireEvent.click(screen.getByRole("button"));
  fireEvent.click(screen.getByRole("link", { name: "Home" }));
  expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(screen.getByRole("button"));
  route.pathname = "/posts";
  rerender(<Navigation />);
  expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "false");
});

it("exposes desktop links and resets the mobile disclosure across the breakpoint", () => {
  render(<Navigation />);
  const toggle = screen.getByRole("button");
  fireEvent.click(toggle);
  toggle.focus();
  act(() => {
    desktop = true;
    mediaChanges.dispatchEvent(new Event("change"));
  });
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Home" })).toHaveFocus();
  act(() => {
    desktop = false;
    mediaChanges.dispatchEvent(new Event("change"));
  });
  expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "false");
  expect(screen.getByRole("button")).toHaveFocus();
  expect(screen.queryByRole("link", { name: "Posts" })).not.toBeInTheDocument();
});

it("retains the same navigation and indicator through forward and backward route updates", () => {
  desktop = true;
  const { rerender } = render(<Navigation />);
  const navigation = screen.getByRole("navigation", { name: "Primary" });
  const indicator = navigation.querySelector("span[aria-hidden]");

  for (const pathname of ["/posts", "/", "/posts/story", "/"]) {
    route.pathname = pathname;
    rerender(<Navigation />);
    expect(screen.getByRole("navigation", { name: "Primary" })).toBe(
      navigation,
    );
    expect(navigation.querySelector("span[aria-hidden]")).toBe(indicator);
    expect(
      screen.getByRole("link", { name: pathname === "/" ? "Home" : "Posts" }),
    ).toHaveAttribute("aria-current", "page");
    expect(navigation.querySelectorAll('[aria-current="page"]')).toHaveLength(
      1,
    );
  }
});

it("keeps the desktop indicator measured against the actual active link", () => {
  desktop = true;
  const bounds = vi
    .spyOn(HTMLElement.prototype, "getBoundingClientRect")
    .mockImplementation(function (this: HTMLElement) {
      const left =
        this.tagName === "NAV" ? 100 : this.textContent === "Posts" ? 180 : 110;

      return DOMRect.fromRect({
        x: left,
        y: 20,
        width: this.textContent === "Posts" ? 48 : 40,
        height: 44,
      });
    });

  try {
    const { rerender } = render(<Navigation />);
    const line = screen
      .getByRole("navigation")
      .querySelector("span[aria-hidden]");
    expect(line).toHaveStyle({
      width: "40px",
      transform: "translate(10px, 44px)",
    });
    route.pathname = "/posts";
    rerender(<Navigation />);
    expect(line).toHaveStyle({
      width: "48px",
      transform: "translate(80px, 44px)",
    });
  } finally {
    bounds.mockRestore();
  }
});

it("slides from its previous measured position through navigation and history", () => {
  desktop = true;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      const left =
        this.tagName === "NAV" ? 100 : this.textContent === "Posts" ? 180 : 110;

      return DOMRect.fromRect({
        x: left,
        y: 20,
        width: this.textContent === "Posts" ? 48 : 40,
        height: 44,
      });
    },
  );
  const { rerender } = render(<Navigation />);
  const navigation = screen.getByRole("navigation", { name: "Primary" });
  const line = navigation.querySelector("span[aria-hidden]");
  const animate = vi.fn(() => ({ cancel: vi.fn() }) as unknown as Animation);
  Object.defineProperty(line, "animate", {
    configurable: true,
    value: animate,
  });

  flushAnimationFrames();
  fireEvent.click(screen.getByRole("link", { name: "Posts" }));
  route.pathname = "/posts";
  rerender(<Navigation />);
  expect(line).toHaveStyle({
    width: "48px",
    transform: "translate(80px, 44px)",
  });
  expect(animate).toHaveBeenCalledWith(
    [
      { width: "40px", transform: "translate(10px, 44px)" },
      { width: "48px", transform: "translate(80px, 44px)" },
    ],
    { duration: 200, easing: "ease" },
  );

  window.dispatchEvent(new PopStateEvent("popstate"));
  route.pathname = "/";
  rerender(<Navigation />);
  expect(line).toHaveStyle({
    width: "40px",
    transform: "translate(10px, 44px)",
  });
  expect(animate).toHaveBeenCalledTimes(2);
});

it("updates immediately when reduced motion is requested", () => {
  desktop = true;
  reducedMotion = true;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      const left =
        this.tagName === "NAV" ? 100 : this.textContent === "Posts" ? 180 : 110;

      return DOMRect.fromRect({
        x: left,
        y: 20,
        width: this.textContent === "Posts" ? 48 : 40,
        height: 44,
      });
    },
  );
  const { rerender } = render(<Navigation />);
  const line = screen
    .getByRole("navigation")
    .querySelector("span[aria-hidden]");

  fireEvent.click(screen.getByRole("link", { name: "Posts" }));
  route.pathname = "/posts";
  rerender(<Navigation />);

  expect(line).toHaveStyle({
    width: "48px",
    transform: "translate(80px, 44px)",
  });
});
