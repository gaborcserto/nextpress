"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  FaCheckCircle,
  FaExclamationCircle,
  FaExclamationTriangle,
  FaInfoCircle,
  FaTimesCircle,
} from "react-icons/fa";

import {
  _subscribeToast,
  type ToastEvent,
  type ToastPosition,
  type ToastType,
} from "@/ui/utils";

import { FadeTransition } from "../FadeTransition";
import styles from "./ToastHost.module.css";
import {
  POSITIONS,
  type ActiveToast,
  type ToastHostConfig,
} from "./ToastHost.types";

function getPositionClass(position: ToastPosition) {
  return styles[`placement-${position}`];
}

const STATUS_ICONS = {
  success: FaCheckCircle,
  error: FaTimesCircle,
  warning: FaExclamationTriangle,
  info: FaInfoCircle,
  attention: FaExclamationCircle,
} satisfies Record<Exclude<ToastType, "loading">, typeof FaInfoCircle>;

const DEFAULT_CONFIG: Required<ToastHostConfig> = {
  placement: "top-center",
  duration: 4000,
  maxVisible: 3,
  gap: 10,
  offset: 16,
  dismissible: true,
  pauseOnHover: true,
  stackMode: "collapsed",
};

export function ToastHost(config: ToastHostConfig = {}) {
  const settings = { ...DEFAULT_CONFIG, ...config };
  const [toasts, setToasts] = useState<ActiveToast[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const timers = new Map<number, number>();

    const dismiss = (id: number) => {
      setToasts((current) =>
        current.map((toast) =>
          toast.id === id ? { ...toast, isIn: false } : toast,
        ),
      );
      const timer = timers.get(id);

      if (timer !== undefined) {
        window.clearTimeout(timer);
      }

      timers.delete(id);
    };

    const unsubscribe = _subscribeToast((event: ToastEvent) => {
      if (event.kind === "hide") {
        dismiss(event.id);

        return;
      }

      setToasts((current) => {
        if (
          current.some(
            (toast) =>
              toast.isIn &&
              toast.msg === event.msg &&
              toast.desc === event.desc &&
              toast.type === event.type,
          )
        ) {
          return current;
        }

        return [
          ...current,
          {
            id: event.id,
            msg: event.msg,
            desc: event.desc,
            type: event.type,
            position: event.position ?? settings.placement,
            timeout: event.timeout || settings.duration,
            isIn: true,
          },
        ];
      });

      if (event.timeout > 0) {
        timers.set(
          event.id,
          window.setTimeout(() => dismiss(event.id), event.timeout),
        );
      }
    });

    return () => {
      unsubscribe();
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [config.placement, settings.duration, settings.placement]);

  if (typeof document === "undefined") {
    return null;
  }

  const groups: Record<ToastPosition, ActiveToast[]> = {
    "top-start": [],
    "top-center": [],
    "top-end": [],
    "bottom-start": [],
    "bottom-center": [],
    "bottom-end": [],
  };
  toasts.forEach((toast) => groups[toast.position].push(toast));

  return createPortal(
    <>
      {POSITIONS.map((position) => {
        const group = groups[position].slice(-settings.maxVisible).reverse();

        if (!group.length) {
          return null;
        }

        return (
          <div
            key={position}
            className={`${styles.viewport} ${getPositionClass(position)}`}
            data-stack-mode={settings.stackMode}
            data-placement={position}
            data-expanded={expanded || settings.stackMode === "expanded"}
            style={
              {
                "--toast-gap": `${settings.gap}px`,
                "--toast-offset": `${settings.offset}px`,
              } as React.CSSProperties
            }
            onPointerEnter={() => {
              if (settings.pauseOnHover) {
                setExpanded(true);
              }
            }}
            onPointerLeave={() => setExpanded(false)}
            onFocusCapture={() => setExpanded(true)}
            onBlurCapture={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) {
                setExpanded(false);
              }
            }}
          >
            {group.map((toast) => (
              <FadeTransition
                key={toast.id}
                in={toast.isIn}
                duration={180}
                onExitedAction={() =>
                  setToasts((current) =>
                    current.filter((item) => item.id !== toast.id),
                  )
                }
              >
                <div
                  className={styles.toast}
                  data-status={toast.type}
                  role={toast.type === "error" ? "alert" : "status"}
                  aria-live={toast.type === "error" ? "assertive" : "polite"}
                  aria-atomic="true"
                >
                  {toast.type === "loading" ? (
                    <span className={styles.spinner} aria-hidden="true" />
                  ) : (
                    <span
                      className={styles.icon}
                      data-status={toast.type}
                      aria-hidden="true"
                    >
                      {(() => {
                        const StatusIcon = STATUS_ICONS[toast.type];

                        return <StatusIcon />;
                      })()}
                    </span>
                  )}
                  <div className={styles.message}>
                    <div className={styles.title}>{toast.msg}</div>
                    {toast.desc && (
                      <div className={styles.description}>{toast.desc}</div>
                    )}
                  </div>
                  {settings.dismissible && (
                    <button
                      className={styles.close}
                      type="button"
                      aria-label="Dismiss notification"
                      onClick={() =>
                        setToasts((current) =>
                          current.map((item) =>
                            item.id === toast.id
                              ? { ...item, isIn: false }
                              : item,
                          ),
                        )
                      }
                    >
                      <span aria-hidden="true">×</span>
                    </button>
                  )}
                </div>
              </FadeTransition>
            ))}
          </div>
        );
      })}
    </>,
    document.body,
  );
}
