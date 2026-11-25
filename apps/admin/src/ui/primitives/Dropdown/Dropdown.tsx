"use client";

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import type {
  KeyboardEvent,
  MouseEvent as ReactMouseEvent,
  RefObject,
} from "react";

import type {
  DropdownAction,
  DropdownProps,
  DropdownTriggerProps,
  DropdownMenuProps,
  DropdownItemProps,
  DropdownLabelProps,
  DropdownDividerProps,
} from "./Dropdown.types";

const cx = (...xs: Array<string | false | undefined>) =>
  xs.filter(Boolean).join(" ");

type DropdownContextValue = {
  open: boolean;
  setOpen: (value: boolean) => void;
  menuId: string;
  triggerRef: RefObject<HTMLButtonElement | null>;
  menuRef: RefObject<HTMLUListElement | null>;
  actionRef: RefObject<DropdownAction | undefined>;
};

const DropdownContext = createContext<DropdownContextValue | null>(null);

function useDropdownContext() {
  const ctx = useContext(DropdownContext);

  if (!ctx) {
    throw new Error("Dropdown components must be used inside <Dropdown>.");
  }

  return ctx;
}

/* ---------------- Root <Dropdown> ---------------- */

export function Dropdown({
  children,
  align = "end",
  className,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const actionRef = useRef<DropdownAction>(undefined);
  const menuId = useId();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    menuRef.current
      ?.querySelector<HTMLElement>(
        ':is([role="menuitem"], [role="menuitemradio"]):not([disabled])',
      )
      ?.focus();
  }, [open]);

  useEffect(() => {
    function handleClickOutside(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !wrapperRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("pointerdown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("pointerdown", handleClickOutside);
    };
  }, [open]);

  const value: DropdownContextValue = {
    open,
    setOpen,
    menuId,
    triggerRef,
    menuRef,
    actionRef,
  };

  return (
    <DropdownContext.Provider value={value}>
      <div
        ref={wrapperRef}
        onBlur={(event) => {
          if (open && !event.currentTarget.contains(event.relatedTarget)) {
            setOpen(false);
          }
        }}
        className={cx("admin-dropdown", className)}
        data-align={align}
      >
        {children}
      </div>
    </DropdownContext.Provider>
  );
}

/* ---------------- <DropdownTrigger> ---------------- */

export function DropdownTrigger({
  children,
  className,
  ariaLabel,
  appearance = "default",
}: DropdownTriggerProps) {
  const { open, setOpen, menuId, triggerRef } = useDropdownContext();

  const handleClick = () => {
    setOpen(!open);
  };

  return (
    <button
      ref={triggerRef}
      type="button"
      className={cx(
        "btn",
        appearance === "primary" ? "btn-primary" : "btn-ghost",
        className,
      )}
      aria-haspopup="menu"
      aria-expanded={open}
      aria-controls={menuId}
      aria-label={ariaLabel}
      onClick={handleClick}
      onKeyDown={(event) => {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          setOpen(true);
        }
      }}
    >
      {children}
    </button>
  );
}

/* ---------------- <DropdownMenu> ---------------- */

export function DropdownMenu({
  children,
  className,
  "aria-label": ariaLabel,
  onAction,
}: DropdownMenuProps) {
  const { open, menuId, actionRef, menuRef, setOpen, triggerRef } =
    useDropdownContext();

  useEffect(() => {
    actionRef.current = onAction;

    return () => {
      actionRef.current = undefined;
    };
  }, [onAction, actionRef]);

  if (!open) {
    return null;
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>(
        ':is([role="menuitem"], [role="menuitemradio"]):not([disabled])',
      ) ?? [],
    );
    const index = items.indexOf(document.activeElement as HTMLElement);
    let nextIndex: number | undefined;

    if (event.key === "ArrowDown") {
      nextIndex = index < items.length - 1 ? index + 1 : 0;
    }

    if (event.key === "ArrowUp") {
      nextIndex = index > 0 ? index - 1 : items.length - 1;
    }

    if (event.key === "Home") {
      nextIndex = 0;
    }

    if (event.key === "End") {
      nextIndex = items.length - 1;
    }

    if (nextIndex !== undefined) {
      event.preventDefault();
      items[nextIndex]?.focus();
    } else if (event.key === "Escape" || event.key === "Tab") {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
      }

      setOpen(false);
      triggerRef.current?.focus();
    }
  };

  return (
    <ul
      id={menuId}
      ref={menuRef}
      role="menu"
      aria-label={ariaLabel}
      tabIndex={-1}
      className={cx("admin-dropdown-menu", className)}
      onKeyDown={handleKeyDown}
    >
      {children}
    </ul>
  );
}

/* ---------------- <DropdownItem> ---------------- */

export function DropdownItem({
  itemKey,
  startIcon,
  endIcon,
  color = "default",
  className,
  disabled,
  children,
  onClick,
  ...buttonProps
}: DropdownItemProps) {
  const { setOpen, actionRef, triggerRef } = useDropdownContext();

  const handleClick = (e: ReactMouseEvent<HTMLButtonElement>) => {
    if (disabled) {
      return;
    }

    onClick?.(e);
    actionRef.current?.(itemKey);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const colorCls = color === "danger" ? "text-error" : "";

  return (
    <li role="none">
      <button
        type="button"
        role="menuitem"
        tabIndex={-1}
        className={cx(
          "flex w-full items-center justify-between gap-2 px-3 py-2 min-h-11 rounded-(--radius-control) text-sm",
          "hover:bg-base-200",
          disabled && "opacity-50 pointer-events-none",
          colorCls,
          className,
        )}
        onClick={handleClick}
        disabled={disabled}
        {...buttonProps}
      >
        <span className="inline-flex items-center gap-2">
          {startIcon && <span aria-hidden="true">{startIcon}</span>}
          <span>{children}</span>
        </span>
        {endIcon && <span aria-hidden="true">{endIcon}</span>}
      </button>
    </li>
  );
}

/* ---------------- <DropdownLabel> ---------------- */

export function DropdownLabel({ children, className }: DropdownLabelProps) {
  return (
    <li
      className={cx("px-3 py-2 text-(--text-muted)", className)}
      role="presentation"
    >
      {children}
    </li>
  );
}

/* ---------------- <DropdownDivider> ---------------- */

export function DropdownDivider({ className }: DropdownDividerProps) {
  return (
    <li
      role="separator"
      className={cx("my-1 border-t border-base-300", className)}
    />
  );
}
