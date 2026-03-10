import { db } from "@/db/db";
import { records } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function updateRecord(
  recordId: string,
  data: {
    title?: string;
    description?: string;
    category?: string;
  }
) {
  const result = await db
    .update(records)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(records.id, recordId))
    .returning();
  return result[0];
}

