import { getRecord } from "@/db/queries/records/getRecord";
import { updateRecord } from "@/db/queries/records/updateRecord";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ recordId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { recordId } = await params;
  const record = await getRecord(recordId);
  if (!record) {
    return NextResponse.json({ error: "Record not found" }, { status: 404 });
  }

  return NextResponse.json(record);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ recordId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { recordId } = await params;
  const body = await request.json();
  
  const record = await updateRecord(recordId, {
    title: body.title,
    description: body.description,
    category: body.category,
  });

  if (!record) {
    return NextResponse.json({ error: "Record not found" }, { status: 404 });
  }

  return NextResponse.json(record);
}


