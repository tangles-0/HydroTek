import { db } from "@/db/db";
import { records } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function getRecord(recordId: string) {
  const result = await db.select().from(records).where(eq(records.id, recordId));
  return result[0] || null;
}

