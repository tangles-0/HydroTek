import { db } from "@/db/db";
import { devicePairings, devices } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code")?.trim().toUpperCase() ?? "";
  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  const pairing = await db.query.devicePairings.findFirst({
    where: eq(devicePairings.code, code),
  });
  if (!pairing) {
    return NextResponse.json({ paired: false }, { status: 404 });
  }
  if (pairing.status !== "confirmed" || !pairing.deviceId) {
    return NextResponse.json({ paired: false, status: pairing.status });
  }

  const device = await db.query.devices.findFirst({
    where: and(eq(devices.id, pairing.deviceId), isNull(devices.removedAt)),
  });
  if (!device) {
    return NextResponse.json({ paired: false }, { status: 404 });
  }

  await db
    .update(devices)
    .set({ status: "active", updatedAt: new Date() })
    .where(eq(devices.id, device.id));

  return NextResponse.json({
    paired: true,
    deviceId: device.id,
    accountId: device.accountId,
    deviceToken: device.token,
  });
}
