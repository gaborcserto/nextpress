import english from "../../../locales/en.json";
import hungarian from "../../../locales/hu.json";

export type Locale = "en" | "hu";
export const defaultLocale = "en";
export type MessageCatalog = typeof english;
export type MessageKey = {
  [
    Feature in keyof MessageCatalog
  ]: `${Feature}.${Extract<keyof MessageCatalog[Feature], string>}`;
}[keyof MessageCatalog];

export const en = english;
export const hu: MessageCatalog = hungarian;
export const messages = { en, hu };

function indexMessages(catalog: MessageCatalog): Map<string, string> {
  const index = new Map<string, string>();

  for (const [feature, entries] of Object.entries(catalog)) {
    for (const [key, value] of Object.entries(entries)) {
      index.set(`${feature}.${key}`, value);
    }
  }

  return index;
}

const messageIndexes = { en: indexMessages(en), hu: indexMessages(hu) };

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "hu";
}

export function getMessages(locale: unknown = defaultLocale): MessageCatalog {
  return isLocale(locale) ? messages[locale] : en;
}

export function getMessage(locale: unknown, key: MessageKey): string {
  const index = messageIndexes[isLocale(locale) ? locale : defaultLocale];

  return index.get(key) || messageIndexes.en.get(key) || key;
}

export function isColorMode(
  value: unknown,
): value is "light" | "dark" | "system" {
  return value === "light" || value === "dark" || value === "system";
}

export function loadedMessage(locale: Locale, count: number, page: number) {
  const template = getMessage(
    locale,
    count === 1 ? "posts.loadedOne" : "posts.loadedMany",
  );

  return template
    .replaceAll("{count}", String(count))
    .replaceAll("{page}", String(page));
}
