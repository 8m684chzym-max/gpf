import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
export async function requireUser() {
  const s = await getServerSession(authOptions);
  return s?.user || null;
}
export async function requireAdmin() {
  const u = await requireUser();
  return u && u.role === "ADMIN" ? u : null;
}
