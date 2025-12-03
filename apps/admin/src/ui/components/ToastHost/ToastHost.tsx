"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { FadeTransition } from "../FadeTransition";
import { POSITIONS, type ActiveToast } from "./ToastHost.types";
import type {
  ToastEvent,
  ToastPosition,
  ToastType} from "@/ui/utils/toast";
import {
  _subscribeToast
} from "@/ui/utils/toast";

// Map ToastPosition → DaisyUI toast classes
function getPosClass(position: ToastPosition) {
  return position === "top-right"
      ? "toast-top toast-end"
      : position === "top-left"
          ? "toast-top toast-start"
          : position === "bottom-right"
              ? "toast-bottom toast-end"
              : "toast-bottom toast-start";
}

// Map ToastType → DaisyUI alert variants
function getVariantClass(type: ToastType) {
  return type === "success"
      ? "alert-success"
      : type === "error"
          ? "alert-error"
          : type === "warning"
              ? "alert-warning"
              : "alert-info";
}

export function ToastHost() {
  const [toasts, setToasts] = useState<ActiveToast[]>([]);

  useEffect(() => {
    /**
     * Listen for toast events sent from the showToast util.
     */
    const unsubscribe = _subscribeToast((event: ToastEvent) => {
      if (event.kind === "show") {
        const { id, msg, desc, type, position, timeout } = event;

        // Add toast to list
        setToasts((prev) => [
          ...prev,
          { id, msg, desc, type, position, timeout, isIn: true },
        ]);

        // Start exit animation after timeout
        window.setTimeout(() => {
          setToasts((prev) =>
              prev.map((t) => (t.id === id ? { ...t, isIn: false } : t))
          );
        }, timeout);
      }

      // Manual hide
      if (event.kind === "hide") {
        const { id } = event;
        setToasts((prev) =>
            prev.map((t) => (t.id === id ? { ...t, isIn: false } : t))
        );
      }
    });

    // IMPORTANT:
    // Wrap unsubscribe so the cleanup returns void, not boolean
    return () => {
      unsubscribe();
    };
  }, []);

  if (typeof document === "undefined") return null;

  // Group toasts by position so each corner has a single <div class="toast ...">
  const groups: Record<ToastPosition, ActiveToast[]> = {
    "top-right": [],
    "top-left": [],
    "bottom-right": [],
    "bottom-left": [],
  };
  for (const t of toasts) groups[t.position].push(t);

  return createPortal(
      <>
        {POSITIONS.map((pos) => {
          const list = groups[pos];
          if (!list.length) return null;

          return (
              <div key={pos} className={`toast z-[9999] ${getPosClass(pos)}`}>
                {list.map((t) => (
                    <FadeTransition
                        key={t.id}
                        in={t.isIn}
                        duration={200}
                        onExitedAction={() => {
                          // Remove the toast after exit animation finishes
                          setToasts((prev) => prev.filter((x) => x.id !== t.id));
                        }}
                    >
                      <div className={`alert ${getVariantClass(t.type)}`}>
                        <div>
                          <div className="font-semibold">{t.msg}</div>
                          {t.desc && (
                              <div className="text-sm opacity-80 mt-1">
                                {t.desc}
                              </div>
                          )}
                        </div>
                      </div>
                    </FadeTransition>
                ))}
              </div>
          );
        })}
      </>,
      document.body
  );
}
