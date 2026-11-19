"use client";

import { createContext } from "react";

export const EditorHeaderContext = createContext<
  HTMLElement | null | undefined
>(undefined);
