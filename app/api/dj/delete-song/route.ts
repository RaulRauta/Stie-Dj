import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request: Request) {
  const { songId } = await request.json();

  if (!songId) {
    return NextResponse.json({ error: "Missing songId" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("songs").delete().eq("id", songId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
