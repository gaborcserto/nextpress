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
  DropdownAction,
  DropdownProps,
  DropdownTriggerProps,
  DropdownMenuProps,
  DropdownItemProps,
  DropdownLabelProps,
  DropdownDividerProps,
} from "./Dropdown.types";
import type { MouseEvent as ReactMouseEvent } from "react";


const cx = (...xs: Array<string | false | undefined>) =>
  xs.filter(Boolean).join(" ");

type DropdownContextValue = {
  open: boolean;
  setOpen: (value: boolean) => void;
  menuId: string;
  onAction?: DropdownAction;
  setOnAction?: (fn?: DropdownAction) => void;
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

export function Dropdown({ children, align = "end", className }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [onAction, setOnAction] = useState<DropdownAction | undefined>();
  const menuId = useId();
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  const value: DropdownContextValue = {
    open,
    setOpen,
    menuId,
    onAction,
    setOnAction,
  };

  return (
    <DropdownContext.Provider value={value}>
      <div
        ref={wrapperRef}
        className={cx(
          "dropdown",
          align === "end" && "dropdown-end",
          open && "dropdown-open",
          className
        )}
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
}: DropdownTriggerProps) {
  const { open, setOpen, menuId } = useDropdownContext();

  const handleClick = () => {
    setOpen(!open);
  };

  return (
    <button
      type="button"
      className={cx("btn btn-ghost", className)}
      aria-haspopup="menu"
      aria-expanded={open}
      aria-controls={menuId}
      aria-label={ariaLabel}
      onClick={handleClick}
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
  const { open, menuId, setOnAction } = useDropdownContext();

  useEffect(() => {
    setOnAction?.(onAction);
    return () => setOnAction?.(undefined);
  }, [onAction, setOnAction]);

  if (!open) return null;

  return (
    <ul
      id={menuId}
      role="menu"
      aria-label={ariaLabel}
      tabIndex={0}
      className={cx(
        "dropdown-content menu bg-base-100 rounded-xl shadow border border-base-300 w-56 p-2",
        className
      )}
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
  const { setOpen, onAction } = useDropdownContext();

  const handleClick = (e: ReactMouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    onClick?.(e);
    onAction?.(itemKey);
    setOpen(false);
  };

  const colorCls = color === "danger" ? "text-error" : "";

  return (
    <li role="none">
      <button
        type="button"
        role="menuitem"
        className={cx(
          "flex w-full items-center justify-between gap-2 px-3 py-2 rounded-md text-sm",
          "hover:bg-base-200",
          disabled && "opacity-50 pointer-events-none",
          colorCls,
          className
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
      className={cx(
        "menu-title px-2 py-1 text-xs uppercase tracking-wide opacity-70",
        className
      )}
      role="presentation"
    >
      {children}
    </li>
  );
}

/* ---------------- <DropdownDivider> ---------------- */

export function DropdownDivider({ className }: DropdownDividerProps) {
  return (
    <li role="separator" className={cx("my-1", className)}>
      <div className="divider w-full my-0 gap-0 pointer-events-none" />
    </li>
  );
}
