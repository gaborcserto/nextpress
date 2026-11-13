import { AppearanceSchema } from "@nextpress/shared";
import {
  PublicSearchQuerySchema,
  PublicSearchResultSchema,
  ApiErrorSchema,
  TagSchema,
  TagWithUsageSchema,
  ContentRecordSchema,
  ContentListSchema,
  EditorialPageSchema,
  EditorialPostSchema,
  PublicContentSchema,
  PublicTaxonomyBatchSchema,
  PublicTagBatchSchema,
  PublicTaxonomyParamsSchema,
  PublicPostBatchSchema,
  PublicNavigationSchema,
  PublicSiteSettingsSchema,
  PublicPaginationSchema,
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
  MediaMetadataSchema,
  MediaUploadSchema,
} from "@nextpress/shared/media";
import {
  RevisionActionSchema,
  RevisionInputSchema,
  RevisionListSchema,
  RevisionRecordSchema,
} from "@nextpress/shared/revisions";
import { z } from "zod";

import { OAUTH_PROVIDERS } from "@/lib/auth/oauth-providers";
import { ROLES } from "@/lib/auth/roles";
import {
  PageSchema,
  PageUpdateSchema,
  TagCreateSchema,
  TagIdsSchema,
} from "@/lib/validation";

import { version } from "../../../package.json";

import type { OpenAPIV3 } from "openapi-types";

// Input mode preserves the wire shape before defaults and transforms run.
function schema(value: z.ZodType) {
  const { $schema, ...result } = z.toJSONSchema(value, {
    io: "input",
    target: "openapi-3.0",
  });
  void $schema;
  // Zod types cover multiple JSON Schema dialects. The explicit OpenAPI target
  // and openapi:validate check establish this narrower library boundary.
  return result as OpenAPIV3.SchemaObject;
}

const string = { type: "string" } as const;
const boolean = { type: "boolean" } as const;
const integer = { type: "integer" } as const;
const nullableString = { type: "string", nullable: true } as const;
const date = { type: "string", format: "date-time" } as const;

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });

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
const provider = schema(z.enum(OAUTH_PROVIDERS));
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
const providerInput = object(
  {
    provider,
    enabled: boolean,
    clientId: { ...string, maxLength: 2000 },
    clientSecret: {
      ...string,
      maxLength: 10000,
      writeOnly: true,
      description:
        "Omit or leave blank to retain the stored secret. Never returned.",
    },
  },
  ["provider", "enabled", "clientId"],
);
const settingsProperties = {
  siteName: { ...string, maxLength: 200 },
  siteDescription: { ...string, maxLength: 1000 },
  siteUrl: { ...string, maxLength: 2000 },
  ogImageUrl: { ...string, maxLength: 2000 },
  defaultUserRole: role,
  postListingMode: {
    ...string,
    enum: ["PAGINATION", "LOAD_MORE"],
    description: "Public post archive navigation mode.",
  },
  postsPerPage: {
    type: "integer" as const,
    minimum: 1,
    maximum: 50,
    description: "Number of posts in each page or Load more batch.",
  },
};

const schemas: Record<string, OpenAPIV3.SchemaObject> = {
  MediaUpload: schema(MediaUploadSchema),
  RevisionInput: schema(RevisionInputSchema),
  RevisionAction: schema(RevisionActionSchema),
  RevisionList: schema(RevisionListSchema),
  RevisionRecord: schema(RevisionRecordSchema),
  MediaMetadata: schema(MediaMetadataSchema),
  PublicContentIndex: schema(PublicContentIndexSchema),
  Health: object({ status: { type: "string", enum: ["ok"] } }),
  Error: schema(ApiErrorSchema),
  Success: object({ ok: { type: "boolean", enum: [true] } }),
  DeletedTag: object({ message: string }),
  Tag: schema(TagSchema),
  TagWithUsage: schema(TagWithUsageSchema),
  TagCreate: schema(TagCreateSchema),
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
  ParentOptions: array(
    object({ id: string, title: string, parentId: nullableString }),
  ),
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
  SettingsUpdate: object({
    ...settingsProperties,
    oauthProviders: {
      ...array(providerInput),
      minItems: OAUTH_PROVIDERS.length,
      maxItems: OAUTH_PROVIDERS.length,
    },
  }),
  Settings: object({
    ...settingsProperties,
    oauthProviders: array(
      object({
        provider,
        enabled: boolean,
        clientId: string,
        hasClientId: boolean,
        hasClientSecret: boolean,
        operational: boolean,
      }),
    ),
  }),
};

const errors: Record<number, string> = {
  400: "Invalid JSON, parameters or payload; content validation may include issues.",
  401: "Session missing or role disallowed (both currently return 401).",
  403: "Untrusted mutation Origin or content ownership restriction.",
  404: "Resource missing or hidden by content read scope.",
  409: "Resource conflict, stale revision, referenced media, or last-administrator protection.",
  413: "Request body exceeds 5,000,000 bytes.",
  415: "Mutation Content-Type must be application/json.",
  429: "Application mutation rate limit reached.",
  500: "Unexpected error. Collection content reads may instead return a framework error response.",
};

function response(
  description: string,
  value: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject,
): OpenAPIV3.ResponseObject {
  return { description, content: { "application/json": { schema: value } } };
}

function operation(
  operationId: string,
  tag: string,
  summary: string,
  result: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject,
  codes: number[],
  description: string,
  access: "public" | "optional" | "protected" = "public",
  body?: string,
  success = 200,
): OpenAPIV3.OperationObject {
  const responses: OpenAPIV3.ResponsesObject = {
    [success]: response("Success", result),
  };

  if ("format" in result && result.format === "binary") {
    responses[success] = {
      description: "PNG image",
      content: { "image/png": { schema: result } },
    };
  }

  for (const code of codes) {
    responses[code] =
      code === 500 && ["listPages", "listPosts"].includes(operationId)
        ? { description: errors[code] }
        : response(errors[code], ref("Error"));
    if (code === 429)
      responses[code].headers = {
        "Retry-After": { description: "Seconds until retry.", schema: integer },
      };
  }

  return {
    operationId,
    tags: [tag],
    summary,
    description,
    responses,
    security:
      access === "public"
        ? []
        : access === "optional"
          ? [{}, { sessionCookie: [] }, { secureSessionCookie: [] }]
          : [{ sessionCookie: [] }, { secureSessionCookie: [] }],
    ...(body
      ? {
          requestBody: {
            required: true,
            content: { "application/json": { schema: ref(body) } },
          },
        }
      : {}),
  };
}

function parameter(
  name: string,
  location: "path" | "query",
  value: OpenAPIV3.SchemaObject,
  description: string,
  required = location === "path",
): OpenAPIV3.ParameterObject {
  return { name, in: location, required, schema: value, description };
}

const id = parameter(
  "id",
  "path",
  string,
  "Resource ID; content GET also accepts a slug.",
);
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
      "Upload validated PNG or JPEG",
      ref("MediaMetadata"),
      [400, ...mutationCodes, 500],
      "JSON base64 upload, maximum 2 MiB decoded and 16 million pixels. Signature and full decoder validation; normalized to PNG. No client paths or filenames accepted. ADMIN/EDITOR/AUTHOR only.",
      "protected",
      "MediaUpload",
      201,
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
      "Private media requires an editor/admin or owning author session. No-store; PNG only.",
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
        "Authenticated ADMIN/EDITOR or owning AUTHOR only. Private no-store. Preview requires explicit revisionId; public delivery is never overridden.",
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
      "Requires exact revisionId and expectedVersion. Restore creates a new draft and never publishes. Author publishing rights remain scoped to owned content.",
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

for (const [path, result, operationId] of [
  ["public/posts", "PublicPostBatch", "publicPosts"],
  ["public/posts/{slug}", "PublicContent", "publicPost"],
  ["public/pages/{slug}", "PublicContent", "publicPage"],
  ["public/navigation", "PublicNavigation", "publicNavigation"],
  ["public/settings", "PublicSiteSettings", "publicSettings"],
  ["discovery/session", "SessionDiscovery", "sessionDiscovery"],
  ["discovery/providers", "ProviderDiscovery", "providerDiscovery"],
]) {
  const read = operation(
    operationId,
    "Delivery and discovery",
    operationId,
    ref(result),
    path.includes("{slug}")
      ? [404, 500]
      : path === "public/posts"
        ? [400, 500]
        : [500],
    path.startsWith("public/")
      ? "Cookie-independent delivery. Only PUBLISHED content with explicit publication time at or before the request is visible. Uncached."
      : "Same-origin discovery; session identity is validated by Better Auth and roles read live. No tokens or credentials returned.",
    path === "discovery/session" ? "optional" : "public",
  );

  if (path.includes("{slug}"))
    read.parameters = [
      parameter("slug", "path", string, "Canonical content slug."),
    ];
  if (path === "public/posts")
    read.parameters = Object.entries(PublicPaginationSchema.shape).map(
      ([key, value]) =>
        parameter(
          key,
          "query",
          schema(value),
          "Single bounded decimal integer; duplicates rejected.",
        ),
    );
  paths[`/api/${path}`] = { get: read };
}
const publishedTags = operation(
  "publicTags",
  "Delivery and discovery",
  "Tags assigned to publicly published posts",
  ref("PublicTagBatch"),
  [400, 500],
  "Cookie-independent, uncached delivery. Only TAG definitions assigned to POST/PUBLISHED records with a non-null publication time at or before now are listed. Unique tags ordered by slug, bounded limit-plus-one pagination. Duplicate, unknown and malformed query parameters are rejected. No draft-only, scheduled-only, unassigned or page-only tags.",
  "public",
);
publishedTags.parameters = Object.entries(PublicPaginationSchema.shape).map(
  ([key, value]) =>
    parameter(key, "query", schema(value), "Single bounded decimal integer."),
);
paths["/api/public/tags"] = { get: publishedTags };

const taxonomyArchive = operation(
  "publicTaxonomyPosts",
  "Delivery and discovery",
  "Published posts assigned to a category or tag",
  ref("PublicTaxonomyBatch"),
  [400, 404, 500],
  "Cookie-independent, uncached delivery. Taxonomy definitions have no privacy state. Only POST/PUBLISHED records with non-null publication time at or before now are included. Missing or invalid type/slug returns 404; existing empty definitions return an empty batch. Bounded newest-first pagination; duplicate or unknown query parameters rejected.",
  "public",
);
taxonomyArchive.parameters = [
  ...Object.entries(PublicTaxonomyParamsSchema.shape).map(([key, value]) =>
    parameter(
      key,
      "path",
      schema(value),
      "Taxonomy type (CATEGORY or TAG) and canonical slug.",
    ),
  ),
  ...Object.entries(PublicPaginationSchema.shape).map(([key, value]) =>
    parameter(key, "query", schema(value), "Single bounded decimal integer."),
  ),
];
paths["/api/public/taxonomies/{type}/{slug}"] = { get: taxonomyArchive };

for (const [path, kind, detail] of [
  ["pages", "Page", "PageDetail"],
  ["post", "Post", "PostDetail"],
]) {
  const list = operation(
    `list${kind}s`,
    "Content",
    `List ${path}`,
    path === "pages"
      ? { anyOf: [ref("ContentList"), ref("ParentOptions")] }
      : ref("ContentList"),
    [400, 500],
    readScope,
    "optional",
  );
  list.parameters =
    path === "pages"
      ? [
          ...pagination,
          parameter(
            "select",
            "query",
            { ...string, enum: ["parent"] },
            "Parent options (at most 500), bypasses pagination. Other values or duplicates rejected.",
          ),
        ]
      : pagination;
  paths[`/api/${path}`] = {
    get: list,
    post: operation(
      `create${kind}`,
      "Content",
      `Create ${kind.toLowerCase()}`,
      ref("ContentRecord"),
      [400, ...mutationCodes, 409, 500],
      `${writeScope} Content and excerpt are serialized RichDocument JSON strings, not editor arrays. Unknown fields are stripped.`,
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
      `${writeScope} Partial update despite PUT; expectedVersion from editorial GET workingVersion is required. Missing versions return 400; stale versions return 409 without writing. Content type cannot change. Unknown fields are stripped.`,
      "protected",
      `${kind}Update`,
    ),
    delete: operation(
      `delete${kind}`,
      "Content",
      `Delete ${kind.toLowerCase()}`,
      ref("Success"),
      [...mutationCodes, 404, 500],
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
    [400, ...mutationCodes, 500],
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
      [400, ...mutationCodes, 404, 500],
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
    [400, ...mutationCodes, 404, 500],
    writeScope,
    "protected",
    "TagLinks",
  ),
};
paths["/api/admin/tags"] = {
  get: operation(
    "listTagsWithUsage",
    "Tags",
    "List tags and usage counts",
    array(ref("TagWithUsage")),
    [401, 403, 500],
    "ADMIN, EDITOR or AUTHOR; at most 500 tags.",
    "protected",
  ),
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
  delete: operation(
    "deleteAdminTag",
    "Tags",
    "Delete a tag from administration",
    ref("DeletedTag"),
    [400, ...mutationCodes, 404, 500],
    "ADMIN or EDITOR. Requires trusted Origin.",
    "protected",
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
    "ADMIN only. Initializes missing settings/provider rows. Credential presence flags are returned; secrets are never returned.",
    "protected",
  ),
  put: operation(
    "updateSettings",
    "Settings",
    "Update administration settings",
    ref("Success"),
    [400, ...mutationCodes, 500],
    "ADMIN only. Listing mode is PAGINATION or LOAD_MORE and postsPerPage is an integer from 1 to 50. Nonblank siteName; URLs must be empty or HTTP(S). Supply exactly one entry per supported OAuth provider. Enabled providers require operational credentials. Requires trusted Origin and application/json.",
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

const search = operation(
  "publicSearch",
  "Delivery and discovery",
  "Search published posts and pages",
  schema(PublicSearchResultSchema),
  [400, 500],
  "Uncached public search. Published-at or before now only. Ten results per page, up to page 100; 200-character query. Title matches rank first; newest and slug break ties. Taxonomies come only from published posts. Duplicate and unknown parameters rejected.",
  "public",
);
search.parameters = Object.entries(PublicSearchQuerySchema.shape).map(
  ([key, value]) =>
    parameter(key, "query", schema(value), "Validated search parameter."),
);
paths["/api/public/search"] = { get: search };

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
