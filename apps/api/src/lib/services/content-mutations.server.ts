import {
  contentWriteWhere,
  requireContentWrite,
  type ContentActor,
} from "@/lib/auth/content-access";
import { createPageWithTags, updatePageWithTags } from "@/lib/repos/pageRepo";
import { validateTagIds } from "@/lib/repos/tagRepo";

import {
  validateCreateBody,
  validateUpdateBody,
  validatePublicationFields,
  runWithContentConflictHandling,
  PageValidationError,
} from "./content.shared";

/**
 * Create content with tags using the shared mutation contract.
 */
export async function createContentService(
  kind: "PAGE" | "POST",
  rawBody: unknown,
  actor: ContentActor,
) {
  contentWriteWhere(actor);
  const parsed = validateCreateBody(rawBody);

  if (parsed.type !== kind) {
    throw new PageValidationError([
      { path: "type", message: "Content type does not match endpoint" },
    ]);
  }

  await validateTagIds(parsed.tagIds);
  const { tagIds, ...pageData } = parsed;

  const created = await runWithContentConflictHandling(() =>
    createPageWithTags(
      {
        ...pageData,
        type: kind,
        authorId: actor.id,
      },
      tagIds,
    ),
  );

  return created;
}

/**
 * Update content after checking endpoint kind and write access.
 */
export async function updateContentService(
  kind: "PAGE" | "POST",
  id: string,
  rawBody: unknown,
  actor: ContentActor,
) {
  const current = await requireContentWrite(id, actor, kind);
  const parsed = validateUpdateBody(rawBody);

  if (parsed.type && parsed.type !== kind) {
    throw new PageValidationError([
      { path: "type", message: "Content type cannot be changed" },
    ]);
  }

  if (parsed.status === "PUBLISHED") {
    validatePublicationFields({
      title: parsed.title ?? current.title,
      slug: parsed.slug ?? current.slug,
    });
  }

  if (parsed.tagIds) {
    await validateTagIds(parsed.tagIds);
  }

  const { tagIds, ...pageData } = parsed;

  const updated = await runWithContentConflictHandling(() =>
    updatePageWithTags(id, pageData, kind, actor, tagIds),
  );

  return updated;
}
