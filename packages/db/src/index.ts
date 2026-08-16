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
  get(_target, prop, receiver) {
    const realDb = getDb();
    const value = Reflect.get(realDb, prop, receiver);
    if (typeof value === "function") {
      return value.bind(realDb);
    }
    return value;
  },
});

export const chatRepository = new DrizzleChatRepository(db);
export const drizzleChatRepository = chatRepository;
