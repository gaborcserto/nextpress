import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const screen = readFileSync(
  resolve(process.cwd(), "src/components/admin/MenusScreen/MenusScreen.tsx"),
  "utf8",
);
const styles = readFileSync(
  resolve(
    process.cwd(),
    "src/components/admin/MenusScreen/MenusScreen.module.css",
  ),
  "utf8",
);

describe("menu row presentation", () => {
  it("uses publication status alone for collapsed title and border colors", () => {
    expect(screen).toContain('destination?.status === "PUBLISHED"');
    expect(screen).toContain('destination?.status === "DRAFT"');
    expect(screen).not.toContain(
      'destination?.systemPage\n            ? "system"',
    );
    expect(styles).toContain('data-status="published"');
    expect(styles).toContain('data-status="draft"');
    expect(styles).not.toContain('data-status="system"');
  });

  it("places visibility before the rightmost expansion control in a full-width header", () => {
    const dragHandle = screen.indexOf("FaGripVertical");
    const title = screen.indexOf("styles.menuItemName}", dragHandle);
    const itemKind = screen.indexOf("styles.menuItemKind}", title);
    const visibility = screen.indexOf('className="menu-visibility', itemKind);
    const expansion = screen.indexOf('className="menu-expansion', visibility);

    expect(dragHandle).toBeGreaterThanOrEqual(0);
    expect(title).toBeGreaterThan(dragHandle);
    expect(itemKind).toBeGreaterThan(title);
    expect(visibility).toBeGreaterThan(itemKind);
    expect(expansion).toBeGreaterThan(visibility);
    expect(styles).toContain("display: flex");
    expect(styles).toContain(
      ".accordionHeader > :global(div:has(> .menu-visibility)) {\n  order: 5",
    );
    expect(styles).toContain(
      ".accordionHeader > :global(.menu-expansion) {\n  order: 6",
    );
    expect(styles).not.toContain("position: absolute");
  });
});
