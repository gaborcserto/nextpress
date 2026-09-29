import { describe, expect, it } from "vitest";

import { mapNextAuthError } from "./errorMap";
import { safeCallbackUrl } from "./safeCallbackUrl";

describe("safeCallbackUrl", () => {
  it.each([undefined, null, "", "https://evil.example", "/settings"]) (
    "uses the admin default for unsafe callback %s",
    (value) => {
      expect(safeCallbackUrl(value)).toBe("/admin");
    }
  );

  it("allows admin paths and one-level root paths", () => {
    expect(safeCallbackUrl(" /admin/users ")).toBe("/admin/users");
    expect(safeCallbackUrl("%2Fadmin%2Fsettings")).toBe("/admin/settings");
    expect(safeCallbackUrl("/")).toBe("/");
  });

  it("falls back when decoding malformed input fails", () => {
    expect(safeCallbackUrl("%E0%A4%A")).toBe("/admin");
  });
});

describe("mapNextAuthError", () => {
  it("maps known errors and provides a stable fallback", () => {
    expect(mapNextAuthError("CredentialsSignin")).toBe("Invalid email or password.");
    expect(mapNextAuthError("unknown")).toBe("Sign in failed.");
    expect(mapNextAuthError(null)).toBeNull();
  });
});
