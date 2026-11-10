async function expireFixtureSession() {
  const url = new URL(process.env.DATABASE_URL ?? "");

  if (
    url.hostname !== "localhost" ||
    url.port !== "55441" ||
    url.pathname !== "/nextpress_e2e"
  )
    throw new Error("Session expiry requires the disposable E2E database");
  const { prisma } = await import("@nextpress/db/src/client");

  try {
    await prisma.session.updateMany({
      where: { user: { email: "admin@example.invalid" } },
      data: { expires: new Date(0) },
    });
  } finally {
    await prisma.$disconnect();
  }
}

expireFixtureSession().catch(() => {
  console.error("Disposable session expiry fixture failed");
  process.exitCode = 1;
});
