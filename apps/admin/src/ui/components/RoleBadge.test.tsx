import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RoleBadge } from "./RoleBadge";

describe("RoleBadge", () => {
  it.each([
    ["ADMIN", "Admin", "admin-role-badge--admin"],
    ["EDITOR", "Editor", "admin-role-badge--editor"],
    ["AUTHOR", "Author", "admin-role-badge--author"],
    ["SUBSCRIBER", "Subscriber", "admin-role-badge--subscriber"],
  ])(
    "styles the %s role with its localized label",
    (role, label, className) => {
      render(<RoleBadge role={role} />);

      expect(screen.getByText(label)).toHaveClass(className);
    },
  );

  it("uses a neutral fallback for an unknown role", () => {
    render(<RoleBadge role="CUSTOM" />);

    expect(screen.getByText("CUSTOM")).toHaveClass("admin-role-badge--unknown");
  });

  it.each([
    ["ADMIN", "Adminisztrátor"],
    ["EDITOR", "Szerkesztő"],
    ["AUTHOR", "Szerző"],
    ["SUBSCRIBER", "Feliratkozó"],
  ])("shows the Hungarian label for %s", (role, label) => {
    document.cookie = "admin-locale=hu; Path=/";

    render(<RoleBadge role={role} />);

    expect(screen.getByText(label)).toBeVisible();
    document.cookie = "admin-locale=; Path=/; Max-Age=0";
  });
});
