"use client";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import RoadBoard from "@/components/rank/RoadBoard";
import { api } from "@/lib/client";
import { RANK_SINCE_LABEL } from "@/lib/major";

export default function Rank() {
  const [d, setD] = useState(null);
  useEffect(() => {
    Promise.all([api("/api/leaderboard"), api("/api/config")])
      .then(([lb, cfg]) => setD({ road: lb.road, config: cfg.config })).catch(() => {});
  }, []);
  if (!d) return <div className="loading"><Loader2 className="spin" size={22} /> Loading…</div>;
  const need = d.config.qualifyingRoundsRequired;
  return (
    <div className="stack">
      <div className="page-top">
        <div className="eyebrow">Rank</div>
        <h1 className="page-h">The road never stops.</h1>
        <p className="lede">A continuous ranking: total Stableford points from each player&rsquo;s 3 best rounds since {RANK_SINCE_LABEL}, then by handicap. Keep submitting cards and the board keeps moving. {need} approved rounds to qualify; the top three carry 3/2/1 bonus strokes into the next Open. Tap a player to see their rounds.</p>
      </div>
      <RoadBoard road={d.road} need={need} />
      <p className="hint">Every round is scored off the player&rsquo;s declared handicap &mdash; reset to the playing handicap each player had at the last Open (WHS Stableford for that gross on that tee). 36 a round means playing to handicap, so the best 3 are compared with 108 to set the GPF handicap for the next Open. Points missing from a card are estimated with the WHS method.</p>
    </div>
  );
}
