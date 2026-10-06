import "server-only";

import { MAX_PASSWORD_LENGTH } from "@nextpress/shared/auth-policy";
import bcrypt from "bcryptjs";
import { APIError } from "better-auth/api";
import { hashPassword as betterAuthHashPassword, verifyPassword } from "better-auth/crypto";

import { logAbuseThrottle } from "@/lib/security/rate-limit.server";

let activePasswordWork = 0;

async function runPasswordWork<T>(work: () => Promise<T>): Promise<T> {
  // Bound both libuv queued work and scrypt memory; there is no unbounded wait queue.
  if (activePasswordWork >= 4) {
    logAbuseThrottle();
    throw new APIError("TOO_MANY_REQUESTS", {
      code: "TOO_MANY_REQUESTS", message: "Too many requests. Please try again later.",
    }, { "Retry-After": "1", "Cache-Control": "no-store" });
  }
  activePasswordWork++;
  try {
    return await work();
  } finally {
    activePasswordWork--;
  }
}

export function hashPassword(password: string) {
  return runPasswordWork(() => betterAuthHashPassword(password));
}

export async function verifyCredentialPassword({ hash, password }: { hash: string; password: string }) {
  if (password.length > MAX_PASSWORD_LENGTH) return false;
  if (/^\$2[aby]\$/.test(hash)) {
    // Legacy bcrypt cannot distinguish suffixes beyond 72 bytes. These accounts
    // need a new credential when the original password exceeded that boundary.
    if (Buffer.byteLength(password, "utf8") > 72) return false;
    return runPasswordWork(() => bcrypt.compare(password, hash));
  }
  return runPasswordWork(() => verifyPassword({ hash, password }));
}
