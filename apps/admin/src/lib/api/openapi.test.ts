// @vitest-environment node
import SwaggerParser from "@apidevtools/swagger-parser";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { openApiDocument } from "./openapi";

const methods = ["get", "post", "put", "patch", "delete"] as const;
const apiRoot = new URL("../../app/api/", import.meta.url);

describe("OpenAPI contract", () => {
  it("validates the complete specification without external reference resolution", async () => {
    const validated = await SwaggerParser.validate(structuredClone(openApiDocument), {
      resolve: { external: false },
    });
    expect(validated.info.title).toBe("NextPress API");
  });

  it("covers every owned route method and excludes the delegated auth and docs handlers", () => {
    const expected: string[] = [];
    for (const file of readdirSync(apiRoot, { recursive: true, encoding: "utf8" })) {
      if (!file.endsWith("route.ts")) continue;
      const normalized = file.replaceAll("\\", "/");
      if (normalized === "auth/[...all]/route.ts" || normalized === "openapi/route.ts") continue;
      const path = `/api/${normalized.replace(/\/route\.ts$/, "").replace(/\[([^\]]+)\]/g, "{$1}")}`;
      const source = readFileSync(new URL(normalized, apiRoot), "utf8");
      for (const method of methods) {
        if (new RegExp(`export (?:async )?(?:function|const) ${method.toUpperCase()}\\b`).test(source)) {
          expected.push(`${method} ${path}`);
        }
      }
    }
    const documented = Object.entries(openApiDocument.paths).flatMap(([path, item]) =>
      methods.filter((method) => item?.[method]).map((method) => `${method} ${path}`),
    );
    expect(documented.sort()).toEqual(expected.sort());
    expect(existsSync(new URL("ping/route.ts", apiRoot))).toBe(false);
  });

  it("retains session security and the existing authorization/error behavior", () => {
    const read = openApiDocument.paths["/api/pages"]?.get;
    const write = openApiDocument.paths["/api/pages"]?.post;
    expect(read?.security).toContainEqual({});
    expect(write?.security).not.toContainEqual({});
    expect(write?.responses).toHaveProperty("401");
    expect(write?.responses).toHaveProperty("413");
    expect(write?.responses).toHaveProperty("415");
    expect(write?.responses).toHaveProperty("429");
    expect(openApiDocument.paths["/api/admin/users"]?.get?.responses).not.toHaveProperty("403");
    expect(openApiDocument.components?.securitySchemes).toEqual(expect.objectContaining({
      sessionCookie: expect.objectContaining({ in: "cookie", name: "better-auth.session_token" }),
      secureSessionCookie: expect.objectContaining({ in: "cookie", name: "__Secure-better-auth.session_token" }),
    }));
  });

  it("derives serialized content inputs while documenting the different editor projection", () => {
    const schemas = openApiDocument.components?.schemas;
    expect(schemas?.PageCreate).toMatchObject({
      properties: {
        type: { enum: ["PAGE"] }, title: { maxLength: 300 },
        content: { type: "string", maxLength: 1000000 },
        tagIds: { type: "array", maxItems: 100 },
      },
    });
    expect(schemas?.PageUpdate).not.toHaveProperty("required");
    expect(schemas?.PageDetail).toMatchObject({ properties: { item: { properties: { content: { $ref: "#/components/schemas/RichBlocks" } } } } });
  });
});
