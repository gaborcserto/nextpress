import { UiText } from "@/lib/i18n/client";

import styles from "./BlogShell.module.css";
import { MenuDisclosure } from "./MenuDisclosure";
import { NavigationLink } from "./NavigationLink";

import type { PublicMenuItem } from "@nextpress/shared/api-contracts";

export function MenuTree({
  items,
  dropdown = false,
}: {
  items: PublicMenuItem[];
  dropdown?: boolean;
}) {
  const branches = new Map<number | null, number[]>();

  items.forEach(({ parent }, index) => {
    const siblings = branches.get(parent) ?? [];
    siblings.push(index);
    branches.set(parent, siblings);
  });

  function renderBranch(parent: number | null) {
    return (
      <ul className={parent === null ? styles.navigation : styles.submenu}>
        {branches.get(parent)?.map((index) => {
          const item = items[index];

          if (!item) {
            return null;
          }

          const { label, href, newTab } = item;
          const title =
            label === href && href === "/" ? (
              <UiText id="navigation.home" />
            ) : label === href && href === "/posts" ? (
              <UiText id="navigation.posts" />
            ) : (
              label
            );

          const nested = branches.has(index);
          const target = newTab ? "_blank" : undefined;

          return (
            <li key={index} className={styles.menuItem}>
              {href?.startsWith("/") ? (
                <NavigationLink href={href} newTab={newTab}>
                  {title}
                </NavigationLink>
              ) : href ? (
                <a
                  href={href}
                  target={target}
                  rel={newTab ? "noopener noreferrer" : undefined}
                >
                  {title}
                </a>
              ) : (
                !dropdown && <span>{title}</span>
              )}
              {nested &&
                (dropdown ? (
                  <MenuDisclosure
                    label={href ? label : undefined}
                    title={href ? "▾" : title}
                  >
                    {renderBranch(index)}
                  </MenuDisclosure>
                ) : (
                  renderBranch(index)
                ))}
            </li>
          );
        })}
      </ul>
    );
  }

  return renderBranch(null);
}
