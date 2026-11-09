import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { validateAgentResources } from "./validate-agent-resources.mjs";

async function fixture(skill = "example", bom = false) {
  const root = await mkdtemp(path.join(os.tmpdir(), "agents-"));
  await mkdir(path.join(root, ".agents/skills", skill), { recursive: true });
  await mkdir(path.join(root, ".agents/workflows"), { recursive: true });
  await writeFile(
    path.join(root, "package.json"),
    JSON.stringify({ scripts: { lint: "true" } }),
  );
  await writeFile(
    path.join(root, "AGENTS.md"),
    "See [.agents/README.md](.agents/README.md)",
  );
  await writeFile(
    path.join(root, ".agents/README.md"),
    `- \`skills/${skill}/SKILL.md\`\n- \`workflows/change.md\`\n- npm run lint`,
  );
  await writeFile(path.join(root, ".agents/workflows/change.md"), "");
  const prefix = bom ? "\uFEFF" : "";
  await writeFile(
    path.join(root, `.agents/skills/${skill}/SKILL.md`),
    `${prefix}---\nname: ${skill}\ndescription: Example skill.\n---\nSee [root](../../../AGENTS.md) and npm run lint.`,
  );
  return root;
}

test("accepts BOM-free skill frontmatter", async () => {
  const root = await fixture();
  try {
    assert.deepEqual(await validateAgentResources(root), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("accepts actual UTF-8 BOM before valid skill frontmatter", async () => {
  const root = await fixture("example", true);
  try {
    assert.deepEqual(await validateAgentResources(root), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("reports invalid metadata, missing links, and unknown scripts", async () => {
  const root = await fixture();
  try {
    await writeFile(
      path.join(root, ".agents/skills/example/SKILL.md"),
      "---\nname: wrong\ndescription: ok\n---\n[missing](missing.md) npm run nope",
    );
    const errors = await validateAgentResources(root);
    assert.ok(errors.some((error) => error.includes("must match directory")));
    assert.ok(
      errors.some((error) => error.includes("missing local reference")),
    );
    assert.ok(
      errors.some((error) => error.includes("unknown root npm script nope")),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("validates workflow contents, nested references and Claude imports", async () => {
  const root = await fixture();
  try {
    await writeFile(
      path.join(root, ".agents/workflows/change.md"),
      "[missing](absent.md) npm run missing:workflow",
    );
    await mkdir(path.join(root, ".agents/skills/example/references"));
    await writeFile(
      path.join(root, ".agents/skills/example/references/detail.md"),
      "[invalid](absent.md) npm run missing:reference",
    );
    await writeFile(path.join(root, "CLAUDE.md"), "@absent.md\n");
    const errors = await validateAgentResources(root);
    for (const fragment of [
      "missing:workflow",
      "missing:reference",
      "CLAUDE.md: missing local reference absent.md",
      "change.md: missing local reference absent.md",
    ]) {
      assert.ok(
        errors.some((error) => error.includes(fragment)),
        fragment,
      );
    }
    await writeFile(path.join(root, "CLAUDE.md"), "@AGENTS.md\n");
    assert.ok(
      !(await validateAgentResources(root)).some((error) =>
        error.startsWith("CLAUDE.md:"),
      ),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
