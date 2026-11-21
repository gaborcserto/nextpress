import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { setImmediate as nextTurn } from "node:timers/promises";
import { z } from "zod";

import type { PrismaClient } from "@nextpress/db/generated/prisma/client";

const manifestSchema = z.object({
  run: z.string().regex(/^[a-f0-9]{12}$/),
  container: z.string().regex(/^[a-f0-9]{64}$/),
  image: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  network: z.string().regex(/^[a-f0-9]{64}$/),
  address: z.ipv4(),
  port: z.number().int().min(1024).max(65535),
  database: z
    .string()
    .regex(/^nextpress_(phase1|security)_verify_[a-f0-9]{12}$/),
  cluster: z.string().regex(/^\d+$/),
  nonce: z.string().regex(/^[a-f0-9]{64}$/),
});

export type DisposableManifest = z.infer<typeof manifestSchema>;

// The standalone runner and its npm-workspace test children share the API cwd.
export const disposableManifestPath = resolve(".b04-disposable.json");

export function readDisposableManifest(evidencePath = disposableManifestPath) {
  try {
    return manifestSchema.parse(JSON.parse(readFileSync(evidencePath, "utf8")));
  } catch {
    throw new Error(
      "Runner-owned disposable database evidence is missing or invalid",
    );
  }
}

type DatabaseIdentity = {
  version: number;
  name: string;
  address: string;
  port: number;
  recovery: boolean;
  role: string;
  privileged: boolean;
  memberships: boolean;
  foreign_access: boolean;
  cluster: string;
  nonce: string;
  marker_owner: string;
};

export function verifyConnectedIdentity(
  manifest: DisposableManifest,
  identity: DatabaseIdentity | undefined,
) {
  if (
    !identity ||
    identity.version !== 180000 ||
    identity.name !== manifest.database ||
    identity.address !== manifest.address ||
    identity.port !== 5432 ||
    identity.recovery ||
    identity.role !== "b04_runtime" ||
    identity.privileged ||
    identity.memberships ||
    identity.foreign_access ||
    identity.cluster !== manifest.cluster ||
    identity.nonce !== manifest.nonce ||
    identity.marker_owner !== "b04_provisioner"
  ) {
    throw new Error("Connected disposable database identity mismatch");
  }
}

const inspectionSchema = z
  .array(
    z.object({
      Id: z.string(),
      Image: z.string(),
      State: z.object({ Running: z.boolean() }),
      Config: z.object({ Labels: z.record(z.string(), z.string()) }),
      HostConfig: z.object({
        NetworkMode: z.string(),
        Privileged: z.boolean(),
        Tmpfs: z.record(z.string(), z.string()),
        PortBindings: z.record(
          z.string(),
          z.array(z.object({ HostIp: z.string(), HostPort: z.string() })),
        ),
      }),
      Mounts: z.array(z.object({ Type: z.string(), Destination: z.string() })),
      NetworkSettings: z.object({
        Networks: z.record(
          z.string(),
          z.object({ NetworkID: z.string(), IPAddress: z.string() }),
        ),
      }),
    }),
  )
  .length(1);

export function disposableDockerContext(platform = process.platform) {
  if (platform === "win32") {
    return {
      name: "desktop-linux",
      endpoint: "npipe:////./pipe/dockerDesktopLinuxEngine",
    };
  }

  if (platform === "linux") {
    return { name: "default", endpoint: "unix:///var/run/docker.sock" };
  }

  throw new Error("Unsupported disposable Docker platform");
}

function docker(...args: string[]) {
  // Never include environment or credentials in diagnostics.
  try {
    return execFileSync(
      "docker",
      ["--context", disposableDockerContext().name, ...args],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 10000,
      },
    ).trim();
  } catch {
    throw new Error("Disposable Docker identity inspection failed");
  }
}

export function verifyDockerEvidence(
  manifest: DisposableManifest,
  raw: unknown,
  networkRaw: unknown,
) {
  const [container] = inspectionSchema.parse(raw);
  const [network] = z
    .array(
      z.object({
        Id: z.string(),
        Driver: z.string(),
        Scope: z.string(),
        Internal: z.boolean(),
        Labels: z.record(z.string(), z.string()),
        Containers: z.record(z.string(), z.unknown()),
      }),
    )
    .length(1)
    .parse(networkRaw);

  if (!container || !network) {
    throw new Error("Missing Docker evidence");
  }

  const endpoints = Object.values(container.NetworkSettings.Networks);
  const ports = container.HostConfig.PortBindings;
  const bindings = ports["5432/tcp"];
  const mounts = container.Mounts;

  if (
    container.Id !== manifest.container ||
    container.Image !== manifest.image ||
    !container.State.Running ||
    container.Config.Labels["nextpress.disposable"] !== manifest.run ||
    container.HostConfig.Privileged ||
    container.HostConfig.NetworkMode !== `nextpress-b04-${manifest.run}` ||
    Object.keys(container.HostConfig.Tmpfs).join() !== "/var/lib/postgresql" ||
    mounts.some(
      (mount) =>
        mount.Type !== "tmpfs" || mount.Destination !== "/var/lib/postgresql",
    ) ||
    endpoints.length !== 1 ||
    endpoints[0]?.NetworkID !== manifest.network ||
    endpoints[0]?.IPAddress !== manifest.address ||
    Object.keys(ports).join() !== "5432/tcp" ||
    bindings?.length !== 1 ||
    bindings[0]?.HostIp !== "127.0.0.1" ||
    bindings[0]?.HostPort !== String(manifest.port) ||
    network.Id !== manifest.network ||
    network.Driver !== "bridge" ||
    network.Scope !== "local" ||
    network.Internal ||
    network.Labels["nextpress.disposable"] !== manifest.run ||
    Object.keys(network.Containers).join() !== manifest.container
  ) {
    throw new Error("Disposable Docker topology mismatch");
  }
}

export function watchDisposableInterrupt() {
  const controller = new AbortController();
  const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];

  if (process.platform === "win32") {
    signals.push("SIGBREAK");
  }

  function interrupt(signal: NodeJS.Signals) {
    controller.abort(new Error(`Disposable test interrupted by ${signal}`));
    process.exitCode = 1;
  }

  for (const signal of signals) {
    process.on(signal, interrupt);
  }

  return {
    async checkpoint() {
      await nextTurn();
      controller.signal.throwIfAborted();
    },
    close() {
      for (const signal of signals) {
        process.off(signal, interrupt);
      }
    },
  };
}

export function removeDisposableNetwork(network: string, run: string) {
  const [owned] = z
    .array(
      z.object({
        Id: z.string(),
        Labels: z.record(z.string(), z.string()),
        Containers: z.record(z.string(), z.unknown()),
      }),
    )
    .length(1)
    .parse(JSON.parse(docker("network", "inspect", network)));

  if (
    !owned ||
    owned.Id !== network ||
    owned.Labels["nextpress.disposable"] !== run ||
    Object.keys(owned.Containers).length
  ) {
    throw new Error(
      "Refusing cleanup of an unowned or shared disposable network",
    );
  }

  docker("network", "rm", network);
}

// Before PostgreSQL starts, cluster/SQL evidence cannot exist. Cleanup can only
// target exact IDs returned by this run's create commands, never discovered peers.
export function verifyProvisioningCleanup(
  expected: Pick<
    DisposableManifest,
    "run" | "container" | "network" | "image" | "port"
  > & { networkName?: string },
  raw: unknown,
  networkRaw: unknown,
) {
  const [container] = inspectionSchema.parse(raw);
  const [network] = z
    .array(
      z.object({
        Id: z.string(),
        Driver: z.string(),
        Scope: z.string(),
        Internal: z.boolean(),
        Labels: z.record(z.string(), z.string()),
        Containers: z.record(z.string(), z.unknown()),
      }),
    )
    .length(1)
    .parse(networkRaw);
  const bindings = container?.HostConfig.PortBindings["5432/tcp"];
  const endpoints = Object.values(container?.NetworkSettings.Networks ?? {});

  if (
    !container ||
    !network ||
    container.Id !== expected.container ||
    container.Image !== expected.image ||
    container.Config.Labels["nextpress.disposable"] !== expected.run ||
    container.HostConfig.Privileged ||
    container.HostConfig.NetworkMode !==
      (expected.networkName ?? `nextpress-b04-${expected.run}`) ||
    endpoints.length > 1 ||
    (container.State.Running && endpoints.length !== 1) ||
    endpoints.some(
      (endpoint) =>
        endpoint.NetworkID !== "" && endpoint.NetworkID !== expected.network,
    ) ||
    Object.keys(container.HostConfig.Tmpfs).join() !== "/var/lib/postgresql" ||
    container.Mounts.some(
      (mount) =>
        mount.Type !== "tmpfs" || mount.Destination !== "/var/lib/postgresql",
    ) ||
    Object.keys(container.HostConfig.PortBindings).join() !== "5432/tcp" ||
    bindings?.length !== 1 ||
    bindings[0]?.HostIp !== "127.0.0.1" ||
    bindings[0]?.HostPort !== String(expected.port) ||
    network.Id !== expected.network ||
    network.Driver !== "bridge" ||
    network.Scope !== "local" ||
    network.Internal ||
    network.Labels["nextpress.disposable"] !== expected.run ||
    Object.keys(network.Containers).some((id) => id !== expected.container)
  ) {
    throw new Error("Refusing cleanup of unowned provisioning resources");
  }
}

export function verifyLocalDocker() {
  const context = docker(
    "context",
    "inspect",
    "--format",
    "{{.Endpoints.docker.Host}}",
  );

  if (context !== disposableDockerContext().endpoint) {
    throw new Error(
      "Only the independently inspected local Docker daemon is allowed",
    );
  }
}

export function verifyDockerTarget(manifest: DisposableManifest) {
  verifyLocalDocker();
  verifyDockerEvidence(
    manifest,
    JSON.parse(docker("inspect", manifest.container)),
    JSON.parse(docker("network", "inspect", manifest.network)),
  );
  const cluster = docker(
    "exec",
    manifest.container,
    "psql",
    "-XAt",
    "-U",
    "b04_provisioner",
    "-d",
    manifest.database,
    "-c",
    "SELECT system_identifier FROM pg_control_system()",
  );

  if (cluster !== manifest.cluster) {
    throw new Error("Disposable cluster identity mismatch");
  }
}

export async function verifyDisposableDatabase(
  expected: string,
  candidate: PrismaClient,
  evidence: unknown = readDisposableManifest(),
) {
  const manifest = manifestSchema.parse(evidence);
  const url = new URL(process.env.DATABASE_URL ?? "");

  if (
    expected !== manifest.database ||
    url.pathname !== `/${manifest.database}` ||
    url.hostname !== "127.0.0.1" ||
    url.port !== String(manifest.port) ||
    url.username !== "b04_runtime" ||
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "Database URL is not approved by the provisioning manifest",
    );
  }

  verifyDockerTarget(manifest);
  const [identity] = await candidate.$queryRaw<
    DatabaseIdentity[]
  >`SELECT current_setting('server_version_num')::integer AS version,
    current_database() AS name, host(inet_server_addr()) AS address, inet_server_port() AS port,
    pg_is_in_recovery() AS recovery, current_user AS role,
    (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls) AS privileged,
    EXISTS(SELECT 1 FROM pg_auth_members WHERE member = r.oid) AS memberships,
    EXISTS(SELECT 1 FROM pg_database WHERE datname <> current_database() AND has_database_privilege(current_user, oid, 'CONNECT')) AS foreign_access,
    (SELECT system_identifier::text FROM pg_control_system()) AS cluster,
    (SELECT nonce FROM b04_identity.marker) AS nonce,
    (SELECT tableowner FROM pg_tables WHERE schemaname='b04_identity' AND tablename='marker') AS marker_owner
    FROM pg_roles r WHERE rolname=current_user`;

  verifyConnectedIdentity(manifest, identity);
  // Reinspect after the SQL probe, before the caller can assign a cleanup handle.
  verifyDockerTarget(manifest);
}
