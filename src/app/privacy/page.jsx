// Privacy Policy — required by GDPR Art. 13 (information at point of collection).
// Linked from the registration form and the cookie notice.
// Update CONTACT_EMAIL before deploying to production.
const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "committee@gpf.golf";
const SITE_NAME = "Golf P'la Fresquinha (GPF)";
const LAST_UPDATED = "2025";

export const metadata = {
  title: "Privacy Policy — Golf P'la Fresquinha",
};

export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "32px 18px 64px", fontFamily: "var(--body,system-ui,sans-serif)", color: "var(--ink,#15211c)", lineHeight: 1.65 }}>
      <h1 style={{ fontFamily: "var(--disp,sans-serif)", fontSize: 28, marginBottom: 4 }}>Privacy Policy</h1>
      <p style={{ color: "var(--muted,#666)", fontSize: 13, marginBottom: 28 }}>{SITE_NAME} · Last updated {LAST_UPDATED}</p>

      <Section title="1. Who we are">
        <p>{SITE_NAME} is a private web application used by a closed group of golf friends to run an annual competition. It is not a commercial service. The data controller is the committee of {SITE_NAME}. Contact: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
      </Section>

      <Section title="2. What data we collect and why">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: "var(--flag-soft,#fdf3d8)", textAlign: "left" }}>
              <Th>Data</Th><Th>Purpose</Th><Th>Legal basis (GDPR Art. 6)</Th>
            </tr>
          </thead>
          <tbody>
            <Tr><Td>Name, email address, password (hashed)</Td><Td>Account creation and authentication</Td><Td>Contract (6.1.b)</Td></Tr>
            <Tr><Td>Handicap index (declared and calculated)</Td><Td>Competition scoring and leaderboard</Td><Td>Contract (6.1.b)</Td></Tr>
            <Tr><Td>Round data (course, gross score, date, Stableford points, hole-by-hole scores)</Td><Td>Leaderboard ranking and handicap calculation</Td><Td>Contract (6.1.b)</Td></Tr>
            <Tr><Td>Scorecard images (uploaded voluntarily)</Td><Td>Automatic score extraction via AI vision; images are processed transiently and never permanently stored on our servers</Td><Td>Consent (6.1.a)</Td></Tr>
            <Tr><Td>Audit log entries (name, action, timestamp)</Td><Td>Integrity checks and dispute resolution; retained for 12 months then automatically deleted</Td><Td>Legitimate interest (6.1.f)</Td></Tr>
            <Tr><Td>Password reset tokens (hashed, time-limited)</Td><Td>Secure password recovery; expire after 1 hour</Td><Td>Contract (6.1.b)</Td></Tr>
            <Tr><Td>Session cookie (<code>__Secure-next-auth.session-token</code>)</Td><Td>Keeping you logged in during your visit; functional cookie, no tracking</Td><Td>Legitimate interest (6.1.f)</Td></Tr>
          </tbody>
        </table>
      </Section>

      <Section title="3. Scorecard images and the AI processor">
        <p>When you upload a scorecard image, it is sent over HTTPS to Anthropic (anthropic.com) for text extraction. Anthropic processes the image under a zero-data-retention policy for API calls — it is not used to train models and is not stored after processing. The extracted data is shown to you for confirmation before anything is saved to our database. The original image file is never stored on our servers.</p>
        <p>Anthropic is a sub-processor under our data processing arrangement. By uploading a scorecard you consent to this transient processing.</p>
      </Section>

      <Section title="4. Cookies">
        <p>We use <strong>one functional cookie only</strong>:</p>
        <ul>
          <li><code>__Secure-next-auth.session-token</code> — a secure, HTTP-only, same-site session cookie set by NextAuth when you log in. It expires when you close your browser or after a configured period. It contains no personal data (only an encrypted session reference) and is not used for tracking or advertising.</li>
        </ul>
        <p>We do <strong>not</strong> use analytics cookies, advertising cookies, or any third-party tracking scripts.</p>
        <p>Fonts are self-hosted: no request is made to Google Fonts or any external font CDN from your browser.</p>
      </Section>

      <Section title="5. Who we share your data with">
        <p>We do not sell or share your personal data with third parties for commercial purposes. Your data may be shared only with:</p>
        <ul>
          <li><strong>Vercel (vercel.com)</strong> — our hosting provider. Your data is stored on Vercel infrastructure (PostgreSQL database and serverless functions). Vercel is certified under the EU–US Data Privacy Framework.</li>
          <li><strong>Anthropic (anthropic.com)</strong> — for transient scorecard image processing only (see section 3).</li>
          <li><strong>Your SMTP email provider</strong> (if configured) — to send password-reset emails.</li>
          <li><strong>Competition committee members</strong> — who have admin access to the platform for score validation.</li>
        </ul>
      </Section>

      <Section title="6. How long we keep your data">
        <ul>
          <li>Account data and rounds: for the duration of your membership, plus up to 1 year after the competition year closes.</li>
          <li>Audit logs: 12 months from creation, then automatically deleted.</li>
          <li>Password reset tokens: expire after 1 hour; cleaned up periodically.</li>
          <li>Scorecard images: never stored (processed transiently only).</li>
        </ul>
      </Section>

      <Section title="7. Your rights (GDPR Chapter 3)">
        <p>As a data subject you have the right to:</p>
        <ul>
          <li><strong>Access</strong> — request a copy of your data (Art. 15). Use the "Download my data" button on your profile page.</li>
          <li><strong>Portability</strong> — download your data in machine-readable JSON format (Art. 20). Available from your profile page.</li>
          <li><strong>Rectification</strong> — correct inaccurate data (Art. 16). Edit your profile, or contact the committee.</li>
          <li><strong>Erasure</strong> — request deletion of your account and all associated data (Art. 17). Contact the committee at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</li>
          <li><strong>Restriction</strong> — ask us to restrict processing of your data (Art. 18).</li>
          <li><strong>Object</strong> — object to processing based on legitimate interest (Art. 21).</li>
          <li><strong>Withdraw consent</strong> — for scorecard image uploads, you may stop uploading at any time without affecting your other rights.</li>
        </ul>
        <p>To exercise any right, email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. We will respond within 30 days.</p>
        <p>If you believe we have not handled your data lawfully, you have the right to lodge a complaint with the Portuguese data protection authority: <strong>CNPD</strong> (Comissão Nacional de Proteção de Dados) — <a href="https://www.cnpd.pt" target="_blank" rel="noopener noreferrer">cnpd.pt</a>.</p>
      </Section>

      <Section title="8. Security">
        <p>Passwords are hashed with bcrypt (cost factor 10). All connections are encrypted with TLS/HTTPS (HSTS enforced). Session cookies are HTTP-only, Secure, and SameSite=Lax. Security headers (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy) are applied to all responses. The database connection uses SSL.</p>
      </Section>

      <Section title="9. Changes to this policy">
        <p>We may update this policy when we change how we process data. The date at the top of this page will reflect the latest revision. For significant changes, we will notify members by email if SMTP is configured.</p>
      </Section>

      <div style={{ marginTop: 40, padding: "18px 20px", background: "var(--ok-soft,#e3f1ea)", borderRadius: 12, fontSize: 13 }}>
        <strong>Questions?</strong> Contact the committee at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section style={{ marginBottom: 32 }}>
      <h2 style={{ fontFamily: "var(--disp,sans-serif)", fontSize: 18, fontWeight: 600, marginBottom: 10, borderBottom: "1px solid var(--line,#e6e2d8)", paddingBottom: 6 }}>{title}</h2>
      {children}
    </section>
  );
}
function Th({ children }) { return <th style={{ padding: "8px 10px", fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.5px" }}>{children}</th>; }
function Td({ children }) { return <td style={{ padding: "8px 10px", borderTop: "1px solid var(--line,#e6e2d8)", verticalAlign: "top", fontSize: 13 }}>{children}</td>; }
function Tr({ children }) { return <tr>{children}</tr>; }
