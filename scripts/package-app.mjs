import { cpSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const app = process.argv[2];

if (!["api", "admin", "web"].includes(app)) {
  throw new Error(
    "Usage: node scripts/package-app.mjs <api|admin|web> <new-output-directory>",
  );
}
const destination = path.resolve(process.argv[3] || `.notes/artifacts/${app}`);

if (existsSync(destination))
  throw new Error("Output directory must not already exist.");
const source = path.resolve(`apps/${app}/.next/standalone`);

if (!existsSync(path.join(source, `apps/${app}/server.js`)))
  throw new Error("Build the application first.");
mkdirSync(destination, { recursive: true });
// Next traces local environment files too; never ship operator credentials.
cpSync(source, destination, {
  recursive: true,
  // Keep Next's relative external-package links portable after copying.
  verbatimSymlinks: true,
  filter: (file) => !path.basename(file).startsWith(".env"),
});
for (const directory of [".next/static", "public"]) {
  const assets = path.resolve(`apps/${app}/${directory}`);

  if (existsSync(assets))
    cpSync(assets, path.join(destination, `apps/${app}/${directory}`), {
      recursive: true,
    });
}
console.log(`Packaged ${app} at ${destination}`);
