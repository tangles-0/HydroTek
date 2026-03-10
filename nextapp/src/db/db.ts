import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";

const url = (process.env.POSTGRES_URL || process.env.DATABASE_URL) as string;

export const client = postgres(url, { ssl: "require" });
export const db = drizzle(client, { schema });


