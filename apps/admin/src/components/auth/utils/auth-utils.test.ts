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

  it.each([
    "//evil.example", "/%2f%2fevil.example", "%2f%2fevil.example", "/%252f%252fevil.example",
    "/\\evil.example", "\\\\evil.example", "/%5cevil.example", "/admin/%255c../evil.example",
    "/admin\n/users", "\t/admin/users", "/admin/%0d%0aLocation:evil", "/admin/users?x=%00",
    "javascript:alert(1)", "data:text/html,test", "https://navigation.invalid/admin",
    "/administrator/users", "/admin/../settings", "/admin/%2e%2e//evil.example", "/admin/%3f//evil.example",
    "/admin/users?search=%ZZ",
  ])("fails closed for adversarial callback %s", (value) => {
    expect(safeCallbackUrl(value)).toBe("/admin");
  });

  it("normalizes local dot segments and preserves destination query encodings", () => {
    expect(safeCallbackUrl("/admin/posts/../pages?search=a%26b#editor")).toBe("/admin/pages?search=a%26b#editor");
    expect(safeCallbackUrl("/?source=sign-in")).toBe("/?source=sign-in");
    expect(safeCallbackUrl("/admin/profile")).toBe("/admin/profile");
  });
});

describe("mapNextAuthError", () => {
  it("maps known errors and provides a stable fallback", () => {
    expect(mapNextAuthError("CredentialsSignin")).toBe("Invalid email or password.");
    expect(mapNextAuthError("unknown")).toBe("Sign in failed.");
    expect(mapNextAuthError(null)).toBeNull();
  });
});
