import { db } from "@/db/db";
import { records } from "@/db/schema";
import { and, eq, ilike, or } from "drizzle-orm";

export async function getRecords(params: {
  userId?: string;
  search?: string;
  category?: string;
  limit?: number;
  offset?: number;
}) {
  const { userId, search, category, limit = 10, offset = 0 } = params;

  let query = db.select().from(records).$dynamic();

  const conditions = [];
  if (userId) conditions.push(eq(records.userId, userId));
  if (category) conditions.push(eq(records.category, category));
  if (search) {
    conditions.push(
      or(
        ilike(records.title, `%${search}%`),
        ilike(records.description, `%${search}%`)
      )
    );
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  const results = await query.limit(limit).offset(offset);
  return results;
}

