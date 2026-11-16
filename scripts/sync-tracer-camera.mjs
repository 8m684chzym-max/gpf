// Copies the shared in-app camera (public/swing/camera.js) into the Shot Tracer page.
// tracer.gpf.golf serves only its single page (src/proxy.js), so the script is inlined there.
// Run after editing camera.js:  node scripts/sync-tracer-camera.mjs
import { readFileSync, writeFileSync } from "node:fs";

const START = "<!-- gpf-camera:start (generated from public/swing/camera.js) -->";
const END = "<!-- gpf-camera:end -->";
const cam = readFileSync("public/swing/camera.js", "utf8");
const page = readFileSync("public/tracer/index.html", "utf8");
const i = page.indexOf(START), j = page.indexOf(END);
if (i < 0 || j < 0) throw new Error("camera markers not found in public/tracer/index.html");
const block = `${START}\n<script>\n${cam.replace(/<\/script/gi, "<\\/script")}</script>\n${END}`;
writeFileSync("public/tracer/index.html", page.slice(0, i) + block + page.slice(j + END.length));
console.log("Shot Tracer camera updated.");
