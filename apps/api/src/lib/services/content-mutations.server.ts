import { pageLayouts } from "@nextpress/shared/content";

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

async function validateListingFilter(
  kind: "PAGE" | "POST",
  layout: string | undefined,
  id: string | null | undefined,
) {
  if (id === undefined) {
    return;
  }

  if (kind !== "PAGE" || layout !== pageLayouts.posts) {
    throw new PageValidationError([
      {
        path: "listingTaxonomyId",
        message: "Only Posts pages can set a listing tag",
      },
    ]);
  }

  if (id !== null) {
    await validateTagIds([id]);
  }
}

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

  await validateListingFilter(kind, parsed.layout, parsed.listingTaxonomyId);
  validateGallery(kind, parsed.layout, parsed.galleryIds);
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
      actor,
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

  await validateListingFilter(
    kind,
    parsed.layout ?? current.layout,
    parsed.listingTaxonomyId,
  );
  validateGallery(kind, parsed.layout ?? current.layout, parsed.galleryIds);

  if (parsed.tagIds) {
    await validateTagIds(parsed.tagIds);
  }

  const { tagIds, ...pageData } = parsed;

  const updated = await runWithContentConflictHandling(() =>
    updatePageWithTags(id, pageData, kind, actor, tagIds),
  );

  return updated;
}

function validateGallery(
  kind: "PAGE" | "POST",
  layout: string | undefined,
  galleryIds?: string[],
) {
  if (
    galleryIds !== undefined &&
    (kind !== "PAGE" || layout !== pageLayouts.gallery)
  ) {
    throw new PageValidationError([
      {
        path: "galleryIds",
        message: "Only Gallery pages can set gallery images",
      },
    ]);
  }
}
