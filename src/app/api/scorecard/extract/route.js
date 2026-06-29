import { NextResponse } from "next/server";
import { requireUser } from "@/lib/guard";
import { extractScorecard } from "@/lib/anthropic";

export const dynamic = 'force-dynamic';

export async function POST(req) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "Scorecard reading isn't configured." }, { status: 503 });
  try {
    const { imageBase64, mediaType } = await req.json();
    if (!imageBase64) return NextResponse.json({ error: "No image provided." }, { status: 400 });
    const parsed = await extractScorecard(imageBase64, mediaType);
    return NextResponse.json({ ok: true, data: parsed });
  } catch (e) {
    console.error("[scorecard/extract]", e.message || e);
    const dev = process.env.NODE_ENV !== "production";
    return NextResponse.json(
      { error: dev ? `Couldn't read that image — ${e.message}` : "Couldn't read that image. Try another shot or enter the round manually." },
      { status: 422 }
    );
  }
}
