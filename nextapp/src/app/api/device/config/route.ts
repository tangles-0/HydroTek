import { db } from "@/db/db";
import { devices } from "@/db/schema";
import { authOptions } from "@/lib/auth";
import { getDeviceFromRequest } from "@/lib/deviceAuth";
import { and, eq, isNull } from "drizzle-orm";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

function stripDeviceOnlySettings(settings: Record<string, unknown>) {
  const { enablewifi: _enableWifi, ...rest } = settings;
  return rest;
}

export async function GET(request: NextRequest) {
  const deviceId = request.nextUrl.searchParams.get("deviceId") ?? "";
  const device = await getDeviceFromRequest(request, deviceId);
  if (!device) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    configVersion: device.configVersion,
    localConfigVersion: device.localConfigVersion,
    configSyncState: device.configSyncState,
    settings: stripDeviceOnlySettings((device.desiredConfig ?? {}) as Record<string, unknown>),
  });
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json();
  const deviceId = String(body.deviceId ?? "");
  const rawSettings =
    body.settings && typeof body.settings === "object" ? (body.settings as Record<string, unknown>) : {};
  const settings = stripDeviceOnlySettings(rawSettings);
  const device = await db.query.devices.findFirst({
    where: and(eq(devices.id, deviceId), eq(devices.accountId, session.user.id), isNull(devices.removedAt)),
  });
  if (!device) {
    return NextResponse.json({ error: "Device not found" }, { status: 404 });
  }

  const nextVersion = device.configVersion + 1;
  await db
    .update(devices)
    .set({
      desiredConfig: settings,
      configVersion: nextVersion,
      configSyncState: "pending",
      updatedAt: new Date(),
    })
    .where(eq(devices.id, deviceId));
  return NextResponse.json({ configVersion: nextVersion, configSyncState: "pending" });
}
