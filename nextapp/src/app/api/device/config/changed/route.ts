import { db } from "@/db/db";
import { devices } from "@/db/schema";
import { getDeviceFromRequest } from "@/lib/deviceAuth";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const deviceId = String(body.deviceId ?? "");
  const localConfigVersion = Number(body.localConfigVersion ?? 0);
  const configSyncState = String(body.configSyncState ?? "device");
  const settings = body.settings ?? undefined;
  const device = await getDeviceFromRequest(request, deviceId);
  if (!device) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const updatePayload: Partial<typeof devices.$inferInsert> = {
    localConfigVersion: Number.isFinite(localConfigVersion)
      ? localConfigVersion
      : device.localConfigVersion,
    configSyncState:
      configSyncState === "pending" || configSyncState === "success" || configSyncState === "device"
        ? configSyncState
        : "device",
    lastConfigReportedAt: new Date(),
    updatedAt: new Date(),
  };

  if (settings && typeof settings === "object" && updatePayload.configSyncState === "device") {
    updatePayload.desiredConfig = settings as Record<string, unknown>;
    updatePayload.configVersion = Math.max(device.configVersion, updatePayload.localConfigVersion ?? 0);
  }

  await db
    .update(devices)
    .set(updatePayload)
    .where(eq(devices.id, device.id));

  return NextResponse.json({ ok: true });
}
