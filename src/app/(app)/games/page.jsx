import { redirect } from "next/navigation";

// Side games moved under Play.
export default function Page() {
  redirect("/play?tab=games");
}
