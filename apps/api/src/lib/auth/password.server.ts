import "server-only";

import { MAX_PASSWORD_LENGTH } from "@nextpress/shared/auth-policy";
import bcrypt from "bcryptjs";
import { APIError } from "better-auth/api";
import {
  hashPassword as betterAuthHashPassword,
  verifyPassword,
} from "better-auth/crypto";

import { logAbuseThrottle } from "@/lib/security/rate-limit.server";

const MAX_CONCURRENT_PASSWORD_OPERATIONS = 4;
let activePasswordWork = 0;

async function runPasswordWork<T>(work: () => Promise<T>): Promise<T> {
  // Bound credential jobs to the default libuv pool size and cap scrypt memory.
  if (activePasswordWork >= MAX_CONCURRENT_PASSWORD_OPERATIONS) {
    logAbuseThrottle();
    throw new APIError(
      "TOO_MANY_REQUESTS",
      {
        code: "TOO_MANY_REQUESTS",
        message: "Too many requests. Please try again later.",
      },
      { "Cache-Control": "no-store" },
    );
  }

  activePasswordWork++;

  try {
    // Keep capacity occupied until the work settles, even if the caller disconnects.
    return await work();
  } finally {
    activePasswordWork--;
  }
}

export function hashPassword(password: string) {
  return runPasswordWork(() => betterAuthHashPassword(password));
}

export async function verifyCredentialPassword({
  hash,
  password,
}: {
  hash: string;
  password: string;
}) {
  return runPasswordWork(async () => {
    if (password.length > MAX_PASSWORD_LENGTH) {
      return false;
    }

    if (/^\$2[aby]\$/.test(hash)) {
      // Legacy bcrypt cannot distinguish suffixes beyond 72 bytes. These accounts
      // need a new credential when the original password exceeded that boundary.
      if (Buffer.byteLength(password, "utf8") > 72) {
        return false;
      }

      return bcrypt.compare(password, hash);
    }

    return verifyPassword({ hash, password });
  });
}
