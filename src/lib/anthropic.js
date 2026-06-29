// Server-side scorecard vision extraction. The API key never reaches the client.
const PROMPT =
  "You are reading a Hole19 (H19) golf scorecard screenshot. It may show a single player's scorecard, or a " +
  "group view with several players' scores side by side. Extract the data and return ONLY a JSON object, no " +
  "markdown fences and no commentary, with exactly these keys: date (string|null), course (string|null), and " +
  "players (a non-empty array). date and course describe the round as a whole and apply to every player. " +
  "Each entry in players must have exactly these keys: player (string|null), totalGross (number|null), " +
  'points (number|null), holes (array of integers for holes 1-18 in order, or empty array), out (number|null), ' +
  '"in" (number|null), fairwaysPct (number|null), girPct (number|null), putts (number|null), bestHole (string|null), ' +
  "leaderboardPos (string|null). If the screenshot shows more than one player's scorecard or score row, include " +
  "one players[] entry per player, in the order they appear, each with whatever stats are visible for that player " +
  "— do not merge players together or pick just one. If only a single player's scorecard is visible (e.g. a 'My " +
  "Scorecard' view), return a players array with exactly that one entry. Use null for anything not visible. " +
  "Numbers must be plain numbers without % or text.";

const SUPPORTED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

export async function extractScorecard(imageBase64, mediaType) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set on the server.");
  }
  const media_type = SUPPORTED_TYPES.includes(mediaType) ? mediaType : "image/jpeg";

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type, data: imageBase64 } },
          { type: "text", text: PROMPT },
        ],
      }],
    }),
  });

  if (!res.ok) {
    let detail = "";
    try { detail = JSON.stringify(await res.json()); } catch { detail = await res.text().catch(() => ""); }
    throw new Error(`Anthropic API ${res.status}: ${detail}`);
  }

  const data = await res.json();
  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
  try {
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch (e) {
    throw new Error("Model did not return valid JSON: " + text.slice(0, 300));
  }
}
