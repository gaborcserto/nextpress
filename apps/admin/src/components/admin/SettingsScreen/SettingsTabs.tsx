import {
  useState,
  useSyncExternalStore,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import styles from "./SettingsTabs.module.css";

const sections = [
  { id: "settings-general", label: "General" },
  { id: "settings-publishing", label: "Publishing" },
  { id: "settings-authentication", label: "Authentication" },
] as const;

type SectionId = (typeof sections)[number]["id"];
const selectionEvent = "nextpress-settings-selection";

function subscribe(listener: () => void) {
  window.addEventListener("hashchange", listener);
  window.addEventListener("popstate", listener);
  window.addEventListener(selectionEvent, listener);

  return () => {
    window.removeEventListener("hashchange", listener);
    window.removeEventListener("popstate", listener);
    window.removeEventListener(selectionEvent, listener);
  };
}

function defaultSection() {
  return sections[0].id;
}

function readSection() {
  if (window.location.hash === "#settings-appearance") {
    return defaultSection();
  }

  return (
    sections.find(({ id }) => window.location.hash === `#${id}`)?.id ??
    defaultSection()
  );
}

export function selectSettingsSection(id: string) {
  if (!sections.some((section) => section.id === id) || readSection() === id) {
    return;
  }

  window.history.pushState(null, "", `#${id}`);
  window.dispatchEvent(new Event(selectionEvent));
}

export function useSettingsSection() {
  return useSyncExternalStore(subscribe, readSection, defaultSection);
}

export function SettingsTabs({ active }: { active: SectionId }) {
  const [focused, setFocused] = useState<SectionId | null>(null);

  function moveFocus(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let target: number;

    switch (event.key) {
      case "ArrowLeft":
        target = (index + sections.length - 1) % sections.length;
        break;
      case "ArrowRight":
        target = (index + 1) % sections.length;
        break;
      case "Home":
        target = 0;
        break;
      case "End":
        target = sections.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    document.getElementById(`${sections[target].id}-tab`)?.focus();
  }

  function resetFocus(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setFocused(null);
    }
  }

  return (
    <div
      role="tablist"
      aria-label="Settings sections"
      className={styles.tabs}
      onBlur={resetFocus}
    >
      {sections.map(({ id, label }, index) => (
        <button
          key={id}
          id={`${id}-tab`}
          type="button"
          role="tab"
          aria-selected={id === active}
          aria-controls={id}
          tabIndex={id === (focused ?? active) ? 0 : -1}
          onFocus={() => setFocused(id)}
          onClick={() => selectSettingsSection(id)}
          onKeyDown={(event) => moveFocus(event, index)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

type SettingsPanelProps = {
  id: SectionId;
  active: SectionId;
  className?: string;
  children: ReactNode;
};

export function SettingsPanel({
  id,
  active,
  className,
  children,
}: SettingsPanelProps) {
  return (
    <div
      id={id}
      role="tabpanel"
      aria-labelledby={`${id}-tab`}
      tabIndex={0}
      hidden={id !== active}
      className={className}
    >
      {children}
    </div>
  );
}
