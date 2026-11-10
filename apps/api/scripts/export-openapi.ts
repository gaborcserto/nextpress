import { openApiDocument } from "../src/lib/api/openapi";

process.stdout.write(`${JSON.stringify(openApiDocument, null, 2)}\n`);
