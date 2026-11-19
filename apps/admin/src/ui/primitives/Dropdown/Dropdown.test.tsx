import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from "./Dropdown";

describe("Dropdown", () => {
  it("opens by keyboard, skips disabled actions and dismisses on outside pointer input", () => {
    const onAction = vi.fn();
    render(
      <>
        <Dropdown>
          <DropdownTrigger ariaLabel="Open user menu">User</DropdownTrigger>
          <DropdownMenu aria-label="User menu" onAction={onAction}>
            <DropdownItem itemKey="disabled" disabled>
              Disabled
            </DropdownItem>
            <DropdownItem itemKey="profile">Profile</DropdownItem>
          </DropdownMenu>
        </Dropdown>
        <button>Outside</button>
      </>,
    );
    const trigger = screen.getByRole("button", { name: "Open user menu" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const profile = screen.getByRole("menuitem", { name: "Profile" });
    expect(profile).toHaveFocus();
    expect(onAction).not.toHaveBeenCalled();
    fireEvent.click(profile);
    expect(onAction).toHaveBeenCalledWith("profile");

    fireEvent.click(trigger);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Outside" }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
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
