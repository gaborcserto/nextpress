import { canonicalEditorialJson } from "@nextpress/shared/editorial-contracts";
import { WorkingAggregateEditSchema } from "@nextpress/shared/working-aggregate";

import {
  PrivateDraftRequestError,
  requestPrivateDraft,
} from "./private-draft.client";

import type {
  WorkingAggregateEnvelope,
  WorkingAggregateSave,
  WorkingPatch,
} from "@nextpress/shared/working-aggregate";

export type PrivateDraftState = {
  phase: "saved" | "unsaved" | "saving" | "error" | "conflict";
  dirty: boolean;
  pending: boolean;
  message: string;
  version: number;
  savedAt: string | null;
};
type Attempt<T> = {
  command: WorkingAggregateSave;
  values: T;
  patch: WorkingPatch;
  retries: number;
};
type Transport = typeof requestPrivateDraft;

export function privateDraftFailure(error: unknown) {
  if (!(error instanceof PrivateDraftRequestError)) {
    return "Save failed or its response was lost. Your edits are retained. Retry to resolve the same request.";
  }

  switch (error.code) {
    case "SOURCE_VERSION_CONFLICT":
      return "The live source changed. Retain your edits, reload, then explicitly reset the draft to the current source if appropriate.";
    case "DRAFT_VERSION_CONFLICT":
      return "Another editor saved a newer private draft. Copy any edits you need before reloading.";
    case "REFERENCE_CONFLICT":
      return "A referenced item is missing or changed classification. Reload and review references before saving.";
    case "REQUEST_REUSE_CONFLICT":
      return "Save identity conflict. Copy your edits and reload; this request cannot be reused.";
    case "IDENTITY_CONFLICT":
      return "Content ownership or type changed. Reload to check your current access.";
    case "PRIVATE_DRAFT_DISABLED":
      return "Private editing admission was withdrawn. Edits remain here; no live save was attempted.";
    default:
      if ([401, 403, 404].includes(error.status)) {
        return "Your session, permission or content ownership changed. Edits remain here. Check access before reloading.";
      }

      return "Private save was refused. Review required fields or reload after resolving the conflict. Edits remain here.";
  }
}

/** One editor session, one durable command at a time; accepted responses never replace local values. */
export class PrivateDraftController<T> {
  private draft: WorkingAggregateEnvelope;
  private current: { values: T; patch: WorkingPatch };
  private acknowledged: { values: T; patch: WorkingPatch };
  private attempt: Attempt<T> | null = null;
  private flight: Promise<boolean> | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private listeners = new Set<() => void>();
  private disposed = false;
  private blocked = false;
  private state: PrivateDraftState;

  constructor(
    draft: WorkingAggregateEnvelope,
    values: T,
    patch: WorkingPatch,
    private transport: Transport = requestPrivateDraft,
  ) {
    this.draft = draft;
    this.current = this.acknowledged = { values, patch };
    this.state = {
      phase: "saved",
      dirty: false,
      pending: false,
      message: "",
      version: draft.version,
      savedAt: null,
    };

    if (
      draft.currentSourceVersion !== undefined &&
      draft.currentSourceVersion !== draft.sourceVersion
    ) {
      this.blocked = true;
      this.state = {
        ...this.state,
        phase: "conflict",
        dirty: true,
        message: privateDraftFailure(
          new PrivateDraftRequestError(409, "SOURCE_VERSION_CONFLICT"),
        ),
      };
    }
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  };

  snapshot = () => this.state;

  private publish(change: Partial<PrivateDraftState>) {
    this.state = { ...this.state, ...change };
    this.listeners.forEach((listener) => listener());
  }

  hasLocalChanges() {
    return (
      canonicalEditorialJson(this.current.patch) !==
      canonicalEditorialJson(this.acknowledged.patch)
    );
  }

  update(values: T, patch: WorkingPatch) {
    this.current = { values, patch };
    const dirty = this.hasLocalChanges();
    this.publish({ dirty: dirty || this.attempt !== null });

    if (this.flight || this.attempt || this.blocked || this.disposed) {
      return;
    }
    clearTimeout(this.timer);
    this.publish({ phase: dirty ? "unsaved" : "saved", message: "" });

    if (dirty) {
      this.timer = setTimeout(() => {
        void this.save();
      }, 1000);
    }
  }

  save(
    operation:
      | "SAVE"
      | "RESET"
      | "RESTORE"
      | "RESTORE_LEGACY"
      | "PUBLISH"
      | "UNPUBLISH"
      | "SCHEDULE"
      | "CANCEL_SCHEDULE" = "SAVE",
    restoreVersion?: number,
    legacyRevisionId?: string,
    scheduledFor?: string,
  ): Promise<boolean> {
    const reset = operation === "RESET";
    const restore = operation === "RESTORE" || operation === "RESTORE_LEGACY";
    const publication = [
      "PUBLISH",
      "UNPUBLISH",
      "SCHEDULE",
      "CANCEL_SCHEDULE",
    ].includes(operation);
    clearTimeout(this.timer);

    if (this.disposed || (this.blocked && !reset)) {
      return Promise.resolve(false);
    }

    if (
      publication &&
      (this.hasLocalChanges() || this.attempt || this.draft.version === 0)
    ) {
      return Promise.resolve(false);
    }

    if (this.flight) {
      return this.flight;
    }

    if (!this.attempt) {
      if (
        !reset &&
        !restore &&
        !publication &&
        !this.hasLocalChanges() &&
        this.draft.version > 0
      ) {
        return Promise.resolve(true);
      }
      const delta = Object.fromEntries(
        Object.entries(this.current.patch).filter(
          ([key, value]) =>
            !Object.hasOwn(this.acknowledged.patch, key) ||
            canonicalEditorialJson(value) !==
              canonicalEditorialJson(Reflect.get(this.acknowledged.patch, key)),
        ),
      );
      const parsed = WorkingAggregateEditSchema.shape.patch.safeParse(
        reset || restore || publication ? {} : delta,
      );

      if (!parsed.success) {
        this.publish({
          phase: "error",
          message:
            "Complete the required fields before saving. Your edits are retained.",
          dirty: true,
        });

        return Promise.resolve(false);
      }
      this.attempt = {
        values: this.current.values,
        patch: this.current.patch,
        retries: 0,
        command: {
          pageId: this.draft.aggregate.pageId,
          requestId: crypto.randomUUID(),
          expectedDraftVersion: this.draft.version,
          expectedSourceVersion: reset
            ? (this.draft.currentSourceVersion ?? this.draft.sourceVersion)
            : this.draft.sourceVersion,
          edit: {
            expectedVersion: this.draft.aggregate.baseVersion,
            expectedFingerprint: this.draft.aggregate.baseFingerprint,
            patch: parsed.data,
          },
          ...(reset ? { operation: "RESET" as const } : {}),
          ...(operation === "RESTORE" ? { operation, restoreVersion } : {}),
          ...(operation === "RESTORE_LEGACY"
            ? { operation, legacyRevisionId }
            : {}),
          ...(publication && operation !== "SAVE" ? { operation } : {}),
          ...(operation === "SCHEDULE" ? { scheduledFor } : {}),
        },
      };
    }
    const attempt = this.attempt;
    this.publish({ phase: "saving", pending: true, dirty: true, message: "" });
    this.flight = this.send(attempt).finally(() => {
      this.flight = null;
    });

    return this.flight;
  }

  private async send(attempt: Attempt<T>): Promise<boolean> {
    try {
      const result = await this.transport(
        attempt.command.pageId,
        attempt.command,
      );

      if (this.disposed) {
        return false;
      }
      this.draft = result;

      if (
        attempt.command.operation === "RESET" ||
        attempt.command.operation === "RESTORE" ||
        attempt.command.operation === "RESTORE_LEGACY" ||
        ["PUBLISH", "UNPUBLISH", "SCHEDULE", "CANCEL_SCHEDULE"].includes(
          attempt.command.operation ?? "",
        )
      ) {
        this.attempt = null;
        this.blocked = true;
        this.publish({
          phase: "conflict",
          dirty: true,
          pending: false,
          version: result.version,
          message:
            attempt.command.operation &&
            ["PUBLISH", "UNPUBLISH", "SCHEDULE", "CANCEL_SCHEDULE"].includes(
              attempt.command.operation,
            )
              ? "Publication command acknowledged. Copy any local edits you need, then reload before further editing."
              : "Private recovery acknowledged. Reload before further editing.",
        });

        return true;
      }
      this.acknowledged = { values: attempt.values, patch: attempt.patch };
      this.attempt = null;
      const dirty = this.hasLocalChanges();
      this.publish({
        phase: dirty ? "unsaved" : "saved",
        dirty,
        pending: false,
        version: result.version,
        savedAt: new Date().toLocaleTimeString(),
        message: "",
      });

      if (dirty) {
        this.timer = setTimeout(() => {
          void this.save();
        }, 1000);
      }

      return true;
    } catch (error) {
      if (this.disposed) {
        return false;
      }
      const initialAdmissionRefusal =
        error instanceof PrivateDraftRequestError &&
        error.code === "PRIVATE_DRAFT_DISABLED" &&
        attempt.retries === 0;
      const transient =
        !initialAdmissionRefusal &&
        (!(error instanceof PrivateDraftRequestError) ||
          error.status >= 500 ||
          error.code === "TRANSACTION_RETRY_REQUIRED");

      if (!transient) {
        this.attempt = null;
        this.blocked =
          error instanceof PrivateDraftRequestError &&
          ([401, 403, 404, 409].includes(error.status) ||
            error.code === "PRIVATE_DRAFT_DISABLED");
      }
      this.publish({
        phase: this.blocked ? "conflict" : "error",
        dirty: true,
        pending: transient,
        message: privateDraftFailure(error),
      });

      if (transient && attempt.retries < 2) {
        attempt.retries += 1;
        this.timer = setTimeout(() => {
          void this.save();
        }, attempt.retries * 2000);
      }

      return false;
    }
  }

  discardLocal(): T | null {
    if (this.flight || this.attempt) {
      return null;
    }
    clearTimeout(this.timer);
    this.current = this.acknowledged;
    this.publish({
      dirty: this.blocked,
      phase: this.blocked ? "conflict" : "saved",
    });

    return this.acknowledged.values;
  }

  activate() {
    this.disposed = false;
  }

  dispose() {
    this.disposed = true;
    clearTimeout(this.timer);
    this.listeners.clear();
  }
}
