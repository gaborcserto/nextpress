"use client";

import Link from "next/link";

import type {
  BaseProps,
  ButtonProps,
  IconButtonProps,
  IconProps,
  LinkButtonProps,
  LinkIconButtonProps,
  Size,
} from "./Buttons.types";
import type { ReactNode } from "react";

const cx = (...xs: Array<string | false | undefined>) =>
  xs.filter(Boolean).join(" ");

/** DaisyUI/Tailwind classes **/
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
  const base = "btn";

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

  // color mapping
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
    className
  );
}

function spinnerSize(size?: Size) {
  return size === "xs"
    ? "loading-xs"
    : size === "sm"
      ? "loading-sm"
      : size === "lg" || size === "xl"
        ? "loading-lg"
        : "loading-md";
}

/* ---------------- BaseButton ---------------- */

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
}: BaseProps & Partial<IconProps>) {
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

  const content = (
    <span className="inline-flex items-center gap-2">
      {loading && (
        <>
          <span
            className={cx(
              "loading loading-spinner",
              spinnerSize(size)
            )}
            aria-hidden="true"
          />
          <span className="sr-only">Loading</span>
        </>
      )}
      {children}
    </span>
  );

  return (
    <button
      type={typeProp ?? "button"}
      className={classes}
      aria-busy={!!loading}
      aria-pressed={typeof active === "boolean" ? active : undefined}
      disabled={isDisabled}
      {...restDomProps}
    >
      {content}
    </button>
  );
}

/* ---------------- Button ---------------- */

export function Button(props: ButtonProps) {
  return <BaseButton {...props} />;
}

/* ---------------- IconButton ---------------- */

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
    shape === "circle"
      ? "btn-circle"
      : shape === "square"
        ? "btn-square"
        : "";

  let content: ReactNode;

  if (loading) {
    content = (
      <span className="inline-flex items-center gap-2">
        <span
          className={cx(
            "loading loading-spinner",
            spinnerSize(size)
          )}
          aria-hidden="true"
        />
        <span className="sr-only">Loading</span>
        {children && <span>{children}</span>}
      </span>
    );
  } else if (children) {
    content = (
      <span className="inline-flex items-center gap-2">
        {Icon && <Icon size={iconSize} />}
        <span>{children}</span>
        {RightIcon && <RightIcon size={iconSize} />}
      </span>
    );
  } else if (Icon) {
    content = <Icon size={iconSize} />;
  } else {
    content = null;
  }

  return (
    <button
      type={typeProp ?? "button"}
      className={cx(classes, shapeCls)}
      aria-busy={!!loading}
      aria-pressed={typeof active === "boolean" ? active : undefined}
      aria-label={ariaLabel}
      disabled={isDisabled}
      {...restDomProps}
    >
      {content}
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
  ...anchorProps
}: LinkButtonProps) {
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
    <Link href={href} className={classes} {...anchorProps}>
      <span className="inline-flex items-center gap-2">
        {children}
      </span>
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
  "aria-label": ariaLabel,
  ...anchorProps
}: LinkIconButtonProps) {
  const classes = buildClasses({
    variant,
    color,
    size,
    fullWidth,
    wide,
    active,
    className,
  });

  let content: ReactNode;

  if (children) {
    content = (
      <span className="inline-flex items-center gap-2">
        {Icon && <Icon size={iconSize} />}
        <span>{children}</span>
        {RightIcon && <RightIcon size={iconSize} />}
      </span>
    );
  } else if (Icon) {
    content = <Icon size={iconSize} />;
  } else {
    content = null;
  }

  return (
    <Link
      href={href}
      className={classes}
      aria-label={ariaLabel}
      {...anchorProps}
    >
      {content}
    </Link>
  );
}
