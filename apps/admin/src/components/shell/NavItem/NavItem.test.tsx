import { fireEvent, render, screen } from "@testing-library/react";
import { FaHome } from "react-icons/fa";
import { describe, expect, it, vi } from "vitest";

import NavItem from "./NavItem";

describe("navigation item", () => {
  it.each([false, true])(
    "retains its name, destination and active state when collapsed=%s",
    (collapsed) => {
      const onClick = vi.fn((event?: { preventDefault: () => void }) =>
        event?.preventDefault(),
      );
      render(
        <NavItem
          href="/admin/posts"
          label="Posts"
          IconAction={FaHome}
          collapsed={collapsed}
          active
          onClickAction={onClick}
        />,
      );
      const link = screen.getByRole("link", { name: "Posts" });
      expect(link).toHaveAttribute("href", "/admin/posts");
      expect(link).toHaveAttribute("aria-current", "page");
      fireEvent.click(link);
      expect(onClick).toHaveBeenCalledOnce();
    },
  );

  it("does not mark inactive links as current", () => {
    render(
      <NavItem href="/admin" label="Dashboard" IconAction={FaHome} collapsed />,
    );
    expect(screen.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute(
      "aria-current",
    );
  });
});
