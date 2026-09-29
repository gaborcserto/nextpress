import { getAuth } from "@/lib/auth/auth-server";

async function handler(request: Request) {
  const auth = await getAuth();
  return auth.handler(request);
}

export { handler as GET, handler as POST };
