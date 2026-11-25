"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import styles from "./Tooltip.module.css";

type TooltipPhase = "closed" | "opening" | "open" | "closing";
type TooltipSide = "top" | "bottom";

type TooltipPosition = {
  left: number;
  top: number;
  side: TooltipSide;
  arrowLeft: number;
};

type TooltipProps = {
  id: string;
  as?: "div" | "span";
  className?: string;
  touchPreview?: boolean;
  content: ReactNode;
  enabled?: boolean;
  delayDuration?: number;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
};

const animationDuration = 120;

export function Tooltip({
  id,
  as: Trigger = "div",
  className,
  touchPreview = false,
  content,
  enabled = true,
  delayDuration = 250,
  onOpenChange,
  children,
}: TooltipProps) {
  const triggerRef = useRef<HTMLElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const pointerInside = useRef(false);
  const focusInside = useRef(false);
  const dismissed = useRef(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [phase, setPhase] = useState<TooltipPhase>("closed");
  const [position, setPosition] = useState<TooltipPosition | null>(null);
  const [previousEnabled, setPreviousEnabled] = useState(enabled);

  if (enabled !== previousEnabled) {
    setPreviousEnabled(enabled);

    if (!enabled) {
      setPhase("closed");
    }
  }

  const setTrigger = useCallback((element: HTMLElement | null) => {
    triggerRef.current = element;
  }, []);

  const clearHoverTimer = useCallback(() => {
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
  }, []);

  const showTooltip = useCallback(() => {
    if (!enabled || dismissed.current) {
      return;
    }

    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }

    onOpenChange?.(true);
    setPhase("opening");
  }, [enabled, onOpenChange]);

  const hideTooltip = useCallback(
    (animate = true) => {
      onOpenChange?.(false);
      setPhase((current) => {
        if (current === "closed") {
          return current;
        }

        return animate ? "closing" : "closed";
      });
    },
    [onOpenChange],
  );

  const scheduleClose = useCallback(() => {
    if (pointerInside.current || focusInside.current) {
      return;
    }

    dismissed.current = false;
    hideTooltip();
  }, [hideTooltip]);

  const scheduleHover = useCallback(() => {
    clearHoverTimer();
    hoverTimer.current = setTimeout(showTooltip, delayDuration);
  }, [clearHoverTimer, delayDuration, showTooltip]);

  useEffect(() => {
    if (!enabled) {
      clearHoverTimer();
      onOpenChange?.(false);
    }
  }, [clearHoverTimer, enabled, onOpenChange]);

  const positionTooltip = useCallback(() => {
    const triggerBounds = triggerRef.current?.getBoundingClientRect();
    const tooltipElement = tooltipRef.current;

    if (!triggerBounds || !tooltipElement) {
      return;
    }

    const tooltipBounds = tooltipElement.getBoundingClientRect();
    const viewportPadding = 8;
    const gap = 7;
    const center = triggerBounds.left + triggerBounds.width / 2;
    const left = Math.max(
      viewportPadding + tooltipBounds.width / 2,
      Math.min(
        center,
        window.innerWidth - viewportPadding - tooltipBounds.width / 2,
      ),
    );
    const aboveTop = triggerBounds.top - tooltipBounds.height - gap;
    const belowTop = triggerBounds.bottom + gap;
    const fitsAbove = aboveTop >= viewportPadding;
    const fitsBelow =
      belowTop + tooltipBounds.height <= window.innerHeight - viewportPadding;
    const side: TooltipSide = fitsAbove || !fitsBelow ? "top" : "bottom";
    const top =
      side === "top"
        ? Math.max(viewportPadding, aboveTop)
        : Math.min(
            belowTop,
            window.innerHeight - tooltipBounds.height - viewportPadding,
          );

    const arrowLeft = Math.max(
      8,
      Math.min(
        center - (left - tooltipBounds.width / 2),
        tooltipBounds.width - 8,
      ),
    );

    setPosition({ left, top, side, arrowLeft });
  }, []);

  useEffect(() => {
    if (phase === "opening") {
      const frame = window.requestAnimationFrame(() => setPhase("open"));

      return () => window.cancelAnimationFrame(frame);
    }

    if (phase === "closing") {
      closeTimer.current = setTimeout(() => {
        closeTimer.current = null;
        setPhase("closed");
      }, animationDuration);

      return () => {
        if (closeTimer.current) {
          clearTimeout(closeTimer.current);
          closeTimer.current = null;
        }
      };
    }
  }, [phase]);

  useLayoutEffect(() => {
    if (phase !== "opening" && phase !== "open") {
      return;
    }

    positionTooltip();
    window.addEventListener("resize", positionTooltip);
    window.addEventListener("scroll", positionTooltip, true);

    return () => {
      window.removeEventListener("resize", positionTooltip);
      window.removeEventListener("scroll", positionTooltip, true);
    };
  }, [phase, positionTooltip]);

  useEffect(
    () => () => {
      clearHoverTimer();

      if (closeTimer.current) {
        clearTimeout(closeTimer.current);
      }
    },
    [clearHoverTimer],
  );

  function handlePointerEnter(event: PointerEvent<HTMLElement>) {
    if (event.pointerType === "touch") {
      return;
    }

    pointerInside.current = true;

    if (!dismissed.current && enabled) {
      scheduleHover();
    }
  }

  function handleTouchStart(event: PointerEvent<HTMLElement>) {
    if (event.pointerType === "touch" && enabled) {
      scheduleHover();
    }
  }

  function handleTouchEnd(event: PointerEvent<HTMLElement>) {
    if (event.pointerType === "touch") {
      clearHoverTimer();
      scheduleClose();
    }
  }

  function handlePointerLeave() {
    pointerInside.current = false;
    clearHoverTimer();

    if (!focusInside.current) {
      scheduleClose();
    }
  }

  function handleFocus() {
    focusInside.current = true;
    clearHoverTimer();
    showTooltip();
  }

  function handleBlur(event: FocusEvent<HTMLElement>) {
    const nextTarget = event.relatedTarget;

    if (
      nextTarget instanceof Node &&
      event.currentTarget.contains(nextTarget)
    ) {
      return;
    }

    focusInside.current = false;

    if (!pointerInside.current) {
      scheduleClose();
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Escape") {
      return;
    }

    dismissed.current = true;
    clearHoverTimer();
    hideTooltip();
  }

  const shouldRenderTooltip = enabled && phase !== "closed";
  const tooltipStyle: CSSProperties & { "--tooltip-arrow-left": string } = {
    left: position?.left ?? 0,
    top: position?.top ?? 0,
    "--tooltip-arrow-left": `${position?.arrowLeft ?? 8}px`,
  };

  return (
    <Trigger
      ref={setTrigger}
      className={className ? `${styles.trigger} ${className}` : styles.trigger}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onPointerDown={touchPreview ? handleTouchStart : undefined}
      onPointerUp={touchPreview ? handleTouchEnd : undefined}
      onPointerCancel={touchPreview ? handleTouchEnd : undefined}
      onFocusCapture={handleFocus}
      onBlurCapture={handleBlur}
      onKeyDown={handleKeyDown}
    >
      {children}
      {shouldRenderTooltip &&
        createPortal(
          <div
            ref={tooltipRef}
            id={id}
            role="tooltip"
            aria-hidden={phase === "closing"}
            className={styles.tooltip}
            data-side={position?.side ?? "top"}
            data-state={phase}
            style={tooltipStyle}
          >
            <span className={styles.arrow} aria-hidden="true" />
            {content}
          </div>,
          document.body,
        )}
    </Trigger>
  );
}
