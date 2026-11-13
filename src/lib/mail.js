// Transactional email via SMTP. Works with any provider (Resend SMTP, Gmail App
// Password, Brevo, SendGrid, Mailgun…) — set SMTP_HOST / SMTP_PORT / SMTP_USER /
// SMTP_PASS and SMTP_FROM (e.g. "GPF <noreply@gpf.golf>") in Vercel.
// Every helper here is best-effort: if SMTP isn't configured or sending fails,
// it logs (without the address) and returns false, never breaking the request.
import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";

export function isMailConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

let transporter = null;
function getTransporter() {
  if (!isMailConfigured()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

export const appUrl = () => (process.env.NEXTAUTH_URL || "https://app.gpf.golf").replace(/\/$/, "");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Simple branded HTML wrapper. `lines` are paragraphs (already escaped/HTML).
function layout(title, lines, cta) {
  const button = cta ? `<p style="margin:24px 0"><a href="${cta.href}" style="background:#176b4f;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;display:inline-block">${esc(cta.label)}</a></p>` : "";
  return `<!doctype html><html><body style="margin:0;background:#f4f2ec;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#15211c">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
<div style="background:#0c3a2c;color:#f0a818;border-radius:14px 14px 0 0;padding:16px 22px;font-weight:700;letter-spacing:1px">GOLF P'LA FRESQUINHA</div>
<div style="background:#fff;border:1px solid #e6e2d8;border-top:none;border-radius:0 0 14px 14px;padding:22px">
<h1 style="font-size:20px;margin:0 0 12px">${esc(title)}</h1>
${lines.map((l) => `<p style="margin:0 0 12px;line-height:1.5">${l}</p>`).join("")}
${button}
</div><p style="color:#6c7a72;font-size:12px;text-align:center;margin-top:14px">gpf.golf</p></div></body></html>`;
}

export async function sendMail({ to, subject, text, html }) {
  const t = getTransporter();
  const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean);
  if (!recipients.length) return false;
  if (!t) { console.log(`[mail] SMTP not configured; skipped "${subject}"`); return false; }
  try {
    await t.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to: recipients.join(", "), subject, text, html });
    return true;
  } catch (e) {
    console.error(`[mail] sending "${subject}" failed:`, e.message);
    return false;
  }
}

async function adminEmails() {
  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { email: true } });
  return admins.map((a) => a.email);
}

// Kept for the forgot-password route (throws if SMTP isn't configured, as before).
export async function sendPasswordResetEmail(to, link) {
  if (!isMailConfigured()) throw new Error("SMTP is not configured (set SMTP_HOST / SMTP_USER / SMTP_PASS).");
  const ok = await sendMail({
    to,
    subject: "Reset your Golf P'la Fresquinha password",
    text: `Reset your password using this link (expires in 1 hour):\n\n${link}\n\nIf you didn't request this, you can ignore this email.`,
    html: layout("Reset your password", ["Use the button below to choose a new password. The link expires in 1 hour.", `<span style="color:#6c7a72;font-size:13px">If you didn't request this, you can ignore this email.</span>`], { href: link, label: "Choose a new password" }),
  });
  if (!ok) throw new Error("Email send failed");
}

export async function notifyNewRegistration(user) {
  const href = `${appUrl()}/admin`;
  return sendMail({
    to: await adminEmails(),
    subject: `New member waiting for approval: ${user.name}`,
    text: `${user.name} (${user.email}) registered on GPF and is waiting for approval.\n\nApprove or reject in Admin › Members: ${href}`,
    html: layout("New member waiting for approval", [`<b>${esc(user.name)}</b> (${esc(user.email)}) registered and is waiting for your approval.`, "Approve or reject the request in Admin › Members."], { href, label: "Open Admin" }),
  });
}

export async function notifyApproved(user) {
  const href = `${appUrl()}/login`;
  return sendMail({
    to: user.email,
    subject: "Your GPF account is approved",
    text: `Hi ${user.name},\n\nYour Golf P'la Fresquinha account has been approved. You can log in here: ${href}`,
    html: layout("You're in!", [`Hi ${esc(user.name)}, your Golf P'la Fresquinha account has been approved by the committee.`], { href, label: "Log in" }),
  });
}

const eur = (c) => `€${(c / 100).toFixed(2).replace(".", ",")}`;
const itemsText = (o) => o.items.map((i) => `${i.qty}× ${i.name}${i.size ? ` (${i.size})` : ""} — ${eur(i.unitCents * i.qty)}`);

export async function notifyOrderPlaced(order, pay) {
  const href = `${appUrl()}/shop/orders/${order.id}`;
  const method = order.method === "MBWAY" ? "MB WAY" : "Revolut";
  const howTo = order.method === "MBWAY"
    ? (pay.mbwayPhone ? `Send ${eur(order.totalCents)} by MB WAY to ${pay.mbwayPhone}${pay.mbwayName ? ` (${pay.mbwayName})` : ""} and write ${order.ref} in the description.` : "The committee will send you the MB WAY details.")
    : (pay.revolutTag ? `Pay ${eur(order.totalCents)} on Revolut to ${pay.revolutLink || pay.revolutTag} with the reference ${order.ref}.` : "The committee will send you the Revolut details.");
  const items = itemsText(order);
  await sendMail({
    to: order.buyerEmail,
    subject: `GPF order ${order.ref} — ${eur(order.totalCents)}`,
    text: `Thanks for your order ${order.ref}.\n\n${items.join("\n")}\nTotal: ${eur(order.totalCents)}\n\nHow to pay (${method}): ${howTo}\n\nWhen you've paid, tap "I've paid" on the order page: ${href}`,
    html: layout(`Order ${order.ref}`, [items.map(esc).join("<br>"), `<b>Total: ${eur(order.totalCents)}</b>`, `<b>How to pay (${method}):</b> ${esc(howTo)}`, "When you've paid, open the order and tap “I've paid”."], { href, label: "Open order" }),
  });
  return sendMail({
    to: await adminEmails(),
    subject: `New shop order ${order.ref} from ${order.buyerName} — ${eur(order.totalCents)}`,
    text: `${order.buyerName} ordered:\n${items.join("\n")}\nTotal: ${eur(order.totalCents)} by ${method}${order.note ? `\nNote: ${order.note}` : ""}\n\nAdmin › Shop: ${appUrl()}/admin`,
    html: layout(`New order ${order.ref}`, [`<b>${esc(order.buyerName)}</b> ordered:`, items.map(esc).join("<br>"), `<b>Total: ${eur(order.totalCents)}</b> by ${method}`, order.note ? `Note: ${esc(order.note)}` : ""].filter(Boolean), { href: `${appUrl()}/admin`, label: "Open Admin › Shop" }),
  });
}

export async function notifyOrderStatus(order) {
  const href = `${appUrl()}/shop/orders/${order.id}`;
  const msg = {
    PAID: ["Payment received", `We've received your payment for order ${order.ref}. We'll let you know when it's ready.`],
    DELIVERED: ["Order delivered", `Order ${order.ref} has been delivered. Enjoy your GPF gear!`],
    CANCELLED: ["Order cancelled", `Order ${order.ref} has been cancelled. If you already paid, the committee will refund you.`],
  }[order.status];
  if (!msg) return false;
  return sendMail({
    to: order.buyerEmail,
    subject: `GPF order ${order.ref}: ${msg[0].toLowerCase()}`,
    text: `${msg[1]}\n\n${href}`,
    html: layout(msg[0], [esc(msg[1])], { href, label: "Open order" }),
  });
}

export async function notifyPaymentSent(order) {
  return sendMail({
    to: await adminEmails(),
    subject: `${order.buyerName} says order ${order.ref} is paid (${eur(order.totalCents)})`,
    text: `${order.buyerName} marked order ${order.ref} (${eur(order.totalCents)}, ${order.method === "MBWAY" ? "MB WAY" : "Revolut"}) as paid. Check your account and confirm in Admin › Shop: ${appUrl()}/admin`,
    html: layout(`Payment sent for ${order.ref}`, [`<b>${esc(order.buyerName)}</b> says they paid <b>${eur(order.totalCents)}</b> by ${order.method === "MBWAY" ? "MB WAY" : "Revolut"}.`, "Check your account, then confirm it in Admin › Shop."], { href: `${appUrl()}/admin`, label: "Open Admin › Shop" }),
  });
}

// Alert for the weekly FPG handicap sync. Goes to the admins and, if set, to
// ALERT_EMAIL (comma-separated list allowed). Returns true if an email was sent.
export async function notifyFpgSyncProblem(summary, what = "FPG handicap sync") {
  const extra = (process.env.ALERT_EMAIL || "").split(",").map((s) => s.trim()).filter(Boolean);
  const to = [...new Set([...(await adminEmails()), ...extra])];
  const href = `${appUrl()}/admin`;
  const ok = summary.results.filter((r) => r.ok).length;
  const head = summary.fatal
    ? `The ${what} failed — nothing was updated.`
    : `The ${what} finished with problems: ${ok} of ${summary.results.length} members done.`;
  const lines = summary.problems.map((p) => `${p.warning ? "⚠︎" : "✗"} ${p.member}${p.fedno !== "—" ? ` (${p.fedno})` : ""}: ${p.error}`);
  const when = new Date(summary.startedAt).toISOString().replace("T", " ").slice(0, 16) + " UTC";
  return sendMail({
    to,
    subject: summary.fatal ? `⚠️ GPF: ${what} failed` : `⚠️ GPF: ${what} had problems`,
    text: `${head}\n\n${lines.join("\n")}\n\nRun: ${when} (${summary.trigger})\nThe last good values are kept. Retry from Admin › Members › Sync FPG now: ${href}`,
    html: layout(summary.fatal ? `${what} failed` : `${what} had problems`, [esc(head), lines.map(esc).join("<br>"), `<span style="color:#6c7a72;font-size:13px">Run: ${esc(when)} (${esc(summary.trigger)}). The last good values are kept.</span>`], { href, label: "Open Admin › Members" }),
  });
}
