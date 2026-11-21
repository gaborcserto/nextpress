import { execFileSync } from "node:child_process";
import { mkdtempSync, unlinkSync, rmdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it, vi } from "vitest";

import { disposableDatabaseName } from "./disposable-database";
import {
  readDisposableManifest,
  disposableDockerContext,
  verifyConnectedIdentity,
  verifyDockerEvidence,
  verifyLocalDocker,
  verifyProvisioningCleanup,
  type DisposableManifest,
} from "./docker-database";

vi.mock("node:child_process", () => ({ execFileSync: vi.fn() }));

it("pins Docker inspection to the local context despite environment overrides", () => {
  const execute = vi.mocked(execFileSync);
  execute.mockReturnValue(disposableDockerContext().endpoint);
  vi.stubEnv("DOCKER_HOST", "tcp://remote.invalid:2375");
  vi.stubEnv("DOCKER_CONTEXT", "remote");

  try {
    expect(() => verifyLocalDocker()).not.toThrow();
    expect(execute).toHaveBeenCalledWith(
      "docker",
      [
        "--context",
        disposableDockerContext().name,
        "context",
        "inspect",
        "--format",
        "{{.Endpoints.docker.Host}}",
      ],
      expect.any(Object),
    );
    execute.mockReturnValue("tcp://remote.invalid:2375");
    expect(() => verifyLocalDocker()).toThrow();
  } finally {
    vi.unstubAllEnvs();
    execute.mockReset();
  }
});

it("requires valid runner evidence and refuses to overwrite an existing run", () => {
  const directory = mkdtempSync(join(tmpdir(), "nextpress-b04-guard-"));
  const path = join(directory, "evidence.json");

  try {
    expect(() => readDisposableManifest(path)).toThrow();
    writeFileSync(path, JSON.stringify(manifest), { flag: "wx", mode: 0o600 });
    expect(readDisposableManifest(path)).toEqual(manifest);
    expect(() => writeFileSync(path, "{}", { flag: "wx" })).toThrow();
    writeFileSync(path, "{}");
    expect(() => readDisposableManifest(path)).toThrow();
    writeFileSync(path, "invalid JSON");
    expect(() => readDisposableManifest(path)).toThrow();
  } finally {
    unlinkSync(path);
    rmdirSync(directory);
  }
});

it.each([
  undefined,
  "postgresql://localhost/cms",
  "postgresql://remote/nextpress_phase1_verify_test",
  "postgresql://localhost/nextpress_phase1_verify",
  "postgresql://localhost/nextpress_phase1_verify_test?host=remote",
  "https://localhost/nextpress_phase1_verify_test",
])("rejects unsafe database target %s", (url) => {
  expect(() => disposableDatabaseName(url, url, "content")).toThrow();
});

it("rejects recovery, privileged roles, memberships, foreign grants and writable markers", () => {
  const identity = {
    version: 180000,
    name: manifest.database,
    address: manifest.address,
    port: 5432,
    recovery: false,
    role: "b04_runtime",
    privileged: false,
    memberships: false,
    foreign_access: false,
    cluster: manifest.cluster,
    nonce: manifest.nonce,
    marker_owner: "b04_provisioner",
  };
  expect(() => verifyConnectedIdentity(manifest, identity)).not.toThrow();
  expect(() => verifyConnectedIdentity(manifest, undefined)).toThrow();

  for (const field of [
    "recovery",
    "privileged",
    "memberships",
    "foreign_access",
  ] as const) {
    expect(() =>
      verifyConnectedIdentity(manifest, { ...identity, [field]: true }),
    ).toThrow();
  }

  expect(() =>
    verifyConnectedIdentity(manifest, {
      ...identity,
      marker_owner: "b04_runtime",
    }),
  ).toThrow();
});

it("requires matching opt-in URLs", () => {
  const url = "postgresql://127.0.0.1/nextpress_phase1_verify_test";
  expect(disposableDatabaseName(url, url, "content")).toBe(
    "nextpress_phase1_verify_test",
  );
  expect(() => disposableDatabaseName(url, undefined, "content")).toThrow();
  expect(() => disposableDatabaseName(url, url, "security")).toThrow();
});

const manifest: DisposableManifest = {
  run: "a".repeat(12),
  container: "b".repeat(64),
  image: `sha256:${"c".repeat(64)}`,
  network: "d".repeat(64),
  address: "172.30.0.2",
  port: 55432,
  database: `nextpress_phase1_verify_${"a".repeat(12)}`,
  cluster: "123456789",
  nonce: "e".repeat(64),
};

function evidence() {
  return {
    container: [
      {
        Id: manifest.container,
        Image: manifest.image,
        State: { Running: true },
        Config: { Labels: { "nextpress.disposable": manifest.run } },
        HostConfig: {
          NetworkMode: `nextpress-b04-${manifest.run}`,
          Privileged: false,
          Tmpfs: { "/var/lib/postgresql": "rw" },
          PortBindings: {
            "5432/tcp": [{ HostIp: "127.0.0.1", HostPort: "55432" }],
          },
        },
        Mounts: [],
        NetworkSettings: {
          Networks: {
            isolated: {
              NetworkID: manifest.network,
              IPAddress: manifest.address,
            },
          },
        },
      },
    ],
    network: [
      {
        Id: manifest.network,
        Driver: "bridge",
        Scope: "local",
        Internal: false,
        Labels: { "nextpress.disposable": manifest.run },
        Containers: { [manifest.container]: {} },
      },
    ],
  };
}

it("accepts exactly verified isolated bridge evidence", () => {
  const target = evidence();
  expect(() =>
    verifyDockerEvidence(manifest, target.container, target.network),
  ).not.toThrow();
});

it.each(["container", "image", "network", "address", "port", "run"] as const)(
  "rejects mismatched %s identity",
  (field) => {
    const target = evidence();
    const changed = {
      ...manifest,
      [field]: field === "port" ? 5432 : "mismatch",
    };
    expect(() =>
      verifyDockerEvidence(changed, target.container, target.network),
    ).toThrow();
  },
);

it("rejects shared networks, volumes and wildcard publications", () => {
  const shared = evidence();
  shared.network[0]!.Containers.other = {};
  expect(() =>
    verifyDockerEvidence(manifest, shared.container, shared.network),
  ).toThrow();
  const published = evidence();
  published.container[0]!.HostConfig.PortBindings["5432/tcp"][0]!.HostIp =
    "0.0.0.0";
  expect(() =>
    verifyDockerEvidence(manifest, published.container, published.network),
  ).toThrow();
  const volume = evidence();
  expect(() =>
    verifyDockerEvidence(
      manifest,
      [
        {
          ...volume.container[0],
          Mounts: [{ Type: "volume", Destination: "/var/lib/postgresql" }],
        },
      ],
      volume.network,
    ),
  ).toThrow();
});

it("pins supported Docker contexts to local endpoints and rejects other platforms", () => {
  expect(disposableDockerContext("linux")).toEqual({
    name: "default",
    endpoint: "unix:///var/run/docker.sock",
  });
  expect(disposableDockerContext("win32")).toEqual({
    name: "desktop-linux",
    endpoint: "npipe:////./pipe/dockerDesktopLinuxEngine",
  });
  expect(() => disposableDockerContext("darwin")).toThrow();
});

it("recognizes an owned container whose network endpoint has not been created", () => {
  const target = evidence();
  const container = target.container.map((item) => ({
    ...item,
    State: { Running: false },
    NetworkSettings: { Networks: {} },
  }));
  const network = target.network.map((item) => ({ ...item, Containers: {} }));

  expect(() =>
    verifyProvisioningCleanup(manifest, container, network),
  ).not.toThrow();
  expect(() =>
    verifyProvisioningCleanup(
      manifest,
      container.map((item) => ({ ...item, State: { Running: true } })),
      network,
    ),
  ).toThrow();
});

it("cleans only owned provisioning resources even when startup fails", () => {
  const target = evidence();
  target.container[0]!.State.Running = false;
  expect(() =>
    verifyProvisioningCleanup(manifest, target.container, target.network),
  ).not.toThrow();
  expect(() =>
    verifyDockerEvidence(manifest, target.container, target.network),
  ).toThrow();

  for (const field of ["container", "network", "image", "run"] as const) {
    expect(() =>
      verifyProvisioningCleanup(
        { ...manifest, [field]: "unowned" },
        target.container,
        target.network,
      ),
    ).toThrow();
  }

  target.network[0]!.Containers.other = {};
  expect(() =>
    verifyProvisioningCleanup(manifest, target.container, target.network),
  ).toThrow();
});
