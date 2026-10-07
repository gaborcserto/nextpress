import { prisma } from "@nextpress/db";

import { bootstrapAdmin } from "./admin-bootstrap";

bootstrapAdmin(process.env)
  .then(({ preservedPassword }) => {
    console.log(preservedPassword
      ? "Administrator bootstrap OK; existing password preserved (ADMIN_PASSWORD was not applied)"
      : "Administrator bootstrap OK; configured password stored");
  })
  .catch(() => {
    console.error("Administrator bootstrap failed; check ADMIN_EMAIL, the password policy, and database configuration");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
