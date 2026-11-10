import {
  SessionDiscoverySchema,
  ProviderDiscoverySchema,
} from "@nextpress/shared/api-contracts";
import { expect, it, vi } from "vitest";

const { session, providers } = vi.hoisted(() => ({
  session: vi.fn(),
  providers: vi.fn(),
}));
vi.mock("@/lib/auth/auth-server", () => ({
  getRequestSessionWithRole: session,
  getOperationalOAuthProviders: providers,
}));
import { GET as discoverProviders } from "./providers/route";
import { GET as discoverSession } from "./session/route";
it.each([null, "SUBSCRIBER", "AUTHOR", "EDITOR", "ADMIN"])(
  "projects only safe session identity for %s",
  async (role) => {
    session.mockResolvedValue(
      role
        ? {
            user: {
              id: "user",
              name: "Name",
              role,
              email: "secret",
              token: "secret",
            },
            session: { token: "secret" },
          }
        : null,
    );
    const request = new Request("http://localhost", {
      headers: { cookie: "session" },
    });
    const response = await discoverSession(request);
    expect(session).toHaveBeenLastCalledWith(request.headers);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    const body = await response.json();
    expect(SessionDiscoverySchema.safeParse(body).success).toBe(true);
    expect(JSON.stringify(body)).not.toContain("secret");
  },
);
it("returns only operational provider names", async () => {
  providers.mockResolvedValue(["github"]);
  const body = await (await discoverProviders()).json();
  expect(ProviderDiscoverySchema.parse(body)).toEqual({
    providers: ["github"],
  });
});

it("does not treat a database outage as an anonymous session", async () => {
  session.mockRejectedValueOnce(new Error("ECONNREFUSED private database"));
  const response = await discoverSession(new Request("http://localhost"));

  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({ error: "Unexpected error" });
});
