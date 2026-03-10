import { db } from "@/db/db";
import { devicePairings, devices } from "@/db/schema";
import { authOptions } from "@/lib/auth";
import { and, eq, gt } from "drizzle-orm";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const code = String(body.code ?? "").trim().toUpperCase();
  if (!code) {
    return NextResponse.json({ error: "Code is required" }, { status: 400 });
  }

  const pairing = await db.query.devicePairings.findFirst({
    where: and(eq(devicePairings.code, code), eq(devicePairings.status, "pending"), gt(devicePairings.expiresAt, new Date())),
  });
  if (!pairing) {
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 404 });
  }

  const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const [device] = await db
    .insert(devices)
    .values({
      accountId: session.user.id,
      token,
      status: "pending_connection",
      name: "HydroTek Device",
      desiredConfig: {},
      configVersion: 1,
      localConfigVersion: 0,
    })
    .returning({ id: devices.id, accountId: devices.accountId });

  await db
    .update(devicePairings)
    .set({
      accountId: session.user.id,
      deviceId: device.id,
      status: "confirmed",
      confirmedAt: new Date(),
    })
    .where(eq(devicePairings.code, code));

  return NextResponse.json({ status: "pending_connection", deviceId: device.id });
}
