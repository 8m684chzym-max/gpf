import { redirect } from "next/navigation";

// "Road to GPF" is now Rank.
export default function Page() {
  redirect("/rank");
}
