import { polarClient } from "@polar-sh/better-auth/client";
import { createAuthClient } from "better-auth/react";

function getAuthBaseUrl() {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/auth`;
  }
  return process.env.BETTER_AUTH_URL
    ? `${process.env.BETTER_AUTH_URL}/api/auth`
    : "http://localhost:3000/api/auth";
}

export const authClient = createAuthClient({
  baseURL: getAuthBaseUrl(),
  plugins: [polarClient()],
});
