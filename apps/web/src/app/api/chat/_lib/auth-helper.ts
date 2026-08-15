import { auth } from "@repo/auth";
import { headers } from "next/headers";

export async function getAuthenticatedUserId(): Promise<string | null> {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({
    headers: reqHeaders,
  });

  return session?.user?.id || null;
}
