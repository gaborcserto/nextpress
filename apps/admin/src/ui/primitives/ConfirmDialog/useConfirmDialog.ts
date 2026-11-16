"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Async actions must reject on failure. Selection is locked until they settle. */
export function useConfirmDialog<TPayload = unknown>() {
  const [open, setOpen] = useState(false);
  const [payload, setPayload] = useState<TPayload | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
    };
  }, []);

  const show = useCallback((nextPayload: TPayload) => {
    if (busy.current) {
      return;
    }
    setError(null);
    setPayload(nextPayload);
    setOpen(true);
  }, []);

  const hide = useCallback(() => {
    if (busy.current) {
      return;
    }
    setOpen(false);
    setPayload(null);
    setError(null);
  }, []);

  const run = async (action: (value: TPayload) => Promise<void>) => {
    if (busy.current || payload === null) {
      return;
    }
    busy.current = true;
    setPending(true);
    setError(null);

    try {
      await action(payload);

      if (mounted.current) {
        setOpen(false);
        setPayload(null);
      }
    } catch (caught) {
      if (mounted.current) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Unable to delete. Please try again.",
        );
      }
    } finally {
      busy.current = false;

      if (mounted.current) {
        setPending(false);
      }
    }
  };

  return { open, payload, show, hide, run, pending, error };
}
