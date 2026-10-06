import { readBoundedMutationRequest } from "@/lib/api/mutation.server";
import { getAuth } from "@/lib/auth/auth-server";
import { authBudgets, tooManyRequests } from "@/lib/security/rate-limit.server";

export const runtime = "nodejs";

async function handler(request: Request) {
  const path = new URL(request.url).pathname;
  // Before parsing or loading provider configuration, including malformed requests.
  if (/^\/api\/auth\/(sign-in\/|sign-up\/|callback\/|link-social|change-password|verify-password)/.test(path)) {
    const retry = authBudgets.consume("auth-ingress", 120, 60_000);
    if (retry !== null) return tooManyRequests(retry);
  }
  const bounded = await readBoundedMutationRequest(request, 16_384);
  if (bounded.response) return bounded.response;
  const auth = await getAuth();
  return auth.handler(bounded.request ?? request);
}

export { handler as GET, handler as POST };
