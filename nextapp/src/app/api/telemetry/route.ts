import { db } from "@/db/db";
import { telemetryEvents } from "@/db/schema";
import { authOptions } from "@/lib/auth";
import { and, desc, eq, gte } from "drizzle-orm";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const deviceId = request.nextUrl.searchParams.get("deviceId");
  const range = request.nextUrl.searchParams.get("range") ?? "24h";
  if (!deviceId) {
    return NextResponse.json({ error: "deviceId is required" }, { status: 400 });
  }

  const now = Date.now();
  const rangeMsByKey: Record<string, number> = {
    "1h": 60 * 60 * 1000,
    "12h": 12 * 60 * 60 * 1000,
    "24h": 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
  };
  const ms = rangeMsByKey[range] ?? rangeMsByKey["24h"];
  const since = new Date(now - ms);
  const maxRowsByRange: Record<string, number> = {
    "1h": 600,
    "12h": 3000,
    "24h": 5000,
    "30d": 12000,
  };
  const limit = maxRowsByRange[range] ?? 5000;

  const where = deviceId
    ? and(
        eq(telemetryEvents.accountId, session.user.id),
        eq(telemetryEvents.deviceId, deviceId),
        gte(telemetryEvents.createdAt, since)
      )
    : eq(telemetryEvents.accountId, session.user.id);
  const rows = await db.query.telemetryEvents.findMany({
    columns: {
      id: true,
      deviceId: true,
      tempC: true,
      humidity: true,
      flowMl: true,
      lampOn: true,
      pumpOn: true,
      float1: true,
      float2: true,
      alarmActive: true,
      alarmReason: true,
      alarmTempHigh: true,
      alarmTempLow: true,
      alarmFloat1: true,
      alarmFloat2: true,
      alarmPumpLowFlow: true,
      alarmWifiDisconnected: true,
      reportReason: true,
      intervalSeconds: true,
      pumpOnSeconds: true,
      avgFlowMlPerMin: true,
      createdAt: true,
    },
    where,
    orderBy: [desc(telemetryEvents.createdAt)],
    limit,
  });
  return NextResponse.json({ telemetry: rows });
}
