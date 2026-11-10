"use client";
import TeamMatch from "@/components/open/TeamMatch";

// Team Cup — the team match play event (Warriors vs Patuas), an event of its own
// alongside the Open. Was "Team league 2027" under Open.
export default function TeamCup() {
  return (
    <div className="stack">
      <div className="page-top">
        <div className="eyebrow">Team Cup</div>
        <h1 className="page-h">Two teams. One cup.</h1>
      </div>
      <TeamMatch />
    </div>
  );
}
