import { redirect } from "next/navigation";

// The hole map moved under Play (bookmarks and old links keep working, ?hole=N included).
export default async function Page({ searchParams }) {
  const sp = await searchParams;
  const hole = Number(sp?.hole);
  redirect(hole >= 1 && hole <= 18 ? `/play/map?hole=${hole}` : "/play/map");
}
