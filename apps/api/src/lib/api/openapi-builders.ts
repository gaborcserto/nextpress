import { MediaInputMimeSchema } from "@nextpress/shared/media";
import { z } from "zod";

import type { OpenAPIV3 } from "openapi-types";

// Input mode preserves the wire shape before defaults and transforms run.
export function schema(value: z.ZodType) {
  const { $schema, ...result } = z.toJSONSchema(value, {
    io: "input",
    target: "openapi-3.0",
  });
  void $schema;
  // Zod types cover multiple JSON Schema dialects. The explicit OpenAPI target
  // and openapi:validate check establish this narrower library boundary.
  return result as OpenAPIV3.SchemaObject;
}

export const integer = { type: "integer" } as const;

export const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });

const errors: Record<number, string> = {
  400: "Invalid JSON, parameters or payload; content validation may include issues.",
  401: "Authentication required.",
  403: "Role or ownership restriction, or untrusted mutation Origin.",
  404: "Resource missing or hidden by content read scope.",
  409: "Resource conflict, stale revision, referenced media, writer maintenance, or last-administrator protection.",
  413: "Request body exceeds 5,000,000 bytes.",
  415: "Mutation Content-Type must be application/json.",
  429: "Application mutation rate limit reached.",
  500: "Unexpected error.",
  503: "Private draft admission disabled or isolated database identity unverifiable.",
};

function response(
  description: string,
  value: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject,
): OpenAPIV3.ResponseObject {
  return { description, content: { "application/json": { schema: value } } };
}

export function operation(
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
      description: "Validated image",
      content: Object.fromEntries(
        MediaInputMimeSchema.options.map((mime) => [mime, { schema: result }]),
      ),
    };
  }

  for (const code of codes) {
    responses[code] = response(errors[code], ref("Error"));

    if (code === 429) {
      responses[code].headers = {
        "Retry-After": { description: "Seconds until retry.", schema: integer },
      };
    }
  }

  if (operationId !== "health") {
    for (const item of Object.values(responses)) {
      if (!("$ref" in item)) {
        item.headers = {
          ...item.headers,
          "X-Request-Id": {
            description:
              "Opaque request identifier for support and server log correlation.",
            schema: { type: "string", format: "uuid" },
          },
        };
      }
    }
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

export function parameter(
  name: string,
  location: "path" | "query",
  value: OpenAPIV3.SchemaObject,
  description: string,
  required = location === "path",
): OpenAPIV3.ParameterObject {
  return { name, in: location, required, schema: value, description };
}
