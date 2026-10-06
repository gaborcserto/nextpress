import "server-only";

import { MAX_PASSWORD_LENGTH } from "@nextpress/shared/auth-policy";
import bcrypt from "bcryptjs";
import { hashPassword, verifyPassword } from "better-auth/crypto";

export { hashPassword };

export async function verifyCredentialPassword({ hash, password }: { hash: string; password: string }) {
  if (password.length > MAX_PASSWORD_LENGTH) return false;
  if (/^\$2[aby]\$/.test(hash)) {
    // Legacy bcrypt cannot distinguish suffixes beyond 72 bytes. These accounts
    // need a new credential when the original password exceeded that boundary.
    if (Buffer.byteLength(password, "utf8") > 72) return false;
    return bcrypt.compare(password, hash);
  }
  return verifyPassword({ hash, password });
}
