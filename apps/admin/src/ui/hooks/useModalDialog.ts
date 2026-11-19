import { useLayoutEffect, useRef } from "react";

export function useModalDialog(open: boolean) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;

    if (!open || !dialog) {
      return;
    }

    dialog.showModal();

    return () => dialog.close();
  }, [open]);

  return dialogRef;
}
