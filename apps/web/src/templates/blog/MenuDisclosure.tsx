"use client";

import { useEffect, useRef, useState } from "react";

import styles from "./BlogShell.module.css";

import type {
  KeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react";

export function MenuDisclosure({
  label,
  title,
  children,
  align = "center",
  showChevron = true,
}: {
  label?: string;
  title: ReactNode;
  children: ReactNode;
  align?: "start" | "center" | "end";
  showChevron?: boolean;
}) {
  const disclosure = useRef<HTMLDetailsElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  function positionPanel() {
    const current = disclosure.current;
    const panel = current?.querySelector<HTMLElement>(":scope > ul");

    if (!current?.open || !panel) {
      return;
    }

    const bounds = panel.getBoundingClientRect();
    const align =
      bounds.left < 8
        ? "start"
        : bounds.right > window.innerWidth - 8
          ? "end"
          : current.dataset.align;

    current.dataset.collisionAlign = align;
  }

  useEffect(() => {
    function closeOnOutsideClick(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !disclosure.current?.contains(event.target)
      ) {
        if (disclosure.current) {
          disclosure.current.open = false;
        }
      }
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    window.addEventListener("resize", positionPanel);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      window.removeEventListener("resize", positionPanel);
    };
  }, []);

  function keepOneDropdownOpen() {
    const current = disclosure.current;

    if (!current?.open) {
      return;
    }

    const siblingList = current.closest("li")?.parentElement;

    siblingList?.querySelectorAll("details[open]").forEach((other) => {
      if (
        other !== current &&
        other.closest("li")?.parentElement === siblingList
      ) {
        other.removeAttribute("open");
      }
    });
  }

  function handleToggle() {
    setIsOpen(disclosure.current?.open ?? false);
    positionPanel();
    keepOneDropdownOpen();
  }

  function closeOnEscape(event: KeyboardEvent<HTMLDetailsElement>) {
    const details = event.currentTarget;

    if (event.key === "Escape" && details.open) {
      event.stopPropagation();
      details.open = false;
      details.querySelector("summary")?.focus();
    }
  }

  function openOnDesktopHover(event: ReactPointerEvent<HTMLDetailsElement>) {
    if (
      event.pointerType === "mouse" &&
      window.matchMedia("(min-width: 56rem)").matches &&
      disclosure.current
    ) {
      disclosure.current.open = true;
    }
  }

  function closeAfterDesktopHover(
    event: ReactPointerEvent<HTMLDetailsElement>,
  ) {
    const current = disclosure.current;

    if (
      event.pointerType === "mouse" &&
      window.matchMedia("(min-width: 56rem)").matches &&
      current &&
      !current.contains(document.activeElement)
    ) {
      current.open = false;
    }
  }

  return (
    <details
      ref={disclosure}
      data-align={align}
      data-chevron={showChevron}
      className={styles.menuDisclosure}
      onKeyDown={closeOnEscape}
      onToggle={handleToggle}
      onPointerEnter={openOnDesktopHover}
      onPointerLeave={closeAfterDesktopHover}
    >
      <summary aria-label={label} aria-expanded={isOpen}>
        {title}
      </summary>
      {children}
    </details>
  );
}
