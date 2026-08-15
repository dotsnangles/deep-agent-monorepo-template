import { env } from "@repo/env/server";
import { drizzle } from "drizzle-orm/node-postgres";

import { DrizzleChatRepository } from "./repositories";
import * as schema from "./schema";

export * from "./schema";
export * from "./repositories";

export function createDb() {
  return drizzle(env.DATABASE_URL, { schema });
}

export const db = createDb();
export const chatRepository = new DrizzleChatRepository(db);


