export type TagValue = {
  id: string;
  name: string;
  slug: string;
};

export type TagLoadOptionsFn = (
  query: string,
  signal?: AbortSignal,
) => Promise<TagValue[]>;
export type TagCreateFn = (name: string) => Promise<TagValue>;
export type TagLoadEntityFn = (entityId: string) => Promise<TagValue[]>;
export type TagUpdateEntityFn = (
  entityId: string,
  tagIds: string[],
) => Promise<void>;
