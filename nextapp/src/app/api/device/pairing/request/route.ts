import { db } from "@/db/db";
import { devicePairings } from "@/db/schema";
import { NextRequest, NextResponse } from "next/server";

function randomCode(length: number) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export async function POST(_request: NextRequest) {
  const pairingCode = randomCode(6);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  await db.insert(devicePairings).values({
    code: pairingCode,
    status: "pending",
    expiresAt,
  });
  return NextResponse.json({ pairingCode, expiresAt });
}
