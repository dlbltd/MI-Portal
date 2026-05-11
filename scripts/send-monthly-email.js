#!/usr/bin/env node
// Send the monthly MI release notification to every client in
// scripts/client-recipients.json that has at least one address.
//
// Required env vars:
//   SMTP_USER       full email of the sending mailbox (e.g. midata@dlbinvestigations.co.uk)
//   SMTP_PASS       App Password for that mailbox (M365 SMTP AUTH)
//   SMTP_FROM_NAME  display name shown in the From line (e.g. "DLB Investigations")
// Optional env vars:
//   PORTAL_URL      override the default https://dlbltd.github.io/MI-Portal/
//   PERIOD_LABEL    override the auto "Jan–Dec 2026" period label
//   DRY_RUN=1       log what would be sent but do not actually send
//   ONLY_TO=email   restrict sending to a single email address (useful for testing)

const fs   = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_PORTAL_URL = 'https://dlbltd.github.io/MI-Portal/';

const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;
const fromName = process.env.SMTP_FROM_NAME || 'DLB Investigations';
const portalUrl = process.env.PORTAL_URL || DEFAULT_PORTAL_URL;
const dryRun = process.env.DRY_RUN === '1';
const onlyTo = process.env.ONLY_TO;

if (!user || !pass) { console.error('Missing SMTP_USER or SMTP_PASS env vars'); process.exit(1); }

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const now = new Date();
const periodLabel = process.env.PERIOD_LABEL || `Jan–Dec ${now.getUTCFullYear()}`;
const monthLabel  = `${MONTHS[now.getUTCMonth()]} ${now.getUTCFullYear()}`;

const recipients = JSON.parse(fs.readFileSync(path.join(__dirname, 'client-recipients.json'), 'utf8')).recipients;
const clientMap  = JSON.parse(fs.readFileSync(path.join(__dirname, 'client-map.json'), 'utf8')).clients;
const codeToName = {};
for (const m of Object.values(clientMap)) if (!codeToName[m.code]) codeToName[m.code] = m.name;

// ── Email template ───────────────────────────────────────────
function buildEmail(recipientName, clientName) {
  const firstName = (recipientName || '').split(' ')[0] || 'there';
  const subject = `${clientName} — ${monthLabel} MI release`;
  const text = `Hi ${firstName},

Your latest Management Information report for ${clientName} is now live on the DLB MI Portal.

Visit ${portalUrl} and sign in with the access code provided by your DLB account manager to view the latest period (${periodLabel}). The dashboard covers:

  • RTC and general SLA compliance
  • Revenue and case volume
  • Fee breakdown by work type
  • Month-by-month performance trend
  • Full case detail log

If anything looks off or you need a new access code, just reply to this email.

Best regards,
${fromName}
`;
  const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1e2128;line-height:1.55;max-width:560px;margin:24px auto;padding:0 16px">
<p>Hi ${firstName},</p>
<p>Your latest <strong>Management Information report</strong> for <strong>${clientName}</strong> is now live on the DLB MI Portal.</p>
<p style="margin:28px 0;text-align:center">
  <a href="${portalUrl}" style="display:inline-block;background:#4a7fc1;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:600;letter-spacing:0.5px">Open the MI Portal →</a>
</p>
<p>Sign in with the access code provided by your DLB account manager to view the latest period (<strong>${periodLabel}</strong>). The dashboard covers:</p>
<ul style="color:#3a404d">
  <li>RTC and general SLA compliance</li>
  <li>Revenue and case volume</li>
  <li>Fee breakdown by work type</li>
  <li>Month-by-month performance trend</li>
  <li>Full case detail log</li>
</ul>
<p>If anything looks off or you need a new access code, just reply to this email.</p>
<p style="margin-top:24px;color:#3a404d">Best regards,<br>${fromName}</p>
<hr style="border:none;border-top:1px solid #e1e4e8;margin:24px 0">
<p style="font-size:11px;color:#8a95a3">DLB Investigations Ltd · Automated monthly MI release notification</p>
</body></html>`;
  return { subject, text, html };
}

// ── Transport ────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: 'smtp.office365.com',
  port: 587,
  secure: false,           // STARTTLS upgrade on 587
  auth: { user, pass },
  requireTLS: true,
  tls: { ciphers: 'TLSv1.2' },
});

// ── Main ─────────────────────────────────────────────────────
(async () => {
  if (!dryRun) {
    try { await transporter.verify(); }
    catch (e) { console.error('SMTP auth failed:', e.message); process.exit(1); }
  }

  let sent = 0, skipped = 0, failed = 0;
  const fails = [];

  for (const [code, list] of Object.entries(recipients)) {
    if (code.startsWith('_') || !Array.isArray(list) || list.length === 0) { skipped++; continue; }
    const clientName = codeToName[code] || code;
    for (const r of list) {
      if (onlyTo && r.email.toLowerCase() !== onlyTo.toLowerCase()) continue;
      const email = buildEmail(r.name, clientName);
      if (dryRun) {
        console.log(`[DRY] ${clientName.padEnd(28)} → ${r.name} <${r.email}>   subj: ${email.subject}`);
        sent++;
        continue;
      }
      try {
        await transporter.sendMail({
          from: `"${fromName}" <${user}>`,
          to: `"${r.name}" <${r.email}>`,
          subject: email.subject,
          text: email.text,
          html: email.html,
        });
        console.log(`  ✓ ${clientName.padEnd(28)} ${r.email}`);
        sent++;
      } catch (e) {
        console.log(`  ✗ ${clientName.padEnd(28)} ${r.email}   ${e.message}`);
        fails.push({ code, recipient: r.email, error: e.message });
        failed++;
      }
    }
  }

  if (!dryRun) transporter.close();
  console.log(`\nDone. Sent ${sent}, skipped ${skipped} client${skipped===1?'':'s'} with no recipients, failed ${failed}.`);
  if (failed) { console.error(JSON.stringify(fails, null, 2)); process.exit(1); }
})();
