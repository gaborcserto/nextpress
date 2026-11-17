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
