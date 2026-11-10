import {
  existsSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  realpathSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

const directory = process.argv[2];

if (!directory)
  throw new Error(
    "Usage: node scripts/scan-artifacts.mjs <packaged-directory>",
  );
const root = fileURLToPath(new URL("../", import.meta.url));
const artifactRoot = realpathSync(path.resolve(directory));
const sources = [process.env];

for (const file of [
  "apps/api/.env",
  "apps/admin/.env",
  "apps/web/.env",
  "packages/db/.env",
]) {
  const source = path.join(root, file);

  if (existsSync(source)) sources.push(parseEnv(readFileSync(source, "utf8")));
}
const secretValues = [
  ...new Set(
    sources.flatMap((source) =>
      Object.entries(source)
        .filter(
          ([key, value]) =>
            /SECRET|PASSWORD|TOKEN|DATABASE_URL|PRIVATE_KEY/.test(key) &&
            typeof value === "string" &&
            value.length >= 12,
        )
        .map(([, value]) => value),
    ),
  ),
];
const needles = secretValues
  .flatMap((value) => [
    value,
    JSON.stringify(value).slice(1, -1),
    encodeURIComponent(value),
  ])
  .map((value) => Buffer.from(value));
let files = 0;
const violations = [];

function scan(folder) {
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const file = path.join(folder, entry.name);

    if (entry.isSymbolicLink()) {
      const target = realpathSync(file);

      if (
        path.isAbsolute(readlinkSync(file)) ||
        (target !== artifactRoot && !target.startsWith(artifactRoot + path.sep))
      )
        throw new Error(
          "Packaged artifact contains a nonportable or escaping symbolic link",
        );
      // Its real target is scanned through the ordinary directory traversal.
      continue;
    }
    if (entry.isDirectory()) {
      scan(file);
      continue;
    }
    files++;
    const bytes = readFileSync(file);

    if (
      entry.name.startsWith(".env") ||
      needles.some((needle) => bytes.includes(needle)) ||
      /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----(?:\r?\n|\\n|\\r\\n)(?:[A-Za-z0-9+/=]+(?:\r?\n|\\n|\\r\\n))+-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(
        bytes.toString("utf8"),
      )
    )
      violations.push(file);
  }
}

scan(artifactRoot);
if (violations.length) {
  console.error(
    `Artifact secret check failed in ${violations.length} files. Values are redacted.`,
  );
  for (const file of violations) console.error(file);
  process.exitCode = 1;
} else
  console.log(
    `Artifact secret check passed: ${files} files; no environment files, known configured secrets or private keys found.`,
  );
