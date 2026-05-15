import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request: Request) {
  const { sessionId, votingOpen } = await request.json();

  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("sessions")
    .update({ voting_open: votingOpen })
    .eq("id", sessionId);

  if (error) {
    console.error("Toggle voting error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
