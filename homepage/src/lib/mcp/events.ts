export type ClubEvent = {
  date: string;
  title: string;
  kind: "Members" | "Open";
  time: string;
  detail: string;
};

export const events: ClubEvent[] = [
  {
    date: "Apr 20",
    title: "Spring Opening Foursomes",
    kind: "Members",
    time: "9:00 AM · Tee 1",
    detail: "Season opener. Shotgun start followed by lunch on the terrace.",
  },
  {
    date: "May 04",
    title: "The Founder's Cup",
    kind: "Members",
    time: "8:30 AM · 36 holes",
    detail: "Stroke play across two rounds. Trophies at the clubhouse dinner.",
  },
  {
    date: "May 18",
    title: "Public Pro-Am",
    kind: "Open",
    time: "10:00 AM · Tee 1",
    detail: "Open to guests. Team of three joins a club pro for 18 holes.",
  },
  {
    date: "Jun 08",
    title: "Twilight Nine & Wine",
    kind: "Members",
    time: "5:30 PM · Tee 10",
    detail: "Casual nine holes, then wine and small plates at sundown.",
  },
];
