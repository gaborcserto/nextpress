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

    if (isAgentResource(file)) {
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

function isAgentResource(file) {
  return (
    file === "AGENTS.md" || file === "CLAUDE.md" || file.startsWith(".agents/")
  );
}

function isDocumentationOnly(file) {
  if (/^(?:docs\/|\.github\/ISSUE_TEMPLATE\/)/.test(file)) {
    return /\.(?:md|mdx|png|jpe?g|gif|svg|webp|avif)$/i.test(file);
  }

  return /^(?:README\.md|(?:apps|packages)\/[^/]+\/README\.md)$/i.test(file);
}

// Only paths with an explicit integration exemption can bypass the rehearsals.
// Other workspace source still gets Turbo's reverse dependency selection.
const adminUnitTest = /^apps\/admin\/src\/.+(?<!\.integration)\.test\.tsx?$/;
const presentation = new Set([
  "apps/admin/src/ui/components/TabStrip.module.css",
  "apps/web/src/components/public-content/MediaGallery/GalleryEmpty.tsx",
]);
const mockedApi = "apps/api/src/lib/api/openapi.test.ts";
const knownSource =
  /^(?:apps\/(?:admin|api|web)\/(?:src|scripts)|packages\/(?:db|shared)\/src)\/.+\.(?:[cm]?[jt]sx?|css|json)$/;

export function selectCiChanges(files, options) {
  const selection = selectChanges(files, { emptyIsFull: true, ...options });
  const inputs = files.filter(
    (file) => !isDocumentationOnly(file) && !isAgentResource(file),
  );
  const full =
    selection.mode === "full" || inputs.some((file) => !knownSource.test(file));
  const mode = full ? "full" : selection.mode;
  const validate = mode !== "none";
  const unitOnly =
    mode === "affected" &&
    inputs.every((file) => adminUnitTest.test(file) || file === mockedApi);
  const integration =
    validate &&
    (full ||
      inputs.some(
        (file) =>
          !adminUnitTest.test(file) &&
          !presentation.has(file) &&
          file !== mockedApi,
      ));

  return {
    ...selection,
    mode,
    reason:
      full && selection.mode !== "full"
        ? "An input is outside the classified workspace source paths."
        : selection.reason,
    validateAgents: validate || selection.validateAgents === true,
    build: validate && !unitOnly,
    integration,
  };
}
