import { db } from "@/db/db";
import { records } from "@/db/schema";

export async function createRecord(data: {
  title: string;
  description?: string;
  category?: string;
  userId: string;
}) {
  const result = await db.insert(records).values(data).returning();
  return result[0];
}

