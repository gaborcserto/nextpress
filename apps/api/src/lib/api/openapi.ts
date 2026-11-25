import { AppearanceCatalogSchema, AppearanceSchema } from "@nextpress/shared";
import {
  ApiErrorSchema,
  TagSchema,
  TagWithUsageSchema,
  ContentRecordSchema,
  ContentListSchema,
  DashboardSummarySchema,
  HomepageSelectionSchema,
  PageListFiltersSchema,
  PostListFiltersSchema,
  TaxonomyListFiltersSchema,
  TaxonomyListSchema,
  EditorialPageSchema,
  EditorialPostSchema,
  PublicContentSchema,
  PublicTaxonomyBatchSchema,
  PublicTagBatchSchema,
  PublicPostBatchSchema,
  PublicNavigationSchema,
  PublicMenusSchema,
  PageHierarchyMutationSchema,
  NavigationMenuListSchema,
  NavigationMenuMutationSchema,
  PublicSiteSettingsSchema,
  SessionDiscoverySchema,
  ProviderDiscoverySchema,
  PublicContentIndexSchema,
  PublicContentIndexQuerySchema,
} from "@nextpress/shared/api-contracts";
import {
  emailSchema,
  passwordSchema,
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
} from "@nextpress/shared/auth-policy";
import {
  RichBlocksSchema,
  RichDocumentSchema,
} from "@nextpress/shared/content";
import {
  DocumentBrowseSchema,
  DocumentFilenameSchema,
  documentMime,
  MediaMetadataSchema,
  MediaAssetSchema,
  MediaLibraryBrowseSchema,
  MediaCollectionSchema,
  MediaDetailsSchema,
  MediaEditSchema,
  MediaUploadSchema,
} from "@nextpress/shared/media";
import {
  RevisionActionSchema,
  RevisionInputSchema,
  RevisionListSchema,
  RevisionRecordSchema,
} from "@nextpress/shared/revisions";
import {
  SettingsResponseSchema,
  SettingsSavedSchema,
  SettingsUpdateSchema,
} from "@nextpress/shared/settings-contracts";
import { z } from "zod";

import { ROLES } from "@/lib/auth/roles";
import {
  PageSchema,
  PageUpdateSchema,
  TagCreateSchema,
  TagUpdateSchema,
  TagIdsSchema,
} from "@/lib/validation";
import {
  ExecutePrivateReleasesSchema,
  PrivateReleaseExecutionResultSchema,
} from "@/lib/validation/private-release";
import {
  WorkingAggregateEnvelopeSchema,
  WorkingAggregateSaveSchema,
} from "@/lib/validation/working-aggregate";

import { integer, operation, parameter, ref, schema } from "./openapi-builders";
import { deliveryPaths } from "./openapi-delivery";
import { version } from "../../../package.json";

import type { OpenAPIV3 } from "openapi-types";

const string = { type: "string" } as const;
const boolean = { type: "boolean" } as const;
const nullableString = { type: "string", nullable: true } as const;
const date = { type: "string", format: "date-time" } as const;

const array = (items: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject) =>
  ({ type: "array", items }) as const;

function object(
  properties: Record<
    string,
    OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject
  >,
  required = Object.keys(properties),
) {
  return {
    type: "object",
    properties,
    ...(required.length ? { required } : {}),
  } as const;
}

const role = schema(z.enum(ROLES));
const roleRelation: OpenAPIV3.SchemaObject = {
  anyOf: [
    object({ name: string }),
    { type: "object", nullable: true, enum: [null] },
  ],
};
const userProperties = {
  id: string,
  email: string,
  name: nullableString,
  role: roleRelation,
  roleName: nullableString,
};
const schemas: Record<string, OpenAPIV3.SchemaObject> = {
  PrivateDraft: schema(WorkingAggregateEnvelopeSchema),
  PrivateDraftSave: schema(WorkingAggregateSaveSchema.omit({ pageId: true })),
  ExecutePrivateReleases: schema(ExecutePrivateReleasesSchema),
  MediaUpload: schema(MediaUploadSchema),
  RevisionInput: schema(RevisionInputSchema),
  RevisionAction: schema(RevisionActionSchema),
  RevisionList: schema(RevisionListSchema),
  RevisionRecord: schema(RevisionRecordSchema),
  MediaMetadata: schema(MediaMetadataSchema),
  MediaAsset: schema(MediaAssetSchema),
  MediaCollection: schema(MediaCollectionSchema),
  MediaDetails: schema(MediaDetailsSchema),
  MediaEdit: schema(MediaEditSchema),
  PublicContentIndex: schema(PublicContentIndexSchema),
  PublicMenus: schema(PublicMenusSchema),
  NavigationMenuList: schema(NavigationMenuListSchema),
  NavigationMenuMutation: schema(NavigationMenuMutationSchema),
  NavigationMenuResult: object({ id: string }),
  PageHierarchy: array(
    object({
      id: string,
      title: string,
      slug: string,
      layout: string,
      parentId: nullableString,
      siblingOrder: integer,
    }),
  ),
  PageHierarchyMutation: schema(PageHierarchyMutationSchema),
  PageHierarchyResult: object({
    id: string,
    parentId: nullableString,
    siblingOrder: integer,
  }),
  Health: object({ status: { type: "string", enum: ["ok"] } }),
  Error: schema(ApiErrorSchema),
  Success: object({ ok: { type: "boolean", enum: [true] } }),
  DeletedTag: object({ message: string }),
  Tag: schema(TagSchema),
  TagWithUsage: schema(TagWithUsageSchema),
  TagCreate: schema(TagCreateSchema),
  TagUpdate: schema(TagUpdateSchema),
  TagLinks: {
    anyOf: [schema(TagIdsSchema), object({ tagIds: schema(TagIdsSchema) })],
    description:
      "Array or object with required tagIds; IDs must be unique and refer to TAG taxonomies. An empty array clears assignments.",
  },
  RichBlocks: schema(RichBlocksSchema),
  RichDocument: schema(RichDocumentSchema),
  PageCreate: schema(PageSchema.extend({ type: z.literal("PAGE") })),
  PostCreate: schema(PageSchema.extend({ type: z.literal("POST") })),
  PageUpdate: schema(
    PageUpdateSchema.extend({ type: z.literal("PAGE").optional() }),
  ),
  PostUpdate: schema(
    PageUpdateSchema.extend({ type: z.literal("POST").optional() }),
  ),
  ContentRecord: schema(ContentRecordSchema),
  ContentList: schema(ContentListSchema),
  TaxonomyList: schema(TaxonomyListSchema),
  ParentOptions: array(
    object({ id: string, title: string, parentId: nullableString }),
  ),
  HomepageSelection: schema(HomepageSelectionSchema),
  PageDetail: schema(z.object({ item: EditorialPageSchema })),
  PostDetail: schema(z.object({ item: EditorialPostSchema })),
  PublicContent: schema(PublicContentSchema),
  // Summary cover is optional for consumer-first rollout; contains public URL/alt/dimensions only.
  PublicPostBatch: schema(PublicPostBatchSchema),
  PublicTaxonomyBatch: schema(PublicTaxonomyBatchSchema),
  PublicTagBatch: schema(PublicTagBatchSchema),
  PublicNavigation: schema(PublicNavigationSchema),
  PublicSiteSettings: schema(PublicSiteSettingsSchema),
  Appearance: schema(AppearanceSchema),
  AppearanceCatalog: schema(AppearanceCatalogSchema),
  SessionDiscovery: schema(SessionDiscoverySchema),
  ProviderDiscovery: schema(ProviderDiscoverySchema),
  UserCreate: object(
    {
      email: schema(emailSchema),
      name: { ...nullableString, maxLength: 200 },
      role,
      password: {
        ...schema(passwordSchema),
        writeOnly: true,
        description: `Optional credential password. Shared password policy: at least ${MIN_PASSWORD_LENGTH} Unicode code points, at most ${MAX_PASSWORD_LENGTH} UTF-16 units, no lone surrogates; never trimmed.`,
      },
    },
    ["email"],
  ),
  CreatedUser: object(userProperties),
  Users: array(
    object({
      ...userProperties,
      emailVerified: boolean,
      createdAt: date,
      updatedAt: date,
    }),
  ),
  RoleUpdate: object({ role }),
  UpdatedRole: object({ id: string, roleName: nullableString }),
  SettingsUpdate: schema(SettingsUpdateSchema),
  Settings: schema(SettingsResponseSchema),
  SettingsSaved: schema(SettingsSavedSchema),
};

const id = parameter(
  "id",
  "path",
  string,
  "Resource ID; content GET also accepts a slug.",
);

function listParameters(shape: Record<string, z.ZodType>) {
  return Object.entries(shape).map(([name, value]) =>
    parameter(name, "query", schema(value), "Duplicate parameters rejected."),
  );
}

const pagination = [
  parameter(
    "page",
    "query",
    { ...integer, minimum: 1, maximum: 10000, default: 1 },
    "Single decimal integer; duplicate parameters rejected.",
  ),
  parameter(
    "limit",
    "query",
    { ...integer, minimum: 1, maximum: 100, default: 50 },
    "Single decimal integer; duplicate parameters rejected.",
  ),
];
const mutationCodes = [401, 403, 413, 415, 429];
const readScope =
  "Anonymous and SUBSCRIBER readers see PUBLISHED content with no future publishedAt. AUTHOR also sees own drafts; ADMIN and EDITOR see all content.";
const writeScope =
  "ADMIN, EDITOR or AUTHOR. AUTHOR may update only owned content. Mutations require a trusted Origin and application/json; request body maximum 5,000,000 bytes.";
const paths: OpenAPIV3.PathsObject = {
  "/api/admin/dashboard": {
    get: operation(
      "getDashboardSummary",
      "Content",
      "Get the editorial dashboard summary",
      schema(DashboardSummarySchema),
      [401, 403, 500],
      "ADMIN and EDITOR see all Posts and Pages; AUTHOR sees only owned content. Missing sessions receive 401 and other roles receive 403. The response is private and non-cacheable. Counts and up to eight entries per list use one snapshot and the default date-based publication rules. Guarded private revisions and releases are outside this projection.",
      "protected",
    ),
  },
  "/api/private-drafts/execute": {
    post: operation(
      "executePrivateReleases",
      "Content",
      "Execute due private releases",
      schema(PrivateReleaseExecutionResultSchema),
      [400, ...mutationCodes, 500, 503],
      "ADMIN Better Auth session, trusted Origin and JSON command with optional after cursor required. Same production-disabled private admission. At most 20 due releases and 50 seconds of work; deployment timeout 60 seconds. Each original scheduling actor is reauthorized under database locks. Overlap and retry are safe through the content fence and atomic execution receipt. Refused releases remain pending. Carry nextCursor as after until the sweep completes, then restart without a cursor to retry refusals; inspect results and alert on repeated refusal. No deployment trigger is installed.",
      "protected",
      "ExecutePrivateReleases",
    ),
  },
  "/api/private-drafts/{id}": {
    parameters: [id],
    get: operation(
      "loadPrivateDraft",
      "Content",
      "Load private working state with its server save time when recorded, or an authoritative initialization snapshot",
      ref("PrivateDraft"),
      [400, 401, 403, 404, 409, 500, 503],
      "Development rehearsal only; disabled by default and always disabled in production. Requires independently verified database/cluster/nonprivileged role and installed writer guards. ADMIN/EDITOR all; AUTHOR owned content only. Version zero is an unpersisted initialization snapshot. Latest saved private state recovers after reload. Includes the latest 100 private revision numbers/titles at load; older revisions remain retained. No public or SHADOW writes. Private no-store.",
      "protected",
    ),
    put: operation(
      "savePrivateDraft",
      "Content",
      "Save private content or explicitly manage publication",
      ref("PrivateDraft"),
      [400, ...mutationCodes, 404, 409, 500, 503],
      "Same rehearsal admission and ownership as load. Empty patch initializes a durable copy. Use a fresh UUID per logical save, and exactly the same UUID/body after a lost response. Draft/source/base tokens reject stale edits. Only supported patch fields change; historical fields remain retained. Publication intent is metadata only. Explicit operation RESET with an empty patch and no publication intent appends a complete snapshot from the current authoritative source; it requires the latest draft token and observed currentSourceVersion (GET metadata), even after legacy source drift. Explicit operation RESTORE requires restoreVersion for the same content identity, an empty patch and no publication intent, plus current draft/source/base tokens. It appends historical private content with the current baseline and PRESERVE intent, revalidating references; stale source requires RESET first. RESTORE_LEGACY instead requires legacyRevisionId from this Page and no restoreVersion. It restores only title, slug, excerpt, content, layout and supported raw pageDocument; fields absent from legacy history retain current private values. Historical author identifies the revision actor, not past ownership or kind. GET legacyHistory exposes supported records from the latest 100; unsupported documents are excluded and direct commands refused. Current identity authorization, source/draft/base validation, reference locks and durable replay apply. All private revisions and replay evidence remain retained. No automatic rebase, deletion or SHADOW enrollment. Explicit PUBLISH pins the current accepted private revision and atomically updates authoritative content, tags, compatible legacy history, publication receipt and baseline. UNPUBLISH retains historical content/date and cancels pending release. SCHEDULE requires a future offset-aware scheduledFor and pins the current revision; repeating SCHEDULE replaces the pending generation. CANCEL_SCHEDULE retains cancellation evidence. These commands require empty patches, no publication intent, current role/ownership, source/draft/base tokens and publication database privileges. EXECUTE is internal and refused through this PUT; use the secured executor. All lifecycle commands support exact UUID replay.",
      "protected",
      "PrivateDraftSave",
    ),
  },
  "/api/public/content": {
    get: {
      ...operation(
        "publicContentIndex",
        "Delivery",
        "Published content index for listings and sitemap",
        ref("PublicContentIndex"),
        [400, 500],
        "Cookie-independent. Published and dated only. Bounded pagination; no body content or ownership information.",
      ),
      parameters: Object.entries(PublicContentIndexQuerySchema.shape).map(
        ([key, value]) =>
          parameter(
            key,
            "query",
            schema(value),
            "Bounded content index filter",
            false,
          ),
      ),
    },
  },
  "/api/documents": {
    get: {
      ...operation(
        "browseDocuments",
        "Media",
        "Browse PDF documents",
        ref("MediaCollection"),
        [400, 401, 403, 500],
        "ADMIN/EDITOR all; AUTHOR owned only.",
        "protected",
      ),
      parameters: Object.entries(DocumentBrowseSchema.shape).map(
        ([name, shape]) =>
          parameter(
            name,
            "query",
            schema(shape),
            "Document library filter",
            false,
          ),
      ),
    },
    post: {
      ...operation(
        "uploadDocument",
        "Media",
        "Upload a PDF document",
        ref("MediaAsset"),
        [400, 401, 403, 415, 429, 500],
        "Maximum 10 MiB. ADMIN/EDITOR/AUTHOR only.",
        "protected",
        undefined,
        201,
      ),
      parameters: [
        parameter(
          "filename",
          "query",
          schema(DocumentFilenameSchema),
          "Original PDF filename",
          true,
        ),
      ],
      requestBody: {
        required: true,
        content: {
          [documentMime]: { schema: { type: "string", format: "binary" } },
        },
      },
    },
  },
  "/api/media": {
    get: operation(
      "listMedia",
      "Media",
      "List authorized media",
      { type: "array", items: ref("MediaMetadata") },
      [401, 403, 500],
      "ADMIN/EDITOR all; AUTHOR owned media only.",
      "protected",
    ),
    post: operation(
      "uploadMedia",
      "Media",
      "Upload validated JPEG, PNG, WebP, AVIF, or GIF",
      ref("MediaAsset"),
      [400, ...mutationCodes, 409, 500],
      "JSON base64 upload, maximum 2 MiB decoded and 16 million pixels. Validated, auto-oriented and stored in the detected format without source metadata. GIF is the supported animation format. Optional original filename is stored as display text. ADMIN/EDITOR/AUTHOR only.",
      "protected",
      "MediaUpload",
      201,
    ),
  },
  "/api/media/library": {
    get: {
      ...operation(
        "browseMedia",
        "Media",
        "Browse authorized media",
        ref("MediaCollection"),
        [400, 401, 403, 500],
        "Pages contain at most 24 assets. ADMIN/EDITOR all; AUTHOR owned media only.",
        "protected",
      ),
      parameters: Object.entries(MediaLibraryBrowseSchema.shape).map(
        ([name, shape]) =>
          parameter(
            name,
            "query",
            schema(shape),
            "Media library filter",
            false,
          ),
      ),
    },
  },
  "/api/media/{id}/metadata": {
    parameters: [id],
    get: operation(
      "mediaDetails",
      "Media",
      "Read asset metadata",
      ref("MediaDetails"),
      [401, 403, 404, 500],
      "ADMIN/EDITOR all; AUTHOR owned only. Usage is an aggregate flag available to ADMIN/EDITOR.",
      "protected",
    ),
    patch: operation(
      "editMedia",
      "Media",
      "Edit asset metadata",
      ref("MediaAsset"),
      [400, ...mutationCodes, 404, 500],
      "ADMIN/EDITOR all; AUTHOR owned only. An empty alternative text marks a decorative image.",
      "protected",
      "MediaEdit",
    ),
  },
  "/api/media/{id}": {
    parameters: [id],
    get: operation(
      "serveMedia",
      "Media",
      "Serve authorized or published referenced media",
      { type: "string", format: "binary" },
      [404, 500],
      "Private media requires an editor/admin or owning author session. PDF documents are delivered as attachments to authorized sessions. No-store.",
      "optional",
    ),
    delete: operation(
      "deleteMedia",
      "Media",
      "Delete unreferenced media",
      ref("Success"),
      [400, ...mutationCodes, 404, 409, 500],
      "ADMIN/EDITOR all; AUTHOR owned only. References in published content, drafts or revision history block deletion.",
      "protected",
    ),
  },
  "/api/public/media/{id}": {
    parameters: [id],
    get: operation(
      "publicMedia",
      "Media",
      "Serve only publicly referenced images",
      { type: "string", format: "binary" },
      [404, 500],
      "Requires an exact media reference from published, dated content. Ignores sessions; no-store.",
      "public",
    ),
  },
  "/api/pages/{id}/revisions": {
    parameters: [id],
    get: {
      ...operation(
        "listRevisions",
        "Content",
        "List working revisions or preview one",
        { oneOf: [ref("RevisionList"), ref("RevisionRecord")] },
        [401, 403, 404, 500],
        "Authenticated ADMIN/EDITOR or owning AUTHOR only. Private no-store. The current working copy includes its update timestamp; saved revisions include their recorded author name when available. The current snapshot includes its configured listing tag slug. A historical preview requires explicit revisionId; public delivery is never overridden.",
        "protected",
      ),
      parameters: [
        parameter(
          "revisionId",
          "query",
          string,
          "Exact revision identity for authenticated preview.",
          false,
        ),
      ],
    },
    post: operation(
      "saveRevision",
      "Content",
      "Save an independent working revision",
      ref("RevisionRecord"),
      [400, ...mutationCodes, 409, 500],
      "Requires expectedVersion and a full revision snapshot. Does not change published content. Authenticated ADMIN/EDITOR or owning AUTHOR.",
      "protected",
      "RevisionInput",
      201,
    ),
    patch: operation(
      "revisionAction",
      "Content",
      "Restore, publish or unpublish a revision",
      { type: "object", additionalProperties: true },
      [400, ...mutationCodes, 404, 409, 500],
      "Requires exact revisionId and expectedVersion. Restore creates a new draft and never publishes. Publishing preserves the current publication date, including future schedules, and assigns now only when undated. Unpublishing sets DRAFT and retains the publication date. Author publishing rights remain scoped to owned content.",
      "protected",
      "RevisionAction",
    ),
  },
  "/api/health": {
    get: operation(
      "health",
      "Health",
      "Application liveness",
      ref("Health"),
      [],
      "Public, uncached application response. Does not check PostgreSQL or operational readiness.",
    ),
  },
};

Object.assign(paths, deliveryPaths);

for (const [path, kind, detail] of [
  ["pages", "Page", "PageDetail"],
  ["post", "Post", "PostDetail"],
]) {
  const pageTypes =
    path === "pages"
      ? " Use layout STANDARD, HOME, POSTS, or GALLERY for supported page behavior. HOME is the single site Homepage regardless of publication status; a competing write returns 409. POSTS accepts listingTaxonomyId for an existing tag; null clears it."
      : "";

  const list = operation(
    `list${kind}s`,
    "Content",
    `List ${path}`,
    path === "pages"
      ? {
          anyOf: [
            ref("ContentList"),
            ref("ParentOptions"),
            ref("HomepageSelection"),
          ],
        }
      : ref("ContentList"),
    [400, 403, 500],
    `\${readScope} Search matches title or slug. Sorting defaults to updatedAt descending, with ID as the tie-breaker. Publication status is evaluated at request time.`,
    "optional",
  );
  list.parameters =
    path === "pages"
      ? [
          ...pagination,
          ...listParameters(PageListFiltersSchema.shape),
          parameter(
            "select",
            "query",
            { ...string, enum: ["parent", "homepage"] },
            "Parent options or the existing Homepage ID; both bypass pagination. Other values or duplicates are rejected.",
          ),
        ]
      : [...pagination, ...listParameters(PostListFiltersSchema.shape)];
  paths[`/api/${path}`] = {
    get: list,
    post: operation(
      `create${kind}`,
      "Content",
      `Create ${kind.toLowerCase()}`,
      ref("ContentRecord"),
      [400, ...mutationCodes, 409, 500],
      `${writeScope} Content and excerpt are serialized RichDocument JSON strings, not editor arrays. Unknown fields are stripped.${pageTypes}`,
      "protected",
      `${kind}Create`,
      201,
    ),
  };
  paths[`/api/${path}/{id}`] = {
    parameters: [id],
    get: operation(
      `read${kind}`,
      "Content",
      `Read ${kind.toLowerCase()} editor projection`,
      ref(detail),
      [404, 500],
      `${readScope} Returns {item} with rich-content arrays; this differs from mutation payloads.`,
      "optional",
    ),
    put: operation(
      `update${kind}`,
      "Content",
      `Update ${kind.toLowerCase()}`,
      ref("ContentRecord"),
      [400, ...mutationCodes, 404, 409, 500],
      `${writeScope} Partial update despite PUT; expectedVersion from editorial GET workingVersion is required. Missing versions return 400; stale versions return 409 without writing. Content type cannot change. Explicit publication validates the merged title and slug. Omitted status/date preserve publication state and schedule. PUBLISHED with a future publishedAt is scheduled; public delivery starts at that instant without a worker. Provide publishedAt as an ISO 8601 instant with Z or an explicit offset. Explicit null publishedAt means now for PUBLISHED, null for DRAFT. Unpublishing retains the historical date unless explicitly cleared. Saving published content updates live content. Unknown fields are stripped.${pageTypes}`,
      "protected",
      `${kind}Update`,
    ),
    delete: operation(
      `delete${kind}`,
      "Content",
      `Delete ${kind.toLowerCase()}`,
      ref("Success"),
      [...mutationCodes, 404, 409, 500],
      "ADMIN or EDITOR. Requires trusted Origin; bodyless DELETE needs no Content-Type.",
      "protected",
    ),
  };
}

paths["/api/tags"] = {
  get: {
    ...operation(
      "searchTags",
      "Tags",
      "Search tags",
      array(ref("Tag")),
      [400, 500],
      "Public. Queries shorter than two trimmed characters return []; at most 20 results.",
    ),
    parameters: [
      parameter(
        "query",
        "query",
        { ...string, maxLength: 200, default: "" },
        "Search by name or slug.",
      ),
    ],
  },
  post: operation(
    "createTag",
    "Tags",
    "Create or reuse a tag",
    ref("Tag"),
    [400, ...mutationCodes, 409, 500],
    "ADMIN, EDITOR or AUTHOR. Existing case-insensitive name is reused with status 201.",
    "protected",
    "TagCreate",
    201,
  ),
  delete: {
    ...operation(
      "deleteTag",
      "Tags",
      "Delete a tag",
      ref("DeletedTag"),
      [400, ...mutationCodes, 404, 409, 500],
      "ADMIN or EDITOR. Requires trusted Origin.",
      "protected",
    ),
    parameters: [
      parameter(
        "id",
        "query",
        { ...string, maxLength: 64 },
        "Nonempty trimmed tag ID.",
        true,
      ),
    ],
  },
};
paths["/api/tags/link"] = {
  parameters: [
    parameter(
      "entityId",
      "query",
      { ...string, minLength: 1, maxLength: 64 },
      "Nonempty trimmed page/post ID.",
      true,
    ),
  ],
  get: operation(
    "readTagLinks",
    "Tags",
    "Read assigned tags",
    array(ref("Tag")),
    [400, 403, 404, 500],
    readScope,
    "optional",
  ),
  put: operation(
    "replaceTagLinks",
    "Tags",
    "Replace assigned tags",
    ref("Success"),
    [400, ...mutationCodes, 404, 409, 500],
    `${writeScope} Tags are replaced immediately in one transaction and advance the Page workingVersion. Clients must reload the version before a later scalar save. Concurrent content writers may return 409 without partial changes.`,
    "protected",
    "TagLinks",
  ),
};
paths["/api/admin/tags"] = {
  post: operation(
    "createAdminCategory",
    "Tags",
    "Create a category with a name and slug",
    ref("Tag"),
    [400, ...mutationCodes, 409, 500],
    "ADMIN or EDITOR. Requires trusted Origin. Slugs are unique across taxonomy records.",
    "protected",
    "TagUpdate",
  ),
  get: {
    ...operation(
      "listTagsWithUsage",
      "Tags",
      "List tags or categories with post usage counts",
      { oneOf: [array(ref("TagWithUsage")), ref("TaxonomyList")] },
      [400, 401, 403, 500],
      "ADMIN, EDITOR or AUTHOR. With no query parameters, returns the legacy array of up to 500 tags. For a paginated list, supply type=TAG or type=CATEGORY. Search matches name or slug. Sorting defaults to name ascending, with ID as the tie-breaker.",
      "protected",
    ),
    parameters: [
      ...pagination,
      ...listParameters(TaxonomyListFiltersSchema.shape),
    ],
  },
};
paths["/api/admin/tags/{id}"] = {
  parameters: [
    parameter(
      "id",
      "path",
      string,
      "Nonempty trimmed tag ID; no route-level length limit.",
    ),
  ],
  delete: {
    ...operation(
      "deleteAdminTag",
      "Tags",
      "Delete a tag or an unreferenced category from administration",
      ref("DeletedTag"),
      [400, ...mutationCodes, 404, 409, 500],
      "ADMIN or EDITOR. Requires trusted Origin.",
      "protected",
    ),
    parameters: [
      parameter(
        "type",
        "query",
        { type: "string", enum: ["CATEGORY"] },
        "Omit to delete a tag.",
      ),
    ],
  },
  patch: operation(
    "updateAdminTag",
    "Tags",
    "Update a tag or category name and slug without changing its content relationships",
    ref("Tag"),
    [400, 401, 403, 404, 409, 500],
    "ADMIN or EDITOR. Requires trusted Origin. Slugs are unique across taxonomy records.",
    "protected",
    "TagUpdate",
  ),
};
paths["/api/admin/users"] = {
  get: operation(
    "listUsers",
    "Users",
    "List users",
    ref("Users"),
    [401, 403, 500],
    "ADMIN only. At most 500, newest first. No credential/session data returned.",
    "protected",
  ),
};
paths["/api/admin/users/create"] = {
  post: operation(
    "createUser",
    "Users",
    "Provision a user",
    ref("CreatedUser"),
    [400, ...mutationCodes, 409, 500],
    "ADMIN only. Omitted role uses the configured default user role. Password is optional. Requires trusted Origin and application/json.",
    "protected",
    "UserCreate",
    201,
  ),
};
paths["/api/admin/users/{id}"] = {
  parameters: [
    parameter(
      "id",
      "path",
      { ...string, minLength: 1, maxLength: 64 },
      "User ID.",
    ),
  ],
  delete: operation(
    "deleteUser",
    "Users",
    "Delete a user",
    ref("Success"),
    [400, ...mutationCodes, 404, 409, 500],
    "ADMIN only. Requires trusted Origin. The final administrator cannot be deleted.",
    "protected",
  ),
};
paths["/api/admin/users/{id}/role"] = {
  parameters: [
    parameter(
      "id",
      "path",
      { ...string, minLength: 1, maxLength: 64 },
      "User ID.",
    ),
  ],
  patch: operation(
    "updateUserRole",
    "Users",
    "Assign a user role",
    ref("UpdatedRole"),
    [400, ...mutationCodes, 404, 409, 500],
    "ADMIN only. Requires trusted Origin and application/json. The final administrator cannot be demoted.",
    "protected",
    "RoleUpdate",
  ),
};
paths["/api/admin/settings"] = {
  get: operation(
    "readSettings",
    "Settings",
    "Read administration settings",
    ref("Settings"),
    [401, 403, 500],
    "ADMIN only. Initializes missing settings/provider rows and returns exactly one entry per supported OAuth provider. Date and time settings govern display and new editor input. Credential presence flags are returned; secrets are never returned.",
    "protected",
  ),
  put: operation(
    "updateSettings",
    "Settings",
    "Update administration settings",
    ref("SettingsSaved"),
    [400, ...mutationCodes, 500],
    "ADMIN only. Listing mode is PAGINATION or LOAD_MORE and postsPerPage is an integer from 1 to 50. Nonblank siteName; URLs must be empty or HTTP(S). Supply exactly one entry per supported OAuth provider. Enabled providers require operational credentials. Requires trusted Origin and application/json. Returns effective credential status flags after saving.",
    "protected",
    "SettingsUpdate",
  ),
};

paths["/api/admin/settings/appearance"] = {
  get: operation(
    "readAppearance",
    "Settings",
    "Read website appearance",
    ref("Appearance"),
    [401, 403, 500],
    "ADMIN only. Normalizes obsolete stored identifiers.",
    "protected",
  ),
  put: operation(
    "updateAppearance",
    "Settings",
    "Update website appearance",
    ref("Appearance"),
    [400, ...mutationCodes, 500],
    "ADMIN only. Strict template/preset/mode validation. Appearance fields only; preserves general, role and OAuth settings. Requires trusted Origin and application/json; settings mutation rate limit applies.",
    "protected",
    "Appearance",
  ),
};

paths["/api/admin/settings/appearance/catalog"] = {
  get: operation(
    "listAppearanceTemplates",
    "Settings",
    "List selectable website templates and style variants",
    ref("AppearanceCatalog"),
    [401, 403, 500],
    "ADMIN only. Returns the API release's supported renderers, with each template's default and available presets.",
    "protected",
  ),
};

paths["/api/admin/navigation"] = {
  get: operation(
    "listNavigationMenus",
    "Settings",
    "List menus",
    ref("NavigationMenuList"),
    [401, 403, 500],
    "ADMIN only.",
    "protected",
  ),
  post: operation(
    "mutateNavigationMenu",
    "Settings",
    "Create, replace or delete a menu",
    ref("NavigationMenuResult"),
    [400, ...mutationCodes, 409, 500],
    "ADMIN only. Replaces the menu snapshot atomically. Updates and deletions require the expected version.",
    "protected",
    "NavigationMenuMutation",
  ),
};

const navigationCreate = paths["/api/admin/navigation"].post;

if (navigationCreate) {
  navigationCreate.responses[201] = navigationCreate.responses[200];
}

paths["/api/admin/page-hierarchy"] = {
  get: operation(
    "readPageHierarchy",
    "Content",
    "List Pages for hierarchy management",
    ref("PageHierarchy"),
    [401, 403, 500],
    "ADMIN and EDITOR only.",
    "protected",
  ),
  put: operation(
    "updatePageHierarchy",
    "Content",
    "Move or reorder a Page",
    ref("PageHierarchyResult"),
    [400, ...mutationCodes, 404, 409, 500],
    "ADMIN and EDITOR only. Requires the previously read parent and sibling order.",
    "protected",
    "PageHierarchyMutation",
  ),
};

export const openApiDocument: OpenAPIV3.Document = {
  openapi: "3.0.3",
  info: {
    title: "NextPress API",
    version,
    description:
      "First-party admin-host HTTP API. Contract version follows the admin package. Better Auth owns /api/auth/* (session, credential and OAuth flows), excluded from this contract. Docs visibility does not enforce endpoint security. JSON Schema cannot express all custom refinements; runtime validation remains authoritative.",
  },
  tags: ["Health", "Content", "Tags", "Users", "Settings"].map((name) => ({
    name,
  })),
  paths,
  components: {
    schemas,
    securitySchemes: {
      sessionCookie: {
        type: "apiKey",
        in: "cookie",
        name: "better-auth.session_token",
        description:
          "Better Auth signed HttpOnly session cookie on local HTTP. Sign in using the admin application.",
      },
      secureSessionCookie: {
        type: "apiKey",
        in: "cookie",
        name: "__Secure-better-auth.session_token",
        description:
          "Better Auth signed HttpOnly session cookie on HTTPS. Role checks are server-side.",
      },
    },
  },
};
