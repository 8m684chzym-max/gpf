// Server-side scorecard vision extraction. The API key never reaches the client.
const PROMPT =
  "You are reading a Hole19 (H19) golf scorecard screenshot. It may show a single player's scorecard, or a " +
  "group view with several players' scores side by side. Extract the data and return ONLY a JSON object, no " +
  "markdown fences and no commentary, with exactly these keys: date (string|null), course (string|null), and " +
  "players (a non-empty array). date and course describe the round as a whole and apply to every player. " +
  "Each entry in players must have exactly these keys: player (string|null), handicap (number|null — the playing/course " +
  "handicap (HCP) shown for that player on the card), totalGross (number|null), " +
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
  // A scorecard can arrive as an image (camera / photo) or a PDF (from Files).
  const isPdf = mediaType === "application/pdf";
  const mediaBlock = isPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: imageBase64 } }
    : { type: "image", source: { type: "base64", media_type: SUPPORTED_TYPES.includes(mediaType) ? mediaType : "image/jpeg", data: imageBase64 } };

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
          mediaBlock,
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

// ---- Swing Lab: AI swing report from key frames + 2D measurements ----
const SWING_PROMPT = `És um treinador de golfe PGA a analisar um swing a partir de frames de vídeo de um amador.
Escreve em português de Portugal, direto e prático.

As imagens são frames-chave do swing (o nome de cada fase vem antes da imagem). Sobreposições desenhadas pela app:
- linha amarela: linha do taco no address (cabeça do taco → mãos → ventre), estimada automaticamente;
- linha branca tracejada: linha da bola/cabeça do taco aos ombros (em down-the-line, a zona entre as duas linhas é o plano desejado na descida);
- círculo branco: posição das mãos no address;
- traço verde: cabeça do taco no backswing; traço vermelho: cabeça do taco no downswing (deteção automática por movimento, pode ter erros);
- esqueleto: pontos do corpo (MediaPipe).
Os dados JSON trazem as medições 2D e o veredito heurístico da app. Confirma ou corrige-os pelo que vês nas imagens; se a deteção do taco estiver claramente errada, diz isso.

Responde só com texto simples (sem tabelas), máximo 280 palavras, com estas secções a começar por "## ":
## Plano do swing — veredito (no plano / over the top / inside-out acentuado / não dá para avaliar) e a evidência visual.
## Porquê — se não estiver correto, as causas mais prováveis ligadas ao que vês (sequência do downswing, transferência de peso, early extension, postura, posição no topo, setup). Usa listas com "- ".
## A trabalhar — 2 ou 3 exercícios concretos.
Se a perspetiva for face-on, explica que o plano se avalia melhor por trás e foca-te na transferência de peso, sway e rotação.`;

export async function analyzeSwing(data, images) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set on the server.");
  const content = [];
  for (const im of images) {
    content.push({ type: "text", text: `Fase: ${im.label}` });
    content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: im.base64 } });
  }
  content.push({ type: "text", text: "Dados da app (JSON):\n" + JSON.stringify(data).slice(0, 20000) });
  content.push({ type: "text", text: SWING_PROMPT });
  const call = (model) => fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: 1500, messages: [{ role: "user", content }] }),
  });
  // Newest Sonnet first; fall back to the model the scorecard reader already uses.
  let res = await call(process.env.SWING_MODEL || "claude-sonnet-5-5");
  if (res.status === 404 || res.status === 400) res = await call("claude-sonnet-4-6");
  if (!res.ok) {
    let detail = "";
    try { detail = JSON.stringify(await res.json()); } catch { detail = await res.text().catch(() => ""); }
    throw new Error(`Anthropic API ${res.status}: ${detail}`);
  }
  const out = await res.json();
  return (out.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
}
