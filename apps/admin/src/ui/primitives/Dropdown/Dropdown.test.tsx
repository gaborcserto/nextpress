import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from "./Dropdown";

describe("Dropdown", () => {
  it("opens to the first action, supports arrow keys, and returns focus after Escape", () => {
    render(
      <Dropdown>
        <DropdownTrigger ariaLabel="Open user menu">User</DropdownTrigger>
        <DropdownMenu aria-label="User menu">
          <DropdownItem itemKey="profile">Profile</DropdownItem>
          <DropdownItem itemKey="signout">Sign out</DropdownItem>
        </DropdownMenu>
      </Dropdown>,
    );

    const trigger = screen.getByRole("button", { name: "Open user menu" });
    fireEvent.click(trigger);
    const profile = screen.getByRole("menuitem", { name: "Profile" });
    const signOut = screen.getByRole("menuitem", { name: "Sign out" });
    expect(profile).toHaveFocus();
    fireEvent.keyDown(profile, { key: "ArrowDown" });
    expect(signOut).toHaveFocus();
    fireEvent.keyDown(signOut, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
