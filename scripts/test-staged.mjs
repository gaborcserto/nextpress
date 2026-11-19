import { execFileSync, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
// These tests scan source from disk, outside Vitest's module graph.
const sourceScans = [
  [
    /^apps\/admin\/src\/(?!.*\.test\.).+\.[cm]?[jt]sx?$/,
    "apps/admin/src/lib/api/boundary.test.ts",
  ],
  [
    /^apps\/web\/src\/(?!.*\.test\.).+\.[cm]?[jt]sx?$/,
    "apps/web/src/lib/content/boundary.test.ts",
  ],
  [
    /^apps\/api\/src\/app\/api\/.*\/route\.ts$/,
    "apps/api/src/lib/api/openapi.test.ts",
  ],
];
const moduleFile = /\.[cm]?[jt]sx?$/;
const rootConfig =
  /^(?:package(?:-lock)?\.json|tsconfig[^/]*\.json|(?:vitest|vite)\.config\.[^/]+)$/;

export function projectTests(staged, manifests) {
  const directoriesByName = new Map(
    [...manifests].map(([directory, manifest]) => [manifest.name, directory]),
  );
  const removedManifests = staged.filter(
    ({ file, status }) =>
      status === "D" && /^(?:apps|packages)\/[^/]+\/package\.json$/.test(file),
  );

  return [...manifests].flatMap(([directory, manifest]) => {
    if (!/^vitest\b/.test(manifest.scripts?.test ?? "")) {
      return [];
    }

    const inputs = new Set([directory]);

    for (const input of inputs) {
      const {
        dependencies,
        devDependencies,
        optionalDependencies,
        peerDependencies,
      } = manifests.get(input);

      for (const name of Object.keys({
        ...dependencies,
        ...devDependencies,
        ...optionalDependencies,
        ...peerDependencies,
      })) {
        const dependency = directoriesByName.get(name);

        if (dependency) {
          inputs.add(dependency);
        }
      }
    }

    const inputDirectories = [
      ...inputs,
      ...removedManifests.map(({ file }) => path.posix.dirname(file)),
    ];
    const changes = staged.filter(
      ({ file }) =>
        rootConfig.test(file) ||
        (inputDirectories.some((input) => file.startsWith(`${input}/`)) &&
          !/\.(?:md|mdx)$/.test(file)),
    );

    if (!changes.length && !removedManifests.length) {
      return [];
    }

    // Deleted paths, setup files and non-module inputs may have no Vite graph edge.
    const fallback =
      removedManifests[0] ??
      changes.find(
        ({ file, status }) =>
          status === "D" ||
          status === "T" ||
          !moduleFile.test(file) ||
          /\/(?:vite|vitest)(?:[./-]|$)/.test(file),
      );

    const related = changes.map(({ file }) => file);

    for (const [pattern, testFile] of sourceScans) {
      if (related.some((file) => pattern.test(file))) {
        related.push(testFile);
      }
    }

    return [{ directory, inputs: inputDirectories, related, fallback }];
  });
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.length === 1 && args[0] === "--dry-run";

  if (args.length && !dryRun) {
    throw new Error("Usage: node scripts/test-staged.mjs [--dry-run]");
  }

  const gitOutput = (...args) =>
    execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    });

  const git = (...args) =>
    gitOutput(...args)
      .split("\0")
      .slice(0, -1);

  // Model renames as removal plus addition so old import paths trigger fallback.
  const diff = git("diff", "--cached", "--name-status", "--no-renames", "-z");
  const staged = [];

  for (let index = 0; index < diff.length; index += 2) {
    staged.push({ status: diff[index], file: diff[index + 1] });
  }

  const manifestFiles = git(
    "ls-files",
    "-z",
    "--",
    ":(glob)apps/*/package.json",
    ":(glob)packages/*/package.json",
  );
  const manifests = new Map(
    manifestFiles.map((file) => [
      path.posix.dirname(file),
      JSON.parse(gitOutput("show", `:${file}`)),
    ]),
  );
  const selection = projectTests(staged, manifests);

  if (!selection.length) {
    console.log(dryRun ? "[]" : "[test:staged] No Vitest projects affected.");

    return;
  }

  const unstaged = [
    ...git("diff", "--name-only", "--no-renames", "-z"),
    ...git("ls-files", "--others", "--exclude-standard", "-z"),
  ];
  const conflicting = unstaged.filter(
    (file) =>
      rootConfig.test(file) ||
      selection.some(({ inputs }) =>
        inputs.some((input) => file.startsWith(`${input}/`)),
      ),
  );

  if (conflicting.length) {
    throw new Error(
      `Affected tests require the staged snapshot. Stage or set aside these changes before retrying:\n${conflicting.join("\n")}`,
    );
  }

  if (dryRun) {
    console.log(JSON.stringify(selection, null, 2));

    return;
  }

  const require = createRequire(import.meta.url);
  const vitest = path.join(
    path.dirname(require.resolve("vitest/package.json")),
    "vitest.mjs",
  );

  for (const { directory, related, fallback } of selection) {
    const cwd = path.join(root, directory);
    const args = fallback
      ? ["run"]
      : [
          "related",
          "--run",
          "--passWithNoTests",
          ...new Set(related.map((file) => path.join(root, file))),
        ];
    const reason = fallback
      ? `project suite because ${fallback.file} may be outside Vitest's import graph`
      : `tests related to ${related.join(", ")}`;

    console.log(`[test:staged] ${directory}: ${reason}`);
    const result = spawnSync(
      process.execPath,
      [vitest, ...args, "--coverage.enabled=false", "--reporter=default"],
      { cwd, stdio: "inherit" },
    );

    if (result.error) {
      throw result.error;
    }

    if (result.status !== 0) {
      process.exitCode = result.status ?? 1;

      return;
    }
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
