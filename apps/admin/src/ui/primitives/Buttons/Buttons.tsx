"use client";

import Link from "next/link";

import type {
  BaseProps,
  ButtonProps,
  IconButtonProps,
  LinkButtonProps,
  LinkIconButtonProps,
} from "./Buttons.types";

const cx = (...xs: Array<string | false | undefined>) =>
  xs.filter(Boolean).join(" ");

const COLOR_MAP: Record<string, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  accent: "btn-accent",
  neutral: "btn-neutral",
  info: "btn-info",
  success: "btn-success",
  warning: "btn-warning",
  error: "btn-error",
  default: "",
};

function buildClasses({
  variant = "solid",
  color = "default",
  size = "md",
  fullWidth,
  wide,
  active,
  className,
}: Pick<
  BaseProps,
  "variant" | "color" | "size" | "fullWidth" | "wide" | "active" | "className"
>) {
  const base = "btn admin-button";

  const sizeCls =
    size === "xs"
      ? "btn-xs"
      : size === "sm"
        ? "btn-sm"
        : size === "lg"
          ? "btn-lg"
          : size === "xl"
            ? "btn-xl"
            : "";

  const colorCls = COLOR_MAP[color ?? "primary"] ?? "";

  const varCls =
    variant === "outline"
      ? "btn-outline"
      : variant === "ghost"
        ? "btn-ghost"
        : variant === "link"
          ? "btn-link"
          : variant === "soft"
            ? "btn-soft"
            : variant === "dashed"
              ? "btn-dash"
              : "";

  const fullWidthCls = fullWidth ? "btn-block" : "";
  const wideCls = wide ? "btn-wide" : "";
  const activeCls = active ? "btn-active" : "";

  return cx(
    base,
    sizeCls,
    colorCls,
    varCls,
    fullWidthCls,
    wideCls,
    activeCls,
    "inline-flex items-center justify-center gap-2",
    className,
  );
}

function BaseButton({
  children,
  className,
  loading,
  variant,
  color,
  size,
  fullWidth,
  wide,
  active,
  ...domProps
}: BaseProps) {
  const { disabled: disabledProp, type: typeProp, ...restDomProps } = domProps;
  const isDisabled = !!disabledProp || !!loading;

  const classes = buildClasses({
    variant,
    color,
    size,
    fullWidth,
    wide,
    active,
    className,
  });

  return (
    <button
      type={typeProp ?? "button"}
      className={classes}
      aria-busy={!!loading}
      aria-pressed={typeof active === "boolean" ? active : undefined}
      disabled={isDisabled}
      {...restDomProps}
    >
      <span className="inline-flex min-w-0 items-center gap-2 [&>svg]:shrink-0">
        {children}
      </span>
    </button>
  );
}

export function Button(props: ButtonProps) {
  return <BaseButton {...props} />;
}

export function IconButton({
  icon: Icon,
  rightIcon: RightIcon,
  iconSize = 16,
  shape,
  children,
  className,
  loading,
  variant,
  color,
  size,
  fullWidth,
  wide,
  active,
  "aria-label": ariaLabel,
  ...domProps
}: IconButtonProps) {
  const { disabled: disabledProp, type: typeProp, ...restDomProps } = domProps;
  const isDisabled = !!disabledProp || !!loading;

  const classes = buildClasses({
    variant,
    color,
    size,
    fullWidth,
    wide,
    active,
    className,
  });

  const shapeCls =
    shape === "circle" ? "btn-circle" : shape === "square" ? "btn-square" : "";

  const content = (
    <>
      {loading && Icon ? (
        <span
          className="loading loading-spinner shrink-0"
          style={{ inlineSize: iconSize, blockSize: iconSize }}
          aria-hidden="true"
        />
      ) : (
        Icon && <Icon size={iconSize} aria-hidden="true" />
      )}
      {children && <span>{children}</span>}
      {RightIcon && <RightIcon size={iconSize} aria-hidden="true" />}
    </>
  );

  return (
    <button
      type={typeProp ?? "button"}
      className={cx(classes, "admin-icon-button", shapeCls)}
      aria-busy={!!loading}
      aria-pressed={typeof active === "boolean" ? active : undefined}
      aria-label={ariaLabel}
      disabled={isDisabled}
      {...restDomProps}
    >
      <span className="inline-flex min-w-0 items-center gap-2 [&>svg]:shrink-0">
        {content}
      </span>
    </button>
  );
}

/* ---------------- LinkButton ---------------- */

export function LinkButton({
  href,
  children,
  className,
  variant,
  color,
  size,
  fullWidth,
  wide,
  active,
  disabled,
  loading,
  onClick,
  tabIndex,
  ...anchorProps
}: LinkButtonProps) {
  const isDisabled = !!disabled || !!loading;

  const classes = buildClasses({
    variant,
    color,
    size,
    fullWidth,
    wide,
    active,
    className: cx(
      className,
      isDisabled && "btn-disabled pointer-events-none opacity-60",
    ),
  });

  return (
    <Link
      href={href}
      className={classes}
      aria-busy={loading || undefined}
      aria-disabled={isDisabled || undefined}
      tabIndex={isDisabled ? -1 : tabIndex}
      onClick={(e) => {
        if (isDisabled) {
          e.preventDefault();
          e.stopPropagation();

          return;
        }

        onClick?.(e);
      }}
      {...anchorProps}
    >
      <span className="inline-flex items-center gap-2">{children}</span>
    </Link>
  );
}

/* ---------------- LinkIconButton ---------------- */

export function LinkIconButton({
  href,
  icon: Icon,
  rightIcon: RightIcon,
  iconSize = 16,
  children,
  className,
  variant,
  color,
  size,
  fullWidth,
  wide,
  active,
  disabled,
  loading,
  onClick,
  tabIndex,
  "aria-label": ariaLabel,
  ...anchorProps
}: LinkIconButtonProps) {
  const isDisabled = !!disabled || !!loading;

  const classes = buildClasses({
    variant,
    color,
    size,
    fullWidth,
    wide,
    active,
    className: cx(
      className,
      isDisabled && "btn-disabled pointer-events-none opacity-60",
    ),
  });

  return (
    <Link
      href={href}
      className={cx(classes, "admin-icon-button")}
      aria-label={ariaLabel}
      aria-busy={loading || undefined}
      aria-disabled={isDisabled || undefined}
      tabIndex={isDisabled ? -1 : tabIndex}
      onClick={(e) => {
        if (isDisabled) {
          e.preventDefault();
          e.stopPropagation();

          return;
        }

        onClick?.(e);
      }}
      {...anchorProps}
    >
      <span className="inline-flex min-w-0 items-center gap-2 [&>svg]:shrink-0">
        {Icon && <Icon size={iconSize} aria-hidden="true" />}
        {children && <span>{children}</span>}
        {RightIcon && <RightIcon size={iconSize} aria-hidden="true" />}
      </span>
    </Link>
  );
}
