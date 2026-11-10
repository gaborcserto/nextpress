import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export async function validateAgentResources(base = root) {
  const errors = [];
  let manifest;

  try {
    manifest = JSON.parse(
      await readFile(path.join(base, "package.json"), "utf8"),
    );
  } catch {
    return ["Cannot read root package.json"];
  }
  const scripts = new Set(Object.keys(manifest.scripts ?? {}));
  const resources = [".agents/README.md", "AGENTS.md"];

  async function collectMarkdown(directory) {
    for (const entry of await readdir(path.join(base, directory), {
      withFileTypes: true,
    })) {
      const filename = path.join(directory, entry.name);

      if (entry.isDirectory()) await collectMarkdown(filename);
      else if (entry.name.endsWith(".md")) resources.push(filename);
    }
  }

  await collectMarkdown(".agents");
  try {
    await readFile(path.join(base, "CLAUDE.md"));
    resources.push("CLAUDE.md");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const skillRoot = path.join(base, ".agents", "skills");

  for (const dirent of await readdir(skillRoot, { withFileTypes: true })) {
    if (!dirent.isDirectory()) continue;
    const filename = path.join(".agents", "skills", dirent.name, "SKILL.md");
    resources.push(filename);
    let body;

    try {
      body = await readFile(path.join(base, filename), "utf8");
    } catch {
      errors.push(`${filename}: missing SKILL.md`);
      continue;
    }
    const frontmatter = body
      .replace(/^\uFEFF/, "")
      .match(
        /^---\r?\nname: ([a-z0-9-]+)\r?\ndescription: ([^\r\n]+)\r?\n---(?:\r?\n|$)/,
      );

    if (!frontmatter) errors.push(`${filename}: invalid skill frontmatter`);
    else if (frontmatter[1] !== dirent.name)
      errors.push(
        `${filename}: skill name must match directory ${dirent.name}`,
      );
  }
  for (const filename of new Set(resources)) {
    let body;

    try {
      body = await readFile(path.join(base, filename), "utf8");
    } catch {
      continue;
    }
    const refs = [...body.matchAll(/\]\(([^)]+)\)/g)]
      .map((m) => m[1])
      .concat(
        [...body.matchAll(/(?:^|\s)(\.\.?\/[^\s`),]+)/gm)].map((m) => m[1]),
        [...body.matchAll(/^@([^\s]+)$/gm)].map((m) => m[1]),
      );

    for (const ref of refs) {
      if (/^(https?:|#)/.test(ref)) continue;
      const target = path.resolve(
        path.dirname(path.join(base, filename)),
        ref.split("#")[0],
      );

      try {
        await readFile(target);
      } catch {
        errors.push(`${filename}: missing local reference ${ref}`);
      }
    }
    for (const match of body.matchAll(/npm run ([a-zA-Z0-9:_-]+)/g)) {
      if (!scripts.has(match[1]))
        errors.push(`${filename}: unknown root npm script ${match[1]}`);
    }
  }
  const index = await readFile(path.join(base, ".agents/README.md"), "utf8");

  for (const match of index.matchAll(/`((?:skills|workflows)\/[^`]+)`/g)) {
    try {
      await readFile(path.join(base, ".agents", match[1]));
    } catch {
      errors.push(`.agents/README.md: missing resource ${match[1]}`);
    }
  }
  for (const match of index.matchAll(/npm run ([\w:-]+)/g))
    if (!scripts.has(match[1]))
      errors.push(`.agents/README.md: unknown root npm script ${match[1]}`);

  return [...new Set(errors)];
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const errors = await validateAgentResources();

  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else console.log("Agent resources are valid.");
}
