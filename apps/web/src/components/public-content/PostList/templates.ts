import { CompactPostList } from "./CompactPostList";
import { DefaultPostList } from "./DefaultPostList";

/** Rendering only: fetching, pagination and metadata stay with their callers. */
export const postListTemplates = [
  { id: "default", render: DefaultPostList },
  { id: "compact", render: CompactPostList },
] as const;

export function resolvePostListTemplate(identity: unknown) {
  return (
    postListTemplates.find((template) => template.id === identity) ??
    postListTemplates[0]
  );
}
