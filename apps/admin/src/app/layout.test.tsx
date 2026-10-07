import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookies, getCookie } = vi.hoisted(() => ({ cookies: vi.fn(), getCookie: vi.fn() }));
vi.mock("next/headers", () => ({ cookies }));
vi.mock("./globals.css", () => ({}));
vi.mock("@/ui/primitives/ToastHost", () => ({ ToastHost: () => null }));

import RootLayout from "./layout";

beforeEach(() => {
  vi.resetAllMocks();
  cookies.mockResolvedValue({ get: getCookie });
});

describe("admin server theme attributes", () => {
  it.each([
    { cookie: undefined, theme: null },
    { cookie: "light", theme: "light" },
    { cookie: "dark", theme: "dark" },
    { cookie: "system", theme: "light" },
    { cookie: "", theme: "light" },
    { cookie: "unknown", theme: "light" },
  ])("renders default skin with cookie $cookie as $theme", async ({ cookie, theme }) => {
    getCookie.mockReturnValue(cookie === undefined ? undefined : { value: cookie });
    const markup = renderToStaticMarkup(await RootLayout({ children: <p>Admin content</p> }));
    const html = new DOMParser().parseFromString(markup, "text/html").documentElement;

    expect(html.getAttribute("data-skin")).toBe("default");
    expect(html.getAttribute("data-theme")).toBe(theme);
    expect(html.hasAttribute("data-color-mode")).toBe(false);
    expect(html.textContent).toContain("Admin content");
    expect(getCookie).toHaveBeenCalledWith("theme");
  });
});
