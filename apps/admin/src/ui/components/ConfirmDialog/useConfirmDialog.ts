"use client";

import { useCallback, useState } from "react";

export function useConfirmDialog<TPayload = unknown>() {
  const [open, setOpen] = useState(false);
  const [payload, setPayload] = useState<TPayload | null>(null);

  const show = useCallback((nextPayload: TPayload) => {
    setPayload(nextPayload);
    setOpen(true);
  }, []);

  const hide = useCallback(() => {
    setOpen(false);
    setPayload(null);
  }, []);

  return { open, payload, show, hide };
}
