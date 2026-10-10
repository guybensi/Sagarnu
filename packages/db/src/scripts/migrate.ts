import "dotenv/config";
import { fileURLToPath } from "node:url";
import { createDb } from "../client";
import { seed } from "../seed";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const handle = createDb(url);
await handle.migrate(fileURLToPath(new URL("../../drizzle", import.meta.url)));
await seed(handle.db);
await handle.close();
console.log("migrations applied");
