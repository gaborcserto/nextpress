import { loadApiEnvironment } from "@nextpress/db/api-environment";
import {
  formatDatabaseTarget,
  resolveDatabase,
} from "@nextpress/db/database-config";

loadApiEnvironment();
const { target } = resolveDatabase(process.env);
console.info(
  `Administrator bootstrap database target: ${formatDatabaseTarget(target)}`,
);

async function runBootstrap() {
  const { prisma } = await import("@nextpress/db");

  try {
    const { bootstrapAdmin } = await import("./admin-bootstrap");

    return await bootstrapAdmin(process.env);
  } finally {
    await prisma.$disconnect();
  }
}

runBootstrap()
  .then(({ preservedPassword }) => {
    console.log(
      preservedPassword
        ? "Administrator bootstrap OK; existing password preserved (ADMIN_PASSWORD was not applied)"
        : "Administrator bootstrap OK; configured password stored",
    );
  })
  .catch(() => {
    console.error(
      "Administrator bootstrap failed; check ADMIN_EMAIL, the password policy, and database configuration",
    );
    process.exitCode = 1;
  });
