import "server-only";

import { isRequestId } from "./request-correlation";
import { isRole, type RoleName } from "./roles";

const events = {
  "api.request.failed": {
    category: "operational",
    level: "error",
    outcome: "failure",
  },
  "api.request.rejected": {
    category: "operational",
    level: "warn",
    outcome: "denied",
  },
  "auth.operation.failed": {
    category: "operational",
    level: "warn",
    outcome: "failure",
  },
  "security.rate_limited": {
    category: "operational",
    level: "warn",
    outcome: "denied",
  },
  "media.cleanup_failed": {
    category: "operational",
    level: "error",
    outcome: "failure",
  },
  "admin.upstream.failed": {
    category: "operational",
    level: "error",
    outcome: "failure",
  },
  "public.upstream.failed": {
    category: "operational",
    level: "error",
    outcome: "failure",
  },
  "user.role.changed": { category: "audit", level: "info", outcome: "success" },
  "navigation.menu.created": {
    category: "audit",
    level: "info",
    outcome: "success",
  },
  "navigation.menu.updated": {
    category: "audit",
    level: "info",
    outcome: "success",
  },
  "navigation.menu.deleted": {
    category: "audit",
    level: "info",
    outcome: "success",
  },
  "page.hierarchy.updated": {
    category: "audit",
    level: "info",
    outcome: "success",
  },
  "user.deleted": { category: "audit", level: "info", outcome: "success" },
  "media.uploaded": { category: "audit", level: "info", outcome: "success" },
  "media.deleted": { category: "audit", level: "info", outcome: "success" },
  "revision.saved": { category: "audit", level: "info", outcome: "success" },
  "revision.transition": {
    category: "audit",
    level: "info",
    outcome: "success",
  },
} as const;

const reasons = [
  "authentication",
  "authorization",
  "validation",
  "database",
  "unexpected",
  "upstream",
  "transport",
  "timeout",
  "configuration",
  "contract",
] as const;
export type FailureCode = (typeof reasons)[number];
type LogService = "api" | "admin" | "web";

const operations = [
  "protected",
  "auth",
  "discovery",
  "public.settings",
  "public.content",
  "public.media",
  "forward",
  "media",
  "content",
  "taxonomy",
] as const;
export type LogOperation = (typeof operations)[number];

type OperationalFields = {
  requestId?: unknown;
  upstreamRequestId?: unknown;
  operation?: LogOperation;
  code?: FailureCode;
  status?: unknown;
};

type AuditTarget = {
  requestId?: string;
  operation?: LogOperation;
  // Only server-persisted entity identifiers belong in audit events.
  actorId: string;
  targetId: string;
};

type AuditFields = {
  "user.role.changed": AuditTarget & { role: RoleName };
  "navigation.menu.created": AuditTarget;
  "navigation.menu.updated": AuditTarget;
  "navigation.menu.deleted": AuditTarget;
  "page.hierarchy.updated": AuditTarget;
  "user.deleted": AuditTarget;
  "media.uploaded": AuditTarget;
  "media.deleted": AuditTarget;
  "revision.saved": AuditTarget & { revisionId: string };
  "revision.transition": AuditTarget &
    (
      | { action: "restore"; revisionId: string }
      | { action: "publish" | "unpublish"; sourceRevisionId?: string }
    );
};
type AuditArguments = {
  [Event in keyof AuditFields]: [event: Event, fields: AuditFields[Event]];
}[keyof AuditFields];
type OperationalEvent = Exclude<keyof typeof events, keyof AuditFields>;
type LogFields = OperationalFields & {
  actorId?: unknown;
  targetId?: unknown;
  role?: unknown;
  action?: unknown;
  revisionId?: unknown;
  sourceRevisionId?: unknown;
};

function allowedValue<T extends string>(
  values: readonly T[],
  value: unknown,
): value is T {
  return values.some((entry) => entry === value);
}

function isEntityId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    ((value.length === 25 && /^c[a-z0-9]{24}$/.test(value)) ||
      (value.length === 32 && /^[a-zA-Z0-9]{32}$/.test(value)))
  );
}

export function writeServerLog(service: "api", ...entry: AuditArguments): void;
export function writeServerLog(
  service: LogService,
  event: OperationalEvent,
  fields?: OperationalFields,
): void;
export function writeServerLog(
  service: LogService,
  event: keyof typeof events,
  fields?: LogFields,
): void {
  if (
    !allowedValue(["api", "admin", "web"], service) ||
    !Object.hasOwn(events, event)
  ) {
    return;
  }

  const { category, level, outcome } = events[event];
  const {
    requestId,
    upstreamRequestId,
    operation,
    code,
    status,
    actorId,
    targetId,
    role,
    action,
    revisionId,
    sourceRevisionId,
  } = fields ?? {};

  const record = {
    timestamp: new Date().toISOString(),
    service,
    event,
    category,
    level,
    outcome,
    requestId: isRequestId(requestId) ? requestId : undefined,
    upstreamRequestId:
      category === "operational" &&
      upstreamRequestId !== requestId &&
      isRequestId(upstreamRequestId)
        ? upstreamRequestId
        : undefined,
    operation: allowedValue(operations, operation) ? operation : undefined,
    code:
      category === "operational" && allowedValue(reasons, code)
        ? code
        : undefined,
    status:
      category === "operational" &&
      typeof status === "number" &&
      Number.isInteger(status) &&
      status >= 100 &&
      status <= 599
        ? status
        : undefined,
    actorId: category === "audit" && isEntityId(actorId) ? actorId : undefined,
    targetId:
      category === "audit" &&
      (isEntityId(targetId) ||
        (event.startsWith("navigation.menu.") &&
          ["initial-header", "initial-footer"].some((id) => id === targetId)))
        ? targetId
        : undefined,
    role: event === "user.role.changed" && isRole(role) ? role : undefined,
    action:
      event === "revision.transition" &&
      allowedValue(["restore", "publish", "unpublish"], action)
        ? action
        : undefined,
    revisionId:
      (event === "revision.saved" ||
        (event === "revision.transition" && action === "restore")) &&
      isEntityId(revisionId)
        ? revisionId
        : undefined,
    sourceRevisionId:
      event === "revision.transition" &&
      allowedValue(["publish", "unpublish"], action) &&
      isEntityId(sourceRevisionId)
        ? sourceRevisionId
        : undefined,
  };

  console[level](JSON.stringify(record));
}
