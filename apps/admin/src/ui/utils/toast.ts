export type ToastType = "success" | "error" | "warning" | "info";

export const TOAST_POSITIONS = [
  "top-right",
  "top-left",
  "bottom-right",
  "bottom-left",
] as const;

export type ToastPosition = (typeof TOAST_POSITIONS)[number];

export type ToastOptions = {
  desc?: string;
  timeout?: number; // ms, default: 2000
  position?: ToastPosition;
};

// Internal event theme for the ToastHost
type ToastShowEvent = {
  kind: "show";
  id: number;
  msg: string;
  desc?: string;
  type: ToastType;
  position: ToastPosition;
  timeout: number;
};

type ToastHideEvent = {
  kind: "hide";
  id: number;
};

export type ToastEvent = ToastShowEvent | ToastHideEvent;

type Listener = (event: ToastEvent) => void;

const listeners = new Set<Listener>();
let nextId = 1;

/**
 * ToastHost subscribes to events using this.
 */
export function _subscribeToast(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Public API used everywhere in your code.
 *
 * Example:
 * showToast("Save failed", "error", { desc: "Something went wrong" })
 */
export function showToast(
    msg: string,
    type: ToastType = "success",
    opts: ToastOptions = {}
) {
  if (typeof window === "undefined") return () => {};

  const { desc, timeout = 2000, position = "top-right" } = opts;

  const id = nextId++;
  const event: ToastShowEvent = {
    kind: "show",
    id,
    msg,
    desc,
    type,
    position,
    timeout,
  };

  listeners.forEach((l) => l(event));

  // Cancel function (optional): immediately trigger exit animation
  return () => {
    const hideEvent: ToastHideEvent = { kind: "hide", id };
    listeners.forEach((l) => l(hideEvent));
  };
}
