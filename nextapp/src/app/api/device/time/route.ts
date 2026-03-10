import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ epoch: Math.floor(Date.now() / 1000) });
}
