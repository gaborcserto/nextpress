import { describe, expect, it, vi } from "vitest";

import {
  ContentForbiddenError,
  ContentNotFoundError,
} from "@/lib/auth/content-access";
import { TaxonomyScopeError } from "@/lib/repos/tagRepo";
import {
  PageConflictError,
  PageValidationError,
} from "@/lib/services/content.shared";

import { contentMutationError } from "./content-mutation-error";

vi.mock("@nextpress/db/src/client", () => ({ prisma: {} }));

describe("legacy content mutation responses", () => {
  it.each([
    {
      operation: "create",
      failure: new ContentForbiddenError(),
      status: 403,
      body: { error: "Forbidden" },
    },
    {
      operation: "update",
      failure: new ContentNotFoundError(),
      status: 404,
      body: { error: "Not Found" },
    },
    {
      operation: "delete",
      failure: new ContentNotFoundError(),
      status: 404,
      body: { error: "Not Found" },
    },
    {
      operation: "create",
      failure: new TaxonomyScopeError(),
      status: 400,
      body: { error: "Invalid tag IDs" },
    },
    {
      operation: "update",
      failure: new PageValidationError([
        { path: "title", message: "Required" },
      ]),
      status: 400,
      body: {
        error: "Validation failed",
        issues: [{ path: "title", message: "Required" }],
      },
    },
    {
      operation: "create",
      failure: new PageConflictError(),
      status: 409,
      body: { error: "Slug already exists" },
    },
    {
      operation: "update",
      failure: new PageConflictError("Content changed; reload before saving"),
      status: 409,
      body: { error: "Content changed; reload before saving" },
    },
    {
      operation: "delete",
      failure: new Error("Internal detail"),
      status: 500,
      body: { error: "Unexpected error" },
    },
  ] as const)(
    "maps $operation failure to $status with $body.error",
    async ({ operation, failure, status, body }) => {
      const response = contentMutationError(failure, operation);

      expect(response.status).toBe(status);
      expect(await response.json()).toEqual(body);
    },
  );

  it("retains the persistence conflict response on delete", async () => {
    const response = contentMutationError({ code: "P2003" }, "delete");

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "Content is retained by references",
    });
  });
});
