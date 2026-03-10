import { createRecord } from "@/db/queries/records/createRecord";
import { getRecords } from "@/db/queries/records/getRecords";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const search = searchParams.get("search") || undefined;
  const category = searchParams.get("category") || undefined;
  const limit = parseInt(searchParams.get("limit") || "10");
  const offset = parseInt(searchParams.get("offset") || "0");

  const records = await getRecords({
    search,
    category,
    limit,
    offset,
  });

  return NextResponse.json({ records, limit, offset });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const record = await createRecord({
    title: body.title,
    description: body.description,
    category: body.category,
    userId: session.user.id,
  });

  return NextResponse.json(record, { status: 201 });
}

