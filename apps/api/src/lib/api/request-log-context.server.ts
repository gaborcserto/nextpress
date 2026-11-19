import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";

import type { LogOperation } from "@nextpress/shared/server-logging";

type RequestLog = { requestId: string; operation: LogOperation };
export const requestLog = new AsyncLocalStorage<RequestLog>();

export function apiLogContext() {
  return requestLog.getStore();
}
