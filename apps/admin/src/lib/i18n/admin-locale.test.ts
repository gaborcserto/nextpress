import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { setAdminLocale, useAdminLocale } from "./admin-locale";

describe("Admin locale selection", () => {
  it("defaults to English and persists locale changes for the Admin app", () => {
    document.cookie = "admin-locale=en; Path=/; Max-Age=0";
    const { result } = renderHook(() => useAdminLocale());

    expect(result.current).toBe("en");

    act(() => setAdminLocale("hu"));

    expect(result.current).toBe("hu");
    expect(document.cookie).toContain("admin-locale=hu");
    expect(document.documentElement).toHaveAttribute("lang", "hu");
  });
});
