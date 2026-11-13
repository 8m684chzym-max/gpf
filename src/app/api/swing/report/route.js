import { NextResponse } from "next/server";
import { requireUser } from "@/lib/guard";
import { analyzeSwing } from "@/lib/anthropic";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Swing Lab (public/swing): AI report from up to 6 key frames (JPEG) + the app's 2D measurements.
export async function POST(req) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Sessão expirada. Volte a entrar." }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "O relatório AI não está configurado." }, { status: 503 });
  try {
    const { data, images } = await req.json();
    if (!Array.isArray(images) || !images.length) return NextResponse.json({ error: "Sem imagens." }, { status: 400 });
    const imgs = images.slice(0, 6).filter((i) => typeof i?.base64 === "string" && i.base64.length < 1_500_000)
      .map((i) => ({ label: String(i.label || "").slice(0, 40), base64: i.base64 }));
    if (!imgs.length) return NextResponse.json({ error: "Imagens inválidas ou demasiado grandes." }, { status: 413 });
    const text = await analyzeSwing(data || {}, imgs);
    return NextResponse.json({ ok: true, text });
  } catch (e) {
    console.error("[swing/report]", e.message || e);
    return NextResponse.json({ error: "Não foi possível gerar o relatório AI. Tente novamente." }, { status: 502 });
  }
}
