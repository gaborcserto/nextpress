"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { IoClose, IoSearchOutline } from "react-icons/io5";

import { useLocale, useMessages } from "@/lib/i18n/client";
import { localizedHref } from "@/lib/i18n/routing";

import styles from "./HeaderSearch.module.css";

import type { FormEvent } from "react";

export function HeaderSearch() {
  const text = useMessages().search;
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [desktop, setDesktop] = useState(true);
  const [open, setOpen] = useState(false);
  const [previousPath, setPreviousPath] = useState(pathname);
  const [query, setQuery] = useState("");

  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    input.current?.focus();

    function dismiss(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !container.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", dismiss);

    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);

  useEffect(() => {
    const breakpoint = window.matchMedia("(min-width: 56rem)");

    function reset() {
      setDesktop(breakpoint.matches);
      setOpen(false);
    }

    reset();
    breakpoint.addEventListener("change", reset);

    return () => breakpoint.removeEventListener("change", reset);
  }, []);

  if (previousPath !== pathname) {
    setPreviousPath(pathname);
    setOpen(false);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submittedQuery = input.current?.value.trim() ?? "";

    if (!submittedQuery) {
      input.current?.focus();

      return;
    }

    container.current
      ?.closest("nav")
      ?.previousElementSibling?.querySelector<HTMLButtonElement>("button")
      ?.focus();
    router.push(
      localizedHref(
        `/search?${new URLSearchParams({ q: submittedQuery.replace(/\s+/g, " ") })}`,
        locale,
      ),
    );
    setOpen(false);
  }

  return (
    <div
      ref={container}
      className={styles.search}
      data-open={open}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <button
        ref={trigger}
        className={styles.trigger}
        type="button"
        aria-label={text.label}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        <IoSearchOutline aria-hidden="true" />
      </button>
      <form
        id={id}
        role="search"
        aria-label={text.label}
        className={styles.field}
        inert={desktop && !open}
        aria-hidden={desktop && !open ? true : undefined}
        action={`/${locale}/search`}
        onSubmit={submit}
      >
        <IoSearchOutline aria-hidden="true" />
        <input
          ref={input}
          name="q"
          type="search"
          aria-label={text.label}
          placeholder={text.placeholder}
          maxLength={200}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape" && query) {
              event.preventDefault();
              event.stopPropagation();
              setQuery("");
            }
          }}
        />
        {query && (
          <button
            type="button"
            className={styles.clear}
            aria-label={text.clear}
            onClick={() => {
              setQuery("");
              input.current?.focus();
            }}
          >
            <IoClose aria-hidden="true" />
          </button>
        )}
      </form>
    </div>
  );
}
