import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PrivateDraftController } from "./private-draft-controller";
import { PrivateDraftRequestError } from "./private-draft.client";
import { privateDraftFixture } from "./private-draft.fixtures";

import type { WorkingAggregateEnvelope } from "@nextpress/shared/working-aggregate";

function deferred() {
  let resolve: (value: WorkingAggregateEnvelope) => void = () => {};
  const promise = new Promise<WorkingAggregateEnvelope>((done) => {
    resolve = done;
  });

  return { promise, resolve };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("private autosave controller", () => {
  it("retains local edits typed while a publication command is in flight", async () => {
    const response = deferred();
    const controller = new PrivateDraftController(
      privateDraftFixture("PAGE", 1),
      "Original",
      { title: "Original" },
      vi.fn().mockReturnValue(response.promise),
    );
    const publication = controller.save("PUBLISH");
    controller.update("Later local edits", { title: "Later local edits" });
    response.resolve(privateDraftFixture("PAGE", 2));
    expect(await publication).toBe(true);
    expect(controller.hasLocalChanges()).toBe(true);
    expect(controller.snapshot().message).toContain("Copy any local edits");
    controller.dispose();
  });
  it("does not acknowledge publication using an autosave already in flight", async () => {
    const response = deferred();
    const transport = vi.fn().mockReturnValue(response.promise);
    const controller = new PrivateDraftController(
      privateDraftFixture("PAGE", 1),
      "Original",
      { title: "Original" },
      transport,
    );
    controller.update("Changed", { title: "Changed" });
    const save = controller.save();
    const publication = controller.save("PUBLISH");
    response.resolve(privateDraftFixture("PAGE", 2));
    await save;
    expect(await publication).toBe(false);
    expect(transport).toHaveBeenCalledTimes(1);
    controller.dispose();
  });

  it("preserves newer edits when a stale editor is reloading", async () => {
    const response = deferred();
    const transport = vi.fn().mockResolvedValue(privateDraftFixture("PAGE", 2));
    const controller = new PrivateDraftController(
      privateDraftFixture("PAGE", 1),
      "Original",
      { title: "Original" },
      transport,
    );
    const reload = controller.reload(async (canApply) => {
      await response.promise;

      if (!canApply()) {
        throw new Error("New edits exist");
      }
    });

    controller.update("New local edit", { title: "New local edit" });
    await vi.advanceTimersByTimeAsync(2000);
    expect(transport).not.toHaveBeenCalled();

    response.resolve(privateDraftFixture("PAGE", 2));
    await expect(reload).rejects.toThrow("New edits exist");
    expect(controller.snapshot().dirty).toBe(true);
    await vi.advanceTimersByTimeAsync(1000);
    expect(transport.mock.calls[0]?.[1]).toMatchObject({
      expectedDraftVersion: 1,
      edit: { patch: { title: "New local edit" } },
    });
    controller.dispose();
  });

  it("leaves a scheduled autosave intact when reset is rejected for unsaved edits", async () => {
    const transport = vi.fn().mockResolvedValue(privateDraftFixture("PAGE", 2));
    const controller = new PrivateDraftController(
      privateDraftFixture("PAGE", 1),
      "Original",
      { title: "Original" },
      transport,
    );
    controller.update("Unsent", { title: "Unsent" });

    expect(await controller.save("RESET")).toBe(false);
    await vi.advanceTimersByTimeAsync(1000);

    expect(transport).toHaveBeenCalledOnce();
    expect(transport.mock.calls[0]?.[1]).not.toHaveProperty("operation");
  });

  it.each(["PUBLISH", "UNPUBLISH", "SCHEDULE", "CANCEL_SCHEDULE"] as const)(
    "replays a lost %s response and blocks editing until reload",
    async (operation) => {
      const transport = vi
        .fn()
        .mockRejectedValueOnce(new Error("Response lost"))
        .mockResolvedValue(privateDraftFixture("PAGE", 2));
      const controller = new PrivateDraftController(
        privateDraftFixture("PAGE", 1),
        "Original",
        { title: "Original" },
        transport,
      );
      await controller.save(
        operation,
        undefined,
        undefined,
        operation === "SCHEDULE" ? "2099-01-01T00:00:00Z" : undefined,
      );
      await vi.advanceTimersByTimeAsync(2000);
      expect(transport.mock.calls[1]?.[1]).toEqual(
        transport.mock.calls[0]?.[1],
      );
      expect(transport.mock.calls[0]?.[1]).toMatchObject({
        operation,
        edit: { patch: {} },
      });
      expect(controller.snapshot()).toMatchObject({
        phase: "conflict",
        pending: false,
        version: 2,
      });
      controller.update("Later", { title: "Later" });
      await vi.advanceTimersByTimeAsync(10000);
      expect(transport).toHaveBeenCalledTimes(2);
      controller.dispose();
    },
  );

  it("requires unsaved edits to be acknowledged before publication", async () => {
    const transport = vi.fn();
    const controller = new PrivateDraftController(
      privateDraftFixture("PAGE", 1),
      "Original",
      { title: "Original" },
      transport,
    );
    controller.update("Changed", { title: "Changed" });
    expect(await controller.save("PUBLISH")).toBe(false);
    expect(transport).not.toHaveBeenCalled();
    controller.dispose();
  });
  it("retries an uncertain legacy restore with the identical command and requires reload", async () => {
    const transport = vi
      .fn()
      .mockRejectedValueOnce(new Error("Response lost"))
      .mockResolvedValue(privateDraftFixture("POST", 2));
    const controller = new PrivateDraftController(
      privateDraftFixture("POST", 1),
      "Original",
      { title: "Original" },
      transport,
    );
    await controller.save("RESTORE_LEGACY", undefined, "legacy-id");
    expect(controller.snapshot().pending).toBe(true);
    await vi.advanceTimersByTimeAsync(2000);
    expect(transport.mock.calls[1]?.[1]).toEqual(transport.mock.calls[0]?.[1]);
    expect(transport.mock.calls[0]?.[1]).toMatchObject({
      operation: "RESTORE_LEGACY",
      legacyRevisionId: "legacy-id",
      edit: { patch: {} },
    });
    expect(controller.snapshot()).toMatchObject({
      phase: "conflict",
      pending: false,
      version: 2,
    });
    controller.update("Later", { title: "Later" });
    await vi.advanceTimersByTimeAsync(10000);
    expect(transport).toHaveBeenCalledTimes(2);
    controller.dispose();
  });
  it("replays a lost restore response with the same historical command and blocks edits until reload", async () => {
    const transport = vi
      .fn()
      .mockRejectedValueOnce(new Error("Response lost"))
      .mockResolvedValue(privateDraftFixture("PAGE", 2));
    const controller = new PrivateDraftController(
      privateDraftFixture("PAGE", 1),
      "Original",
      { title: "Original" },
      transport,
    );
    await controller.save("RESTORE", 1);
    expect(controller.snapshot().pending).toBe(true);
    await vi.advanceTimersByTimeAsync(2000);
    expect(transport).toHaveBeenCalledTimes(2);
    expect(transport.mock.calls[1]?.[1]).toEqual(transport.mock.calls[0]?.[1]);
    expect(transport.mock.calls[0]?.[1]).toMatchObject({
      operation: "RESTORE",
      restoreVersion: 1,
      edit: { patch: {} },
    });
    expect(controller.snapshot()).toMatchObject({
      phase: "conflict",
      pending: false,
      version: 2,
    });
    controller.update("Later", { title: "Later" });
    await vi.advanceTimersByTimeAsync(10000);
    expect(transport).toHaveBeenCalledTimes(2);
    controller.dispose();
  });
  it("keeps private mode blocked when server admission is withdrawn without attempting a live save", async () => {
    const transport = vi
      .fn()
      .mockRejectedValue(
        new PrivateDraftRequestError(503, "PRIVATE_DRAFT_DISABLED"),
      );
    const controller = new PrivateDraftController(
      privateDraftFixture(),
      "Original",
      { title: "Original" },
      transport,
    );
    controller.update("Private", { title: "Private" });
    await vi.advanceTimersByTimeAsync(10000);
    expect(transport).toHaveBeenCalledOnce();
    expect(controller.snapshot()).toMatchObject({
      phase: "conflict",
      dirty: true,
      pending: false,
    });
    controller.dispose();
  });

  it("holds invalid edits locally until a supported valid patch is available", async () => {
    const transport = vi.fn().mockResolvedValue(privateDraftFixture("PAGE", 1));
    const controller = new PrivateDraftController(
      privateDraftFixture(),
      "Original",
      { title: "Original" },
      transport,
    );
    controller.update("", { title: "" });
    await vi.advanceTimersByTimeAsync(10000);
    expect(transport).not.toHaveBeenCalled();
    expect(controller.snapshot()).toMatchObject({
      phase: "error",
      dirty: true,
    });
    controller.update("Valid", { title: "Valid" });
    await vi.advanceTimersByTimeAsync(1000);
    expect(transport).toHaveBeenCalledOnce();
    controller.dispose();
  });
  it("waits for an edit and debounces continuous typing into one delta-only save", async () => {
    const transport = vi.fn().mockResolvedValue(privateDraftFixture("PAGE", 1));
    const controller = new PrivateDraftController(
      privateDraftFixture(),
      "Original",
      { title: "Original", content: "Historical bytes" },
      transport,
    );
    await vi.advanceTimersByTimeAsync(5000);
    expect(transport).not.toHaveBeenCalled();
    controller.update("A", { title: "A", content: "Historical bytes" });
    await vi.advanceTimersByTimeAsync(900);
    controller.update("AB", { title: "AB", content: "Historical bytes" });
    await vi.advanceTimersByTimeAsync(999);
    expect(transport).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(transport).toHaveBeenCalledOnce();
    expect(transport.mock.calls[0]?.[1].edit.patch).toEqual({ title: "AB" });
    expect(controller.snapshot()).toMatchObject({
      phase: "saved",
      dirty: false,
      version: 1,
    });
    controller.dispose();
  });

  it("cancels autosave when edits return to acknowledged values before debounce", async () => {
    const transport = vi.fn();
    const original = {
      title: "Original",
      content: "Historical bytes",
    };
    const controller = new PrivateDraftController(
      privateDraftFixture("PAGE", 2),
      original,
      original,
      transport,
    );

    try {
      const edited = { ...original, title: "Unsent" };
      controller.update(edited, edited);
      expect(controller.snapshot()).toMatchObject({ dirty: true, version: 2 });
      await vi.advanceTimersByTimeAsync(500);

      controller.update({ ...original }, { ...original });
      await vi.advanceTimersByTimeAsync(1_000);

      expect(controller.snapshot()).toMatchObject({
        dirty: false,
        phase: "saved",
        version: 2,
      });
      expect(transport).not.toHaveBeenCalled();
    } finally {
      controller.dispose();
    }
  });

  it("initializes on explicit Save with an empty patch and never publishes", async () => {
    const transport = vi.fn().mockResolvedValue(privateDraftFixture("PAGE", 1));
    const controller = new PrivateDraftController(
      privateDraftFixture(),
      "Original",
      { title: "Original" },
      transport,
    );
    await controller.save();
    expect(transport.mock.calls[0]?.[1].edit).toMatchObject({ patch: {} });
    expect(transport.mock.calls[0]?.[1].edit).not.toHaveProperty(
      "publicationIntent",
    );
    expect(transport.mock.calls[0]?.[1].requestId).toMatch(/^[a-f0-9-]{36}$/);
    controller.dispose();
  });

  it("serializes in-flight edits and keeps newer local values unsaved until acknowledged", async () => {
    const first = deferred();
    const second = deferred();
    const transport = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const controller = new PrivateDraftController(
      privateDraftFixture(),
      "Original",
      { title: "Original" },
      transport,
    );
    controller.update("First", { title: "First" });
    await vi.advanceTimersByTimeAsync(1000);
    controller.update("Latest", { title: "Latest" });
    await vi.advanceTimersByTimeAsync(5000);
    expect(transport).toHaveBeenCalledOnce();
    first.resolve(privateDraftFixture("PAGE", 1));
    await vi.advanceTimersByTimeAsync(0);
    expect(controller.snapshot()).toMatchObject({
      dirty: true,
      phase: "unsaved",
    });
    await vi.advanceTimersByTimeAsync(1000);
    expect(transport.mock.calls[1]?.[1]).toMatchObject({
      expectedDraftVersion: 1,
      edit: { patch: { title: "Latest" } },
    });
    second.resolve(privateDraftFixture("PAGE", 2));
    await vi.advanceTimersByTimeAsync(0);
    expect(controller.snapshot()).toMatchObject({
      dirty: false,
      phase: "saved",
      version: 2,
    });
    controller.dispose();
  });

  it("replays the exact command after lost responses, then saves later edits with a new identity", async () => {
    const transport = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Lost response"))
      .mockResolvedValueOnce(privateDraftFixture("PAGE", 1))
      .mockResolvedValueOnce(privateDraftFixture("PAGE", 2));
    const controller = new PrivateDraftController(
      privateDraftFixture(),
      "Original",
      { title: "Original" },
      transport,
    );
    controller.update("Sent", { title: "Sent" });
    await controller.save();
    expect(controller.discardLocal()).toBeNull();
    controller.update("Later", { title: "Later" });
    await vi.advanceTimersByTimeAsync(2000);
    expect(transport.mock.calls[1]?.[1]).toEqual(transport.mock.calls[0]?.[1]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(transport.mock.calls[2]?.[1].requestId).not.toBe(
      transport.mock.calls[0]?.[1].requestId,
    );
    expect(transport.mock.calls[2]?.[1].edit.patch).toEqual({ title: "Later" });
    controller.dispose();
  });

  it("bounds automatic retries and lets a manual retry resolve the same command", async () => {
    const transport = vi.fn().mockRejectedValue(new TypeError("offline"));
    const controller = new PrivateDraftController(
      privateDraftFixture(),
      "Original",
      { title: "Original" },
      transport,
    );
    controller.update("Edited", { title: "Edited" });
    await vi.advanceTimersByTimeAsync(60000);
    expect(transport).toHaveBeenCalledTimes(3);
    expect(controller.snapshot()).toMatchObject({
      phase: "error",
      dirty: true,
      pending: true,
    });
    transport.mockResolvedValueOnce(privateDraftFixture("PAGE", 1));
    await controller.save();
    expect(transport.mock.calls[3]?.[1]).toEqual(transport.mock.calls[0]?.[1]);
    expect(controller.snapshot().dirty).toBe(false);
    controller.dispose();
  });

  it.each([
    "DRAFT_VERSION_CONFLICT",
    "SOURCE_VERSION_CONFLICT",
    "REFERENCE_CONFLICT",
    "REQUEST_REUSE_CONFLICT",
    "IDENTITY_CONFLICT",
  ])("retains local state and stops automatic writes on %s", async (code) => {
    const transport = vi
      .fn()
      .mockRejectedValue(new PrivateDraftRequestError(409, code));
    const controller = new PrivateDraftController(
      privateDraftFixture(),
      "Original",
      { title: "Original" },
      transport,
    );
    controller.update("Edited", { title: "Edited" });
    await vi.advanceTimersByTimeAsync(1000);
    controller.update("Later", { title: "Later" });
    await vi.advanceTimersByTimeAsync(10000);
    expect(transport).toHaveBeenCalledOnce();
    expect(controller.snapshot()).toMatchObject({
      phase: "conflict",
      dirty: true,
    });
    expect(controller.snapshot().message.length).toBeGreaterThan(20);
    controller.dispose();
  });

  it.each([401, 403, 404])("stops when access changes (%s)", async (status) => {
    const transport = vi
      .fn()
      .mockRejectedValue(
        new PrivateDraftRequestError(status, "REQUEST_FAILED"),
      );
    const controller = new PrivateDraftController(
      privateDraftFixture(),
      "Original",
      { title: "Original" },
      transport,
    );
    controller.update("Edited", { title: "Edited" });
    await vi.advanceTimersByTimeAsync(10000);
    expect(controller.snapshot().phase).toBe("conflict");
    expect(transport).toHaveBeenCalledOnce();
    controller.dispose();
  });

  it("discards only unsent local changes and cancels their debounce", async () => {
    const transport = vi.fn();
    const controller = new PrivateDraftController(
      privateDraftFixture("POST", 3),
      "Acknowledged",
      { title: "Acknowledged" },
      transport,
    );
    controller.update("Unsent", { title: "Unsent" });
    expect(controller.discardLocal()).toBe("Acknowledged");
    await vi.advanceTimersByTimeAsync(3000);
    expect(transport).not.toHaveBeenCalled();
    expect(controller.snapshot().dirty).toBe(false);
    controller.dispose();
  });

  it("uses an explicit CAS reset command with the observed live version and retains reload guard", async () => {
    const draft = privateDraftFixture("PAGE", 3);
    draft.currentSourceVersion = 7;
    const transport = vi.fn().mockResolvedValue(privateDraftFixture("PAGE", 4));
    const controller = new PrivateDraftController(
      draft,
      "Original",
      { title: "Original" },
      transport,
    );
    await controller.save("RESET");
    expect(transport.mock.calls[0]?.[1]).toMatchObject({
      operation: "RESET",
      expectedDraftVersion: 3,
      expectedSourceVersion: 7,
      edit: { patch: {} },
    });
    expect(controller.snapshot()).toMatchObject({
      phase: "conflict",
      dirty: true,
      pending: false,
    });
    controller.dispose();
  });

  it("ignores responses after unmount and cancels future autosave timers", async () => {
    const pending = deferred();
    const transport = vi.fn().mockReturnValue(pending.promise);
    const controller = new PrivateDraftController(
      privateDraftFixture(),
      "Original",
      { title: "Original" },
      transport,
    );
    controller.update("Edited", { title: "Edited" });
    await vi.advanceTimersByTimeAsync(1000);
    controller.dispose();
    pending.resolve(privateDraftFixture("PAGE", 1));
    await vi.advanceTimersByTimeAsync(10000);
    expect(controller.snapshot().version).toBe(0);
    expect(transport).toHaveBeenCalledOnce();
  });
});
