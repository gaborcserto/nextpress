"use client";

import { useContext } from "react";
import { createPortal } from "react-dom";

import { EditorHeaderContext } from "./EditorHeaderContext";

import type { ReactNode } from "react";

export function AdminHeaderActions({ children }: { children: ReactNode }) {
  const headerSlot = useContext(EditorHeaderContext);
  const actions = (
    <div className="admin-action-layout">
      <div className="admin-action-controls">{children}</div>
    </div>
  );

  if (headerSlot === undefined) {
    return actions;
  }

  return headerSlot ? createPortal(actions, headerSlot) : null;
}
