import { redirect } from "next/navigation";

// Old home screen: the app now opens on My profile.
export default function Page() {
  redirect("/profile");
}
