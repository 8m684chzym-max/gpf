import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guard";

export const dynamic = "force-dynamic";

// Serves an uploaded product photo (stored as a data: URL) as a real image.
export async function GET(req, { params }) {
  const user = await requireUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const p = await prisma.shopProduct.findUnique({ where: { id }, select: { image: true } });
  const m = p?.image?.match(/^data:(image\/[a-z+.-]+);base64,(.+)$/i);
  if (!m) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(m[2], "base64"), {
    headers: { "content-type": m[1], "cache-control": "private, max-age=31536000, immutable" },
  });
}
