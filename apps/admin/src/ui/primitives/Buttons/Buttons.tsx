"use client";

import Link from "next/link";

import type {
  AdminAsyncButtonProps,
  AdminButtonProps,
  AdminIconButtonProps,
  AdminToggleButtonProps,
  ButtonAppearance,
  LinkButtonProps,
  LinkIconButtonProps,
  NativeAdminButtonProps,
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
}: ButtonAppearance) {
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
    className,
  );
}

function BaseButton({
  className,
  variant,
  color,
  size,
  fullWidth,
  wide,
  type = "button",
  ...props
}: NativeAdminButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={buildClasses({
        variant,
        color,
        size,
        fullWidth,
        wide,
        className,
      })}
    />
  );
}

export function AdminButton({
  icon: Icon,
  iconSize = 16,
  children,
  ...props
}: AdminButtonProps) {
  return (
    <BaseButton {...props}>
      {Icon && <Icon size={iconSize} aria-hidden="true" />}
      {children}
    </BaseButton>
  );
}

export function AdminIconButton({
  icon,
  shape = "square",
  className,
  ...props
}: AdminIconButtonProps) {
  return (
    <AdminButton
      {...props}
      icon={icon}
      className={cx(
        "admin-icon-button",
        shape === "circle" && "btn-circle",
        className,
      )}
    />
  );
}

export function AdminToggleButton({
  pressed,
  ...props
}: AdminToggleButtonProps) {
  if (props.children === undefined) {
    return <AdminIconButton {...props} aria-pressed={pressed} />;
  }

  return <AdminButton {...props} aria-pressed={pressed} />;
}

export function AdminAsyncButton({
  icon: Icon,
  iconSize = 16,
  children,
  loading,
  loadingLabel,
  disabled,
  ...props
}: AdminAsyncButtonProps) {
  const hasLoadingLabel = loadingLabel != null;
  const hasSeparateLoadingState = hasLoadingLabel || !Icon;
  const showLoadingState = loading && hasSeparateLoadingState;
  // Both states keep their grid space so translated loading labels do not resize the button.
  const spinner = loading && (
    <span
      className="loading loading-spinner size-4 shrink-0"
      style={
        hasSeparateLoadingState
          ? undefined
          : { inlineSize: iconSize, blockSize: iconSize }
      }
      aria-hidden="true"
    />
  );

  return (
    <BaseButton
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      <span className="admin-async-button-content">
        <span
          className="admin-async-button-state"
          aria-hidden={showLoadingState || undefined}
        >
          {!hasSeparateLoadingState && Icon && (
            <span className="admin-async-button-indicator" aria-hidden="true">
              <Icon
                size={iconSize}
                style={{ visibility: loading ? "hidden" : undefined }}
              />
              {spinner}
            </span>
          )}
          {hasLoadingLabel && Icon && (
            <Icon size={iconSize} aria-hidden="true" />
          )}
          {children}
        </span>
        {hasSeparateLoadingState && (
          <span className="admin-async-button-state" aria-hidden={!loading}>
            <span className="size-4 shrink-0" aria-hidden="true">
              {spinner}
            </span>
            {loadingLabel ?? children}
          </span>
        )}
      </span>
    </BaseButton>
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
      className={cx(classes, "admin-link-icon-button")}
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
