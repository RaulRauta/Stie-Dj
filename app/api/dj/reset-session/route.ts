import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST() {
  await supabaseAdmin
    .from("sessions")
    .update({ active: false })
    .eq("active", true);

  const { data, error } = await supabaseAdmin
    .from("sessions")
    .insert({
      name: `Sesiune ${new Date().toLocaleString("ro-RO")}`,
      active: true,
      voting_open: false,
    })
    .select("id, name, voting_open")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ session: data });
}
