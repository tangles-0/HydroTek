import { db } from "@/db/db";
import { devices } from "@/db/schema";
import { authOptions } from "@/lib/auth";
import { and, desc, eq, isNull } from "drizzle-orm";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rows = await db.query.devices.findMany({
    where: and(eq(devices.accountId, session.user.id), isNull(devices.removedAt)),
    orderBy: [desc(devices.createdAt)],
  });
  return NextResponse.json({ devices: rows });
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json();
  const deviceId = String(body.deviceId ?? "");
  await db
    .update(devices)
    .set({ removedAt: new Date(), status: "removed", updatedAt: new Date() })
    .where(and(eq(devices.id, deviceId), eq(devices.accountId, session.user.id)));
  return NextResponse.json({ ok: true });
}
