// Shared CI/local path policy. Turbo owns workspace dependency expansion.
export function selectChanges(
  files,
  { full = false, emptyIsFull = false } = {},
) {
  if (full) {
    return {
      mode: "full",
      reason: "Full verification requested or change detection unavailable.",
    };
  }

  if (!files.length) {
    return { mode: emptyIsFull ? "full" : "none", reason: "No changed files." };
  }

  const directories = new Set();
  let validateAgents = false;

  for (const file of files) {
    if (isDocumentationOnly(file)) {
      continue;
    }

    if (
      file === "AGENTS.md" ||
      file === "CLAUDE.md" ||
      file.startsWith(".agents/")
    ) {
      validateAgents = true;
      continue;
    }

    const directory =
      /^(apps\/(?:web|admin|api)|packages\/(?:db|shared|eslint-config))\//.exec(
        file,
      )?.[1];

    if (!directory) {
      return {
        mode: "full",
        reason: `Root configuration or unknown path: ${file}`,
      };
    }

    directories.add(directory);
  }

  return directories.size
    ? {
        mode: "affected",
        directories: [...directories].sort(),
        validateAgents,
        reason: "Changed workspaces and their Turbo dependents.",
      }
    : {
        mode: "none",
        validateAgents,
        reason: validateAgents
          ? "Only agent instructions or classified documentation changed."
          : "Only classified documentation changed.",
      };
}

function isDocumentationOnly(file) {
  if (/^(?:docs\/|\.github\/ISSUE_TEMPLATE\/)/.test(file)) {
    return /\.(?:md|mdx|png|jpe?g|gif|svg|webp|avif)$/i.test(file);
  }

  return /^(?:README\.md|(?:apps|packages)\/[^/]+\/README\.md)$/i.test(file);
}
