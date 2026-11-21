import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { deferred } from "@/lib/testing/deferred.fixture";

import HierarchyField from "./HierarchyField";

const fetchMock = vi.fn<typeof fetch>();

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

function renderField(parentId: string | null = null) {
  vi.stubGlobal("fetch", fetchMock);
  const onChange = vi.fn();
  const view = render(
    <HierarchyField parentId={parentId} onChangeAction={onChange} />,
  );

  return { ...view, onChange };
}

describe("HierarchyField", () => {
  it("allows clearing an existing parent page", async () => {
    fetchMock.mockResolvedValue(
      Response.json([{ id: "page-1", title: "Home" }]),
    );
    const { onChange } = renderField("page-1");

    await screen.findByRole("option", { name: "Home" });
    fireEvent.change(screen.getByRole("combobox", { name: "Parent page" }), {
      target: { value: "" },
    });

    expect(onChange).toHaveBeenCalledExactlyOnceWith(null);
    expect(
      screen.getByRole("option", { name: "(no parent)" }),
    ).not.toBeDisabled();
  });

  it("announces an empty result only after loading succeeds", async () => {
    const response = deferred<Response>();
    fetchMock.mockReturnValue(response.promise);
    renderField();

    expect(screen.getByRole("status")).toHaveTextContent(
      "Loading parent pages",
    );
    response.resolve(Response.json([]));

    expect(await screen.findByText("No Pages found.")).toBeVisible();
  });

  it("preserves the selected parent through a failure and keyboard retry", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    const response = deferred<Response>();
    fetchMock.mockReturnValueOnce(response.promise);
    const { onChange } = renderField("page-1");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to load parent pages.",
    );
    expect(screen.queryByText("No Pages found.")).not.toBeInTheDocument();
    const select = screen.getByRole("combobox");
    expect(select).toHaveValue("page-1");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(select).toHaveFocus();
    expect(select).toHaveValue("page-1");
    response.resolve(Response.json([{ id: "page-1", title: "Home" }]));

    expect(await screen.findByRole("option", { name: "Home" })).toBeVisible();
    expect(select).toHaveValue("page-1");
    expect(onChange).not.toHaveBeenCalled();
  });

  it.each([401, 403])("reports access denial for HTTP %i", async (status) => {
    fetchMock.mockResolvedValue(Response.json({ error: "denied" }, { status }));
    renderField();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "You do not have access to the parent pages.",
    );
    expect(screen.queryByText("No Pages found.")).not.toBeInTheDocument();
  });

  it("localizes a malformed response failure in Hungarian", async () => {
    vi.stubGlobal("navigator", { language: "hu-HU" });
    fetchMock.mockResolvedValue(Response.json([{ id: "missing-title" }]));
    renderField();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "A szülőoldalak nem tölthetők be.",
    );
    expect(
      screen.queryByText("Nincsenek elérhető szülőoldalak."),
    ).not.toBeInTheDocument();
  });

  it("aborts an in-flight lookup on unmount", async () => {
    const response = deferred<Response>();
    fetchMock.mockReturnValue(response.promise);
    const { unmount } = renderField();
    const signal = fetchMock.mock.calls[0]?.[1]?.signal;

    unmount();
    await act(async () =>
      response.reject(new DOMException("Aborted", "AbortError")),
    );

    expect(signal?.aborted).toBe(true);
  });
});
