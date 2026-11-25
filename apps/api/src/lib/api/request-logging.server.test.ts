import {
  apiRequestId,
  isRequestId,
  newRequestId,
  requestIdHeader,
  setUpstreamRequestId,
} from "@nextpress/shared/request-correlation";
import { writeServerLog } from "@nextpress/shared/server-logging";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { internalError } from "./http";
import { apiLogContext } from "./request-log-context.server";
import { withRequestLogging } from "./request-logging.server";

beforeEach(() => {
  vi.stubEnv(
    "NEXTPRESS_REQUEST_CORRELATION_SECRET",
    "test-shared-correlation-key-at-least-32-bytes",
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

it("retains an authenticated ID and replaces an unsigned or tampered ID", () => {
  const id = newRequestId();
  const headers = new Headers({ [requestIdHeader]: id });
  expect(apiRequestId(headers)).not.toBe(id);

  setUpstreamRequestId(headers, id);
  expect(apiRequestId(headers)).toBe(id);

  const tampered = newRequestId();
  headers.set(requestIdHeader, tampered);
  expect(apiRequestId(headers)).not.toBe(tampered);

  setUpstreamRequestId(headers, id);
  vi.stubEnv("NEXTPRESS_REQUEST_CORRELATION_SECRET", "");
  expect(apiRequestId(headers)).not.toBe(id);
});

it.each([
  undefined,
  "not-an-id<script>",
  "a".repeat(4096),
  "00000000-0000-4000-0000-000000000000",
])(
  "generates a safe error response ID for invalid or missing input %#",
  async (id) => {
    const headers = new Headers();

    if (id) {
      setUpstreamRequestId(headers, id);
    }

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const handler = withRequestLogging("protected", () =>
      Response.json({ error: "Forbidden" }, { status: 403 }),
    );

    const response = await handler(
      new Request("http://localhost", { headers }),
    );

    const requestId = response.headers.get(requestIdHeader);
    expect(isRequestId(requestId)).toBe(true);
    expect(requestId).not.toBe(id);
    expect(await response.json()).toEqual({ error: "Forbidden" });
    expect(JSON.parse(warn.mock.calls[0][0])).toMatchObject({
      event: "api.request.rejected",
      code: "authorization",
      level: "warn",
      status: 403,
      requestId,
    });
  },
);

it.each([
  [400, "validation"],
  [401, "authentication"],
] as const)("distinguishes expected HTTP %i failures", async (status, code) => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
  const handler = withRequestLogging(
    "protected",
    () => new Response(null, { status }),
  );

  const response = await handler(new Request("http://localhost"));
  expect(response.status).toBe(status);
  expect(JSON.parse(warn.mock.calls[0][0])).toMatchObject({
    code,
    status,
    level: "warn",
    requestId: response.headers.get(requestIdHeader),
  });
  expect(errorLog).not.toHaveBeenCalled();
});

it("keeps concurrent request logs separate and logs the failure once", async () => {
  let releaseFirst = () => {};
  const blocked = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });

  let firstEntered = () => {};
  const entered = new Promise<void>((resolve) => {
    firstEntered = resolve;
  });
  const first = newRequestId();
  const second = newRequestId();
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const handler = withRequestLogging("public.settings", async (request) => {
    if (new URL(request.url).pathname === "/a") {
      firstEntered();
      await blocked;
    }

    return internalError(
      Object.assign(new Error("private SQL: password=secret"), {
        name: "PrismaClientKnownRequestError",
      }),
    );
  });
  const firstHeaders = new Headers();
  setUpstreamRequestId(firstHeaders, first);
  const secondHeaders = new Headers();
  setUpstreamRequestId(secondHeaders, second);

  const pending = handler(
    new Request("http://localhost/a", { headers: firstHeaders }),
  );
  await entered;
  const other = await handler(
    new Request("http://localhost/b", { headers: secondHeaders }),
  );
  releaseFirst();
  const response = await pending;

  expect(apiLogContext()).toBeUndefined();
  expect(response.headers.get(requestIdHeader)).toBe(first);
  expect(other.headers.get(requestIdHeader)).toBe(second);
  expect(await response.json()).toEqual({ error: "Unexpected error" });
  expect(log.mock.calls.map(([line]) => JSON.parse(line))).toEqual(
    [second, first].map((requestId) =>
      expect.objectContaining({
        timestamp: expect.stringMatching(
          /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/,
        ),
        service: "api",
        event: "api.request.failed",
        category: "operational",
        outcome: "failure",
        level: "error",
        operation: "public.settings",
        code: "database",
        status: 500,
        requestId,
      }),
    ),
  );
  expect(JSON.stringify(log.mock.calls)).not.toContain("password=secret");
});

it("logs allowlisted database diagnostics without exposing error messages", async () => {
  const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
  const failure = Object.assign(new Error("private SQL: password=secret"), {
    name: "PrismaClientKnownRequestError",
    code: "P2003",
    meta: { constraint: "NavigationItem_menuId_parentId_fkey" },
  });

  const response = await withRequestLogging("protected", () =>
    internalError(failure),
  )(new Request("http://localhost"));

  const record = JSON.parse(errorLog.mock.calls[0][0]);
  expect(record).toMatchObject({
    code: "database",
    errorClass: "PrismaClientKnownRequestError",
    prismaCode: "P2003",
    constraint: "NavigationItem_menuId_parentId_fkey",
  });
  expect(JSON.stringify(record)).not.toContain("password=secret");
  expect(await response.json()).toEqual({ error: "Unexpected error" });
});

it("keeps separate delegated cookies and status on correlated redirects", async () => {
  const headers = new Headers({ location: "https://www.example.test" });
  headers.append("Set-Cookie", "session=one; HttpOnly");
  headers.append("Set-Cookie", "state=two; HttpOnly");
  const handler = withRequestLogging(
    "auth",
    () => new Response(null, { status: 302, headers }),
  );

  const response = await handler(new Request("http://localhost"));
  expect(response.status).toBe(302);
  expect(response.headers.get("location")).toBe("https://www.example.test");
  expect(response.headers.getSetCookie()).toEqual(headers.getSetCookie());
  expect(isRequestId(response.headers.get(requestIdHeader))).toBe(true);
});

it("writes only allowlisted, correctly typed fields and never serializes input objects", () => {
  const log = vi.spyOn(console, "info").mockImplementation(() => {});
  const requestId = newRequestId();
  const actorId = "c123456789012345678901234";
  const fields = {
    requestId,
    actorId,
    targetId: new Error("token=secret"),
    role: { password: "secret" },
    action: "publish",
    cookie: "session=secret",
    get body() {
      throw new Error("Logger must not access request bodies");
    },
  };
  Reflect.apply(writeServerLog, undefined, [
    "api",
    "user.role.changed",
    fields,
  ]);
  expect(JSON.parse(log.mock.calls[0][0])).toEqual({
    timestamp: expect.any(String),
    service: "api",
    event: "user.role.changed",
    category: "audit",
    level: "info",
    outcome: "success",
    requestId,
    actorId,
  });
});

it("omits invalid revision IDs and metadata from other events", () => {
  const log = vi.spyOn(console, "info").mockImplementation(() => {});
  const fields = {
    actorId: "c123456789012345678901234",
    targetId: "c123456789012345678901235",
    revisionId: "invalid\nidentifier",
    sourceRevisionId: "c123456789012345678901236",
    role: "ADMIN",
    code: "transport",
  };
  writeServerLog("api", "revision.saved", fields);
  expect(JSON.parse(log.mock.calls[0][0])).toEqual({
    timestamp: expect.any(String),
    service: "api",
    event: "revision.saved",
    category: "audit",
    level: "info",
    outcome: "success",
    actorId: fields.actorId,
    targetId: fields.targetId,
  });
});

it("requires event-specific audit fields", () => {
  const target = { actorId: "actor", targetId: "target" };

  const checkTypes = () => {
    // @ts-expect-error A saved revision requires its persisted ID.
    writeServerLog("api", "revision.saved", target);
    // @ts-expect-error A restore requires the newly persisted revision ID.
    writeServerLog("api", "revision.transition", {
      ...target,
      action: "restore",
    });
    // @ts-expect-error A role change requires the assigned role.
    writeServerLog("api", "user.role.changed", target);
    // @ts-expect-error A deletion requires its actor and target.
    writeServerLog("api", "user.deleted");
  };
  expect(checkTypes).toBeTypeOf("function");
});
