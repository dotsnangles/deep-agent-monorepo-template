import { env } from "@repo/env/server";
import { drizzle } from "drizzle-orm/node-postgres";

import { DrizzleChatRepository } from "./repositories";
import * as schema from "./schema";

export * from "./schema";
export * from "./repositories";

export function createDb() {
  return drizzle(env.DATABASE_URL, { schema });
}

let _db: ReturnType<typeof createDb> | null = null;

export function getDb() {
  if (!_db) {
    _db = createDb();
  }
  return _db;
}

export const db = new Proxy({} as ReturnType<typeof createDb>, {
  get(_target, prop) {
    const realDb = getDb();
    return (realDb as any)[prop];
  },
});

export const chatRepository = new DrizzleChatRepository(db);
