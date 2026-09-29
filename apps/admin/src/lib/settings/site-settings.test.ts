import { describe, expect, it, vi } from "vitest";

const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));

vi.mock("@nextpress/db/src/client", () => ({
  prisma: { siteSettings: { findUnique } },
}));

import { FALLBACK_USER_ROLE, SITE_SETTINGS_ID, getDefaultUserRole } from "./site-settings";

describe("site settings", () => {
  it("reads a configured valid default role", async () => {
    findUnique.mockResolvedValue({ defaultUserRole: "EDITOR" });

    await expect(getDefaultUserRole()).resolves.toBe("EDITOR");
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: SITE_SETTINGS_ID },
      select: { defaultUserRole: true },
    });
  });

  it("falls back when settings are missing or contain an invalid role", async () => {
    findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ defaultUserRole: "OWNER" });

    await expect(getDefaultUserRole()).resolves.toBe(FALLBACK_USER_ROLE);
    await expect(getDefaultUserRole()).resolves.toBe(FALLBACK_USER_ROLE);
  });
});
