#!/usr/bin/env node
// Generates the JWT that "Sign in with Apple" requires as APPLE_CLIENT_SECRET.
// Apple doesn't give you a plain secret string like Google — you sign a short-lived
// token yourself using a private key Apple gives you once. See README.md for the
// full walkthrough of where teamId / keyId / the Services ID / the .p8 file come from.
//
// Usage:
//   npm run apple-secret -- --team TEAMID --key KEYID --client SERVICES_ID --keyfile ./AuthKey_XXXX.p8
import fs from "fs";
import jwt from "jsonwebtoken";

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

const teamId = arg("team");
const keyId = arg("key");
const clientId = arg("client");
const keyfile = arg("keyfile");

if (!teamId || !keyId || !clientId || !keyfile) {
  console.error(`
Usage:
  npm run apple-secret -- --team TEAMID --key KEYID --client SERVICES_ID --keyfile ./AuthKey_XXXX.p8

  --team     Your Apple Developer Team ID (top-right of developer.apple.com, or the Membership page)
  --key      The Key ID of your "Sign in with Apple" key (Certificates, Identifiers & Profiles -> Keys)
  --client   Your Services ID — the identifier you created for "Sign in with Apple",
             e.g. golf.fresquinha.signin (this is also your APPLE_CLIENT_ID)
  --keyfile  Path to the .p8 private key file you downloaded when creating the key
             (Apple only lets you download this once, so keep it safe)
`);
  process.exit(1);
}

const privateKey = fs.readFileSync(keyfile, "utf8");

const token = jwt.sign({}, privateKey, {
  algorithm: "ES256",
  expiresIn: 15777000, // ~6 months — Apple's maximum allowed lifetime for this token
  issuer: teamId,
  audience: "https://appleid.apple.com",
  subject: clientId,
  keyid: keyId,
});

console.log("\nAPPLE_CLIENT_SECRET (paste this into your .env — valid for about 6 months):\n");
console.log(token);
console.log("\nSet APPLE_CLIENT_ID to your Services ID (the --client value above).");
console.log("Re-run this script to generate a fresh secret before this one expires.\n");
