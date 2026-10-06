import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import PageEditorScreen from "./PageEditorScreen";
import PagesListScreen from "../PagesListScreen/PagesListScreen";
import PostEditorScreen from "../PostEditorScreen/PostEditorScreen";
import PostsListScreen from "../PostsListScreen/PostsListScreen";
import { ApiRequestError } from "@/lib/api/client";

const { editorState, listState } = vi.hoisted(() => ({
  editorState: vi.fn(),
  listState: vi.fn(),
}));
vi.mock("./PageEditorScreen.hooks", () => ({ usePageEditor: editorState }));
vi.mock("../PostEditorScreen/PostEditorScreen.hooks", () => ({ usePostEditor: editorState }));
vi.mock("../PagesListScreen/PagesListScreen.hooks", () => ({ usePagesList: listState, useDeletePage: () => ({}) }));
vi.mock("../PostsListScreen/PostsListScreen.hooks", () => ({ usePostsList: listState, useDeletePost: () => ({}) }));

describe("Content screen load failures", () => {
  beforeEach(() => {
    editorState.mockReturnValue({ isEdit: true, item: null, isLoading: false, notFound: true, error: new Error("offline") });
    listState.mockReturnValue({ items: [], isLoading: false, error: new Error("offline") });
  });

  it.each(["page", "post"])("distinguishes a %s load failure from not found", (kind) => {
    render(kind === "page" ? <PageEditorScreen id="item-1" /> : <PostEditorScreen postId="item-1" />);
    expect(screen.getByRole("alert")).toHaveTextContent(`Unable to load ${kind}.`);
    expect(screen.queryByText(/not found/)).not.toBeInTheDocument();
  });

  it.each(["page", "post"])("preserves the missing %s state for a 404", (kind) => {
    editorState.mockReturnValue({ isEdit: true, item: null, isLoading: false, notFound: true, error: new ApiRequestError("Missing", 404) });
    render(kind === "page" ? <PageEditorScreen id="item-1" /> : <PostEditorScreen postId="item-1" />);
    expect(screen.getByText(kind === "page" ? "Page not found." : "Post not found.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it.each(["pages", "posts"])("distinguishes a %s list failure from an empty list", (kind) => {
    render(kind === "pages" ? <PagesListScreen /> : <PostsListScreen />);
    expect(screen.getByRole("alert")).toHaveTextContent(`Unable to load ${kind}.`);
    expect(screen.queryByText("No items found.")).not.toBeInTheDocument();
  });
});
