import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";

const requireFromHere = createRequire(import.meta.url);
const swaggerUiDistribution: unknown = requireFromHere("swagger-ui-dist");

const assets = {
  "swagger-ui-bundle.js": {
    fileName: "swagger-ui-bundle.js",
    contentType: "text/javascript; charset=utf-8",
  },
  "swagger-ui.css": {
    fileName: "swagger-ui.css",
    contentType: "text/css; charset=utf-8",
  },
} as const;

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ asset: string }> },
) {
  if (process.env.NODE_ENV !== "development") {
    return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  const { asset } = await context.params;
  const selectedAsset = asset === "swagger-ui-bundle.js"
    ? assets["swagger-ui-bundle.js"]
    : asset === "swagger-ui.css" ? assets["swagger-ui.css"] : null;
  if (!selectedAsset) {
    return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  if (
    typeof swaggerUiDistribution !== "object" ||
    swaggerUiDistribution === null ||
    !("getAbsoluteFSPath" in swaggerUiDistribution) ||
    typeof swaggerUiDistribution.getAbsoluteFSPath !== "function"
  ) {
    throw new Error("swagger-ui-dist does not expose its distribution path");
  }
  const distributionPath: unknown = swaggerUiDistribution.getAbsoluteFSPath();
  if (typeof distributionPath !== "string") {
    throw new Error("swagger-ui-dist returned an invalid distribution path");
  }

  const contents = await readFile(join(distributionPath, selectedAsset.fileName));
  const body = new Uint8Array(contents.byteLength);
  body.set(contents);

  return new Response(body, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": selectedAsset.contentType,
    },
  });
}
