import { db } from "@/db/db";
import { devices } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { NextRequest } from "next/server";

export async function getDeviceFromRequest(request: NextRequest, deviceId?: string) {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) {
    return null;
  }
  const where = deviceId
    ? and(eq(devices.token, token), eq(devices.id, deviceId), isNull(devices.removedAt))
    : and(eq(devices.token, token), isNull(devices.removedAt));
  return db.query.devices.findFirst({ where });
}
