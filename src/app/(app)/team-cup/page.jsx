"use client";
import TeamCup from "@/components/teamcup/TeamCup";

// Team Cup — Warriors vs Patuas: season-long 1v1 match play between the two teams.
// (The Open-day live team match, components/open/TeamMatch.jsx + /api/open-match, is retired.)
export default function TeamCupPage() {
  return (
    <div className="stack">
      <div className="page-top">
        <div className="eyebrow">Team Cup</div>
        <h1 className="page-h">Warriors vs Patuas.</h1>
      </div>
      <TeamCup />
    </div>
  );
}
