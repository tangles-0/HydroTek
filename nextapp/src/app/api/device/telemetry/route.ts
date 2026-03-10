import { db } from "@/db/db";
import { devices, telemetryEvents } from "@/db/schema";
import { getDeviceFromRequest } from "@/lib/deviceAuth";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const deviceId = String(body.deviceId ?? "");
  const device = await getDeviceFromRequest(request, deviceId);
  if (!device) {
    return NextResponse.json({ error: "Unknown or removed device" }, { status: 403 });
  }

  const flowMl = body.flowMl == null ? null : Math.round(Number(body.flowMl));
  const intervalSeconds = body.intervalSeconds == null ? null : Math.round(Number(body.intervalSeconds));
  const pumpOnSeconds = body.pumpOnSeconds == null ? null : Math.round(Number(body.pumpOnSeconds));

  let avgFlowMlPerMin: number | null = null;
  if (flowMl != null && intervalSeconds != null && intervalSeconds > 0) {
    avgFlowMlPerMin = Math.round((flowMl / intervalSeconds) * 60 * 100) / 100;
  }

  await db.insert(telemetryEvents).values({
    deviceId: device.id,
    accountId: device.accountId,
    tempC: body.tempC == null ? null : Math.round(Number(body.tempC)),
    humidity: body.humidity == null ? null : Math.round(Number(body.humidity)),
    flowMl,
    lampOn: body.lampOn == null ? null : Boolean(body.lampOn),
    pumpOn: body.pumpOn == null ? null : Boolean(body.pumpOn),
    float1: body.float1 == null ? null : Boolean(body.float1),
    float2: body.float2 == null ? null : Boolean(body.float2),
    alarmActive: body.alarmActive == null ? null : Boolean(body.alarmActive),
    alarmReason: body.alarmReason == null ? null : String(body.alarmReason),
    alarmTempHigh: body.alarmTempHigh == null ? null : Boolean(body.alarmTempHigh),
    alarmTempLow: body.alarmTempLow == null ? null : Boolean(body.alarmTempLow),
    alarmFloat1: body.alarmFloat1 == null ? null : Boolean(body.alarmFloat1),
    alarmFloat2: body.alarmFloat2 == null ? null : Boolean(body.alarmFloat2),
    alarmPumpLowFlow: body.alarmPumpLowFlow == null ? null : Boolean(body.alarmPumpLowFlow),
    alarmWifiDisconnected: body.alarmWifiDisconnected == null ? null : Boolean(body.alarmWifiDisconnected),
    reportReason: body.reportReason == null ? null : String(body.reportReason),
    intervalSeconds,
    pumpOnSeconds,
    avgFlowMlPerMin,
  });

  await db
    .update(devices)
    .set({ lastSeenAt: new Date(), status: "active", updatedAt: new Date() })
    .where(eq(devices.id, device.id));

  return NextResponse.json({ ok: true, configVersion: device.configVersion });
}
