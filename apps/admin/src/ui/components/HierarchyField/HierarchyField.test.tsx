import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import HierarchyField from "./HierarchyField";

vi.mock("@/lib/api", () => ({ jsonResult: async () => [[{ id: "page-1", title: "Home" }], null] }));

describe("HierarchyField", () => {
  it("allows clearing an existing parent page", async () => {
    const onChange = vi.fn();
    render(<HierarchyField parentId="page-1" onChangeAction={onChange} />);
    await screen.findByRole("option", { name: "Home" });
    fireEvent.change(screen.getByRole("combobox", { name: "Parent page" }), { target: { value: "" } });
    expect(onChange).toHaveBeenCalledExactlyOnceWith(null);
    expect(screen.getByRole("option", { name: "(no parent)" })).not.toBeDisabled();
  });
});
