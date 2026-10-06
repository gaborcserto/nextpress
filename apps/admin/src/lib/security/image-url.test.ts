import { describe, expect, it } from "vitest";

import { safeImageUrl } from "./image-url";

describe("browser image URLs", () => {
  it.each(["javascript:alert(1)", "data:image/svg+xml,test", "//evil.example/image", "/%2f/evil.example",
    "/%255cevil.example", "/\\evil.example", "https:\\evil.example", "avatar.jpg", "https://user:secret@example.com/a",
    "https://example.com/\nimage", "/%00image", "http://[invalid", "/admin/..//evil.example"]) (
    "rejects unsafe or ambiguous image URL %s", (url) => expect(safeImageUrl(url)).toBeNull(),
  );

  it("preserves supported absolute and local images without promoting relative data", () => {
    expect(safeImageUrl("https://avatars.githubusercontent.com/u/1?s=64")).toBe("https://avatars.githubusercontent.com/u/1?s=64");
    expect(safeImageUrl("http://localhost:49101/image.png")).toBe("http://localhost:49101/image.png");
    expect(safeImageUrl("/media/photo%20one.png?size=64")).toBe("/media/photo%20one.png?size=64");
  });
});
