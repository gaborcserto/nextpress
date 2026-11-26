import dropdownStyles from "@/components/public-ui/PublicDropdown.module.css";
import { UiText } from "@/lib/i18n/client";
import { getMessage } from "@/lib/i18n/messages";
import { getLocale } from "@/lib/i18n/server";

import styles from "../../BlogShell/BlogShell.module.css";
import { MenuDisclosure } from "../MenuDisclosure/MenuDisclosure";
import { NavigationLink } from "../NavigationLink/NavigationLink";

import type { PublicMenuItem } from "@nextpress/shared/api-contracts";

export async function MenuTree({
  items,
  dropdown = false,
}: {
  items: PublicMenuItem[];
  dropdown?: boolean;
}) {
  const locale = await getLocale();
  const branches = new Map<number | null, number[]>();

  items.forEach(({ parent }, index) => {
    const siblings = branches.get(parent) ?? [];
    siblings.push(index);
    branches.set(parent, siblings);
  });

  function renderBranch(parent: number | null) {
    const dropdownItems = dropdown && parent !== null;

    return (
      <ul
        className={`${parent === null ? styles.navigation : styles.submenu} ${
          dropdown && parent !== null ? dropdownStyles.panel : ""
        }`}
      >
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
                <NavigationLink
                  href={href}
                  newTab={newTab}
                  className={dropdownItems ? dropdownStyles.item : undefined}
                >
                  {title}
                </NavigationLink>
              ) : href ? (
                <a
                  className={dropdownItems ? dropdownStyles.item : undefined}
                  href={href}
                  target={target}
                  rel={newTab ? "noopener noreferrer" : undefined}
                >
                  {title}
                </a>
              ) : (
                !nested && <span>{title}</span>
              )}
              {nested && (
                <MenuDisclosure
                  label={`${getMessage(locale, "navigation.openSubmenu")} ${label}`}
                  title={href ? null : title}
                  showChevron={Boolean(href)}
                >
                  {renderBranch(index)}
                </MenuDisclosure>
              )}
            </li>
          );
        })}
      </ul>
    );
  }

  return renderBranch(null);
}
