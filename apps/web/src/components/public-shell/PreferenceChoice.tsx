"use client";

import { useEffect, useId, useRef, useState } from "react";
import { IoCheckmarkOutline } from "react-icons/io5";

import styles from "./PreferenceChoice.module.css";

import type { FocusEvent, KeyboardEvent, ReactNode } from "react";
import type { IconType } from "react-icons";

type PreferenceOption = {
  value: string;
  label: string;
  mobileLabel?: string;
  lang?: string;
  icon?: IconType;
};

export function PreferenceChoice({
  label,
  value,
  options,
  icon,
  onChange,
}: {
  label: string;
  value: string;
  options: PreferenceOption[];
  icon: ReactNode;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    menu.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();

    function dismiss(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !container.current?.contains(event.target)
      ) {
        setOpen(false);
        trigger.current?.focus();
      }
    }

    function closeOnResize() {
      setOpen(false);
    }

    const breakpoint = window.matchMedia("(min-width: 56rem)");
    document.addEventListener("pointerdown", dismiss);
    breakpoint.addEventListener("change", closeOnResize);

    return () => {
      document.removeEventListener("pointerdown", dismiss);
      breakpoint.removeEventListener("change", closeOnResize);
    };
  }, [open]);

  function selectOption(nextValue: string) {
    setOpen(false);
    trigger.current?.focus();
    onChange(nextValue);
  }

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setOpen(false);
    }
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      trigger.current?.focus();
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
    }
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const items = Array.from(
      menu.current?.querySelectorAll<HTMLButtonElement>("button") ?? [],
    );
    const index = items.findIndex((item) => item === document.activeElement);

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      trigger.current?.focus();
    } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      let next =
        event.key === "ArrowUp"
          ? (index - 1 + items.length) % items.length
          : (index + 1) % items.length;

      if (event.key === "Home") {
        next = 0;
      }
      if (event.key === "End") {
        next = items.length - 1;
      }

      items[next]?.focus();
    }
  }

  return (
    <>
      <div className={styles.desktop} ref={container} onBlur={handleBlur}>
        <button
          ref={trigger}
          type="button"
          className={styles.trigger}
          aria-label={label}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen(!open)}
          onKeyDown={handleTriggerKeyDown}
        >
          {icon}
        </button>
        {/* Keep the closed menu in SSR and hydration; CSS and inert handle its exit. */}
        <div
          ref={menu}
          id={id}
          role="menu"
          aria-label={label}
          className={styles.menu}
          data-open={open}
          aria-hidden={!open}
          inert={!open}
          onKeyDown={handleMenuKeyDown}
        >
          {options.map(
            ({ value: optionValue, label: optionLabel, lang, icon: Icon }) => (
              <button
                key={optionValue}
                type="button"
                role="menuitemradio"
                aria-checked={value === optionValue}
                tabIndex={-1}
                lang={lang}
                onClick={() => selectOption(optionValue)}
              >
                {Icon && <Icon aria-hidden="true" />}
                <span>{optionLabel}</span>
                <IoCheckmarkOutline
                  className={styles.check}
                  data-selected={value === optionValue}
                  aria-hidden="true"
                />
              </button>
            ),
          )}
        </div>
      </div>
      <fieldset className={styles.mobile}>
        <legend className="visually-hidden">{label}</legend>
        <span className={styles.mobileIcon} aria-hidden="true">
          {icon}
        </span>
        <div className={styles.options}>
          {options.map(
            ({
              value: optionValue,
              label: optionLabel,
              mobileLabel,
              lang,
              icon: Icon,
            }) => (
              <button
                type="button"
                key={optionValue}
                lang={lang}
                aria-pressed={value === optionValue}
                onClick={() => onChange(optionValue)}
              >
                {Icon && <Icon aria-hidden="true" />}
                <span>{mobileLabel ?? optionLabel}</span>
                <IoCheckmarkOutline
                  className={styles.check}
                  data-selected={value === optionValue}
                  aria-hidden="true"
                />
              </button>
            ),
          )}
        </div>
      </fieldset>
    </>
  );
}
