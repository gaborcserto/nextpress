import { emailSchema, passwordSchema, MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH } from "@nextpress/shared/auth-policy";
import { ContentLayoutSchema, RichBlocksSchema, RichDocumentSchema } from "@nextpress/shared/content";
import { z } from "zod";

import { version } from "../../../package.json";
import { OAUTH_PROVIDERS } from "@/lib/auth/oauth-providers";
import { ROLES } from "@/lib/auth/roles";
import { PageSchema, PageUpdateSchema, TagCreateSchema, TagIdsSchema } from "@/lib/validation";
import type { OpenAPIV3 } from "openapi-types";

// Input mode preserves the wire shape before defaults and transforms run.
function schema(value: z.ZodType) {
  const { $schema, ...result } = z.toJSONSchema(value, { io: "input", target: "openapi-3.0" });
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
const nullableDate = { type: "string", nullable: true, format: "date-time" } as const;
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const array = (items: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject) => ({ type: "array", items } as const);
function object(properties: Record<string, OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject>, required = Object.keys(properties)) {
  return { type: "object", properties, ...(required.length ? { required } : {}) } as const;
}
const role = schema(z.enum(ROLES));
const provider = schema(z.enum(OAUTH_PROVIDERS));
const status = schema(PageSchema.shape.status);
const contentType = schema(PageSchema.shape.type);
const tagProperties = { id: string, name: string, slug: string };
const roleRelation: OpenAPIV3.SchemaObject = { anyOf: [object({ name: string }), { type: "object", nullable: true, enum: [null] }] };
const userProperties = { id: string, email: string, name: nullableString, role: roleRelation, roleName: nullableString };
const formProperties = {
  status, slug: string, title: string, content: ref("RichBlocks"), tags: array(ref("Tag")),
};
const providerInput = object({
  provider, enabled: boolean, clientId: { ...string, maxLength: 2000 },
  clientSecret: { ...string, maxLength: 10000, writeOnly: true, description: "Omit or leave blank to retain the stored secret. Never returned." },
}, ["provider", "enabled", "clientId"]);
const settingsProperties = {
  siteName: { ...string, maxLength: 200 }, siteDescription: { ...string, maxLength: 1000 },
  siteUrl: { ...string, maxLength: 2000 }, ogImageUrl: { ...string, maxLength: 2000 }, defaultUserRole: role,
  postListingMode: { ...string, enum: ["PAGINATION", "LOAD_MORE"], description: "Public post archive navigation mode." },
  postsPerPage: { type: "integer" as const, minimum: 1, maximum: 50, description: "Number of posts in each page or Load more batch." },
};

const schemas: Record<string, OpenAPIV3.SchemaObject> = {
  Health: object({ status: { type: "string", enum: ["ok"] } }),
  Error: object({ error: string, issues: array(object({ path: nullableString, message: string })) }, ["error"]),
  Success: object({ ok: { type: "boolean", enum: [true] } }),
  DeletedTag: object({ message: string }),
  Tag: object(tagProperties),
  TagWithUsage: object({ ...tagProperties, usedCount: integer }),
  TagCreate: schema(TagCreateSchema),
  TagLinks: { anyOf: [schema(TagIdsSchema), object({ tagIds: schema(TagIdsSchema) })], description: "Array or object with required tagIds; IDs must be unique and refer to TAG taxonomies. An empty array clears assignments." },
  RichBlocks: schema(RichBlocksSchema),
  RichDocument: schema(RichDocumentSchema),
  PageCreate: schema(PageSchema.extend({ type: z.literal("PAGE") })),
  PostCreate: schema(PageSchema.extend({ type: z.literal("POST") })),
  PageUpdate: schema(PageUpdateSchema.extend({ type: z.literal("PAGE").optional() })),
  PostUpdate: schema(PageUpdateSchema.extend({ type: z.literal("POST").optional() })),
  ContentRecord: object({
    id: string, type: contentType, status, slug: string, title: string, excerpt: nullableString,
    content: string, layout: schema(ContentLayoutSchema), coverId: nullableString, authorId: nullableString,
    publishedAt: nullableDate, inHeaderMenu: boolean, inFooterMenu: boolean, parentId: nullableString,
    listingKind: { type: "string", nullable: true, enum: ["POSTS", "PRODUCTS", "EVENTS", null] },
    listingTaxonomyId: nullableString, eventStart: nullableDate, eventEnd: nullableDate,
    eventLocation: nullableString, registrationUrl: nullableString, redirectTo: nullableString,
    viewCount: integer, uniqueViewCount: integer, likeCount: integer, lastViewedAt: nullableDate,
    createdAt: date, updatedAt: date,
  }),
  ContentList: object({
    items: array(object({ id: string, type: contentType, status, slug: string, title: string, excerpt: nullableString, updatedAt: date })),
    page: integer, limit: integer, total: integer, pages: integer,
  }),
  ParentOptions: array(object({ id: string, title: string, parentId: nullableString })),
  PageDetail: object({ item: object({
    ...formProperties, type: schema(ContentLayoutSchema), parentId: nullableString,
    inHeaderMenu: boolean, inFooterMenu: boolean,
    listingKind: { type: "string", nullable: true, enum: ["POSTS", "PRODUCTS", "EVENTS", null] },
    listingTaxonomyId: nullableString, eventStart: nullableDate, eventEnd: nullableDate,
    eventLocation: nullableString, registrationUrl: nullableString, redirectTo: nullableString,
  }) }),
  PostDetail: object({ item: object({
    ...formProperties, excerpt: ref("RichBlocks"), publishedAt: nullableDate,
    cover: { anyOf: [object({ id: string, url: string, alt: nullableString }), { type: "object", nullable: true, enum: [null] }] },
  }) }),
  UserCreate: object({
    email: schema(emailSchema), name: { ...nullableString, maxLength: 200 }, role,
    password: { ...schema(passwordSchema), writeOnly: true, description: `Optional credential password. Shared password policy: at least ${MIN_PASSWORD_LENGTH} Unicode code points, at most ${MAX_PASSWORD_LENGTH} UTF-16 units, no lone surrogates; never trimmed.` },
  }, ["email"]),
  CreatedUser: object(userProperties),
  Users: array(object({ ...userProperties, emailVerified: boolean, createdAt: date, updatedAt: date })),
  RoleUpdate: object({ role }),
  UpdatedRole: object({ id: string, roleName: nullableString }),
  SettingsUpdate: object({
    ...settingsProperties,
    oauthProviders: { ...array(providerInput), minItems: OAUTH_PROVIDERS.length, maxItems: OAUTH_PROVIDERS.length },
  }),
  Settings: object({
    ...settingsProperties, oauthProviders: array(object({
      provider, enabled: boolean, clientId: string, hasClientId: boolean, hasClientSecret: boolean, operational: boolean,
    })),
  }),
};

const errors: Record<number, string> = {
  400: "Invalid JSON, parameters or payload; content validation may include issues.",
  401: "Session missing or role disallowed (both currently return 401).",
  403: "Untrusted mutation Origin or content ownership restriction.",
  404: "Resource missing or hidden by content read scope.",
  409: "Slug or email conflict.",
  413: "Request body exceeds 5,000,000 bytes.",
  415: "Mutation Content-Type must be application/json.",
  429: "Application mutation rate limit reached.",
  500: "Unexpected error. Collection content reads may instead return a framework error response.",
};

function response(description: string, value: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject): OpenAPIV3.ResponseObject {
  return { description, content: { "application/json": { schema: value } } };
}
function operation(
  operationId: string, tag: string, summary: string, result: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject,
  codes: number[], description: string, access: "public" | "optional" | "protected" = "public", body?: string, success = 200,
): OpenAPIV3.OperationObject {
  const responses: OpenAPIV3.ResponsesObject = { [success]: response("Success", result) };
  for (const code of codes) {
    responses[code] = code === 500 && ["listPages", "listPosts"].includes(operationId)
      ? { description: errors[code] }
      : response(errors[code], ref("Error"));
    if (code === 429) responses[code].headers = { "Retry-After": { description: "Seconds until retry.", schema: integer } };
  }
  return {
    operationId, tags: [tag], summary, description, responses,
    security: access === "public" ? [] : access === "optional" ? [{}, { sessionCookie: [] }, { secureSessionCookie: [] }] : [{ sessionCookie: [] }, { secureSessionCookie: [] }],
    ...(body ? { requestBody: { required: true, content: { "application/json": { schema: ref(body) } } } } : {}),
  };
}
function parameter(name: string, location: "path" | "query", value: OpenAPIV3.SchemaObject, description: string, required = location === "path"): OpenAPIV3.ParameterObject {
  return { name, in: location, required, schema: value, description };
}
const id = parameter("id", "path", string, "Resource ID; content GET also accepts a slug.");
const pagination = [
  parameter("page", "query", { ...integer, minimum: 1, maximum: 10000, default: 1 }, "Single decimal integer; duplicate parameters rejected."),
  parameter("limit", "query", { ...integer, minimum: 1, maximum: 100, default: 50 }, "Single decimal integer; duplicate parameters rejected."),
];
const mutationCodes = [401, 403, 413, 415, 429];
const readScope = "Anonymous and SUBSCRIBER readers see PUBLISHED content with no future publishedAt. AUTHOR also sees own drafts; ADMIN and EDITOR see all content.";
const writeScope = "ADMIN, EDITOR or AUTHOR. AUTHOR may update only owned content. Mutations require a trusted Origin and application/json; request body maximum 5,000,000 bytes.";
const paths: OpenAPIV3.PathsObject = {
  "/api/health": { get: operation("health", "Health", "Application liveness", ref("Health"), [], "Public, uncached application response. Does not check PostgreSQL or operational readiness.") },
};
for (const [path, kind, detail] of [["pages", "Page", "PageDetail"], ["post", "Post", "PostDetail"]]) {
  const list = operation(`list${kind}s`, "Content", `List ${path}`, path === "pages" ? { anyOf: [ref("ContentList"), ref("ParentOptions")] } : ref("ContentList"), [400, 500], readScope, "optional");
  list.parameters = path === "pages" ? [...pagination, parameter("select", "query", { ...string, enum: ["parent"] }, "Parent options (at most 500), bypasses pagination. Other values or duplicates rejected.")] : pagination;
  paths[`/api/${path}`] = {
    get: list,
    post: operation(`create${kind}`, "Content", `Create ${kind.toLowerCase()}`, ref("ContentRecord"), [400, ...mutationCodes, 409, 500], `${writeScope} Content and excerpt are serialized RichDocument JSON strings, not editor arrays. Unknown fields are stripped.`, "protected", `${kind}Create`, 201),
  };
  paths[`/api/${path}/{id}`] = {
    parameters: [id],
    get: operation(`read${kind}`, "Content", `Read ${kind.toLowerCase()} editor projection`, ref(detail), [404, 500], `${readScope} Returns {item} with rich-content arrays; this differs from mutation payloads.`, "optional"),
    put: operation(`update${kind}`, "Content", `Update ${kind.toLowerCase()}`, ref("ContentRecord"), [400, ...mutationCodes, 404, 409, 500], `${writeScope} Partial update despite PUT; content type cannot change. Unknown fields are stripped.`, "protected", `${kind}Update`),
    delete: operation(`delete${kind}`, "Content", `Delete ${kind.toLowerCase()}`, ref("Success"), [...mutationCodes, 404, 500], "ADMIN or EDITOR. Requires trusted Origin; bodyless DELETE needs no Content-Type.", "protected"),
  };
}
paths["/api/tags"] = {
  get: { ...operation("searchTags", "Tags", "Search tags", array(ref("Tag")), [400, 500], "Public. Queries shorter than two trimmed characters return []; at most 20 results."), parameters: [parameter("query", "query", { ...string, maxLength: 200, default: "" }, "Search by name or slug.")] },
  post: operation("createTag", "Tags", "Create or reuse a tag", ref("Tag"), [400, ...mutationCodes, 500], "ADMIN, EDITOR or AUTHOR. Existing case-insensitive name is reused with status 201.", "protected", "TagCreate", 201),
  delete: { ...operation("deleteTag", "Tags", "Delete a tag", ref("DeletedTag"), [400, ...mutationCodes, 404, 500], "ADMIN or EDITOR. Requires trusted Origin.", "protected"), parameters: [parameter("id", "query", { ...string, maxLength: 64 }, "Nonempty trimmed tag ID.", true)] },
};
paths["/api/tags/link"] = {
  parameters: [parameter("entityId", "query", { ...string, minLength: 1, maxLength: 64 }, "Nonempty trimmed page/post ID.", true)],
  get: operation("readTagLinks", "Tags", "Read assigned tags", array(ref("Tag")), [400, 403, 404, 500], readScope, "optional"),
  put: operation("replaceTagLinks", "Tags", "Replace assigned tags", ref("Success"), [400, ...mutationCodes, 404, 500], writeScope, "protected", "TagLinks"),
};
paths["/api/admin/tags"] = { get: operation("listTagsWithUsage", "Tags", "List tags and usage counts", array(ref("TagWithUsage")), [401, 403, 500], "ADMIN, EDITOR or AUTHOR; at most 500 tags.", "protected") };
paths["/api/admin/tags/{id}"] = {
  parameters: [parameter("id", "path", string, "Nonempty trimmed tag ID; no route-level length limit.")],
  delete: operation("deleteAdminTag", "Tags", "Delete a tag from administration", ref("DeletedTag"), [400, ...mutationCodes, 404, 500], "ADMIN or EDITOR. Requires trusted Origin.", "protected"),
};
paths["/api/admin/users"] = { get: operation("listUsers", "Users", "List users", ref("Users"), [401, 403, 500], "ADMIN only. At most 500, newest first. No credential/session data returned.", "protected") };
paths["/api/admin/users/create"] = { post: operation("createUser", "Users", "Provision a user", ref("CreatedUser"), [400, ...mutationCodes, 409, 500], "ADMIN only. Omitted role uses the configured default user role. Password is optional. Requires trusted Origin and application/json.", "protected", "UserCreate", 201) };
paths["/api/admin/users/{id}"] = {
  parameters: [parameter("id", "path", { ...string, minLength: 1, maxLength: 64 }, "User ID.")],
  delete: operation("deleteUser", "Users", "Delete a user", ref("Success"), [400, ...mutationCodes, 404, 500], "ADMIN only. Requires trusted Origin.", "protected"),
};
paths["/api/admin/users/{id}/role"] = {
  parameters: [parameter("id", "path", { ...string, minLength: 1, maxLength: 64 }, "User ID.")],
  patch: operation("updateUserRole", "Users", "Assign a user role", ref("UpdatedRole"), [400, ...mutationCodes, 404, 500], "ADMIN only. Requires trusted Origin and application/json.", "protected", "RoleUpdate"),
};
paths["/api/admin/settings"] = {
  get: operation("readSettings", "Settings", "Read administration settings", ref("Settings"), [401, 403, 500], "ADMIN only. Initializes missing settings/provider rows. Credential presence flags are returned; secrets are never returned.", "protected"),
  put: operation("updateSettings", "Settings", "Update administration settings", ref("Success"), [400, ...mutationCodes, 500], "ADMIN only. Listing mode is PAGINATION or LOAD_MORE and postsPerPage is an integer from 1 to 50. Nonblank siteName; URLs must be empty or HTTP(S). Supply exactly one entry per supported OAuth provider. Enabled providers require operational credentials. Requires trusted Origin and application/json.", "protected", "SettingsUpdate"),
};

export const openApiDocument: OpenAPIV3.Document = {
  openapi: "3.0.3",
  info: {
    title: "NextPress API", version,
    description: "First-party admin-host HTTP API. Contract version follows the admin package. Better Auth owns /api/auth/* (session, credential and OAuth flows), excluded from this contract. Docs visibility does not enforce endpoint security. JSON Schema cannot express all custom refinements; runtime validation remains authoritative.",
  },
  tags: ["Health", "Content", "Tags", "Users", "Settings"].map((name) => ({ name })),
  paths,
  components: {
    schemas,
    securitySchemes: {
      sessionCookie: { type: "apiKey", in: "cookie", name: "better-auth.session_token", description: "Better Auth signed HttpOnly session cookie on local HTTP. Sign in using the admin application." },
      secureSessionCookie: { type: "apiKey", in: "cookie", name: "__Secure-better-auth.session_token", description: "Better Auth signed HttpOnly session cookie on HTTPS. Role checks are server-side." },
    },
  },
};
