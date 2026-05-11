#!/usr/bin/env node
// Send the monthly MI release notification to every client in
// scripts/client-recipients.json that has at least one address.
//
// Uses Microsoft Graph (POST /users/{sender}/sendMail) authenticated with the
// OAuth2 client-credentials grant. The Azure AD app registration must have the
// Microsoft Graph "Mail.Send" application permission with admin consent.
//
// Required env vars:
//   GRAPH_TENANT_ID       Directory (tenant) ID of the Azure AD app
//   GRAPH_CLIENT_ID       Application (client) ID
//   GRAPH_CLIENT_SECRET   client secret value (NOT the secret ID)
//   GRAPH_SENDER          full email of the sending mailbox (e.g. midata@dlbinvestigations.co.uk)
// Optional env vars:
//   GRAPH_FROM_NAME       display name in the From line (default "DLB Investigations")
//   PORTAL_URL            override default https://dlbltd.github.io/MI-Portal/
//   PERIOD_LABEL          override the auto "Jan–Dec YYYY" period label
//   DRY_RUN=1             log what would be sent but do not actually send
//   ONLY_TO=email         restrict to a single recipient (testing)
//   SAVE_TO_SENT=1        also save a copy in the sender's Sent Items folder

const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_PORTAL_URL = 'https://dlbltd.github.io/MI-Portal/';

const tenantId = process.env.GRAPH_TENANT_ID;
const clientId = process.env.GRAPH_CLIENT_ID;
const clientSecret = process.env.GRAPH_CLIENT_SECRET;
const sender = process.env.GRAPH_SENDER;
const fromName = process.env.GRAPH_FROM_NAME || 'DLB Investigations';
const portalUrl = process.env.PORTAL_URL || DEFAULT_PORTAL_URL;
const dryRun = process.env.DRY_RUN === '1';
const onlyTo = process.env.ONLY_TO;
const saveToSent = process.env.SAVE_TO_SENT === '1';

if (!dryRun) {
  const missing = ['GRAPH_TENANT_ID','GRAPH_CLIENT_ID','GRAPH_CLIENT_SECRET','GRAPH_SENDER']
    .filter(k => !process.env[k]);
  if (missing.length) { console.error('Missing env vars:', missing.join(', ')); process.exit(1); }
}

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

// ── Graph auth + send ────────────────────────────────────────
async function getToken() {
  const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  const json = await res.json();
  if (!res.ok) throw new Error(`Token request failed (${res.status}): ${json.error_description || JSON.stringify(json)}`);
  return json.access_token;
}

async function sendOne(token, { to, toName, subject, text, html }) {
  const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`;
  const body = {
    message: {
      subject,
      body: { contentType: 'HTML', content: html },
      toRecipients: [{ emailAddress: { address: to, name: toName || to } }],
      from: { emailAddress: { address: sender, name: fromName } },
    },
    saveToSentItems: saveToSent,
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.status === 202) return;
  let detail = `HTTP ${res.status}`;
  try { detail = JSON.stringify(await res.json()); } catch {}
  throw new Error(`Graph sendMail failed: ${detail}`);
}

// ── Main ─────────────────────────────────────────────────────
(async () => {
  let token = null;
  if (!dryRun) {
    try { token = await getToken(); console.log('✓ Graph auth OK'); }
    catch (e) { console.error('✗ Graph auth failed:', e.message); process.exit(1); }
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
        await sendOne(token, { to: r.email, toName: r.name, subject: email.subject, text: email.text, html: email.html });
        console.log(`  ✓ ${clientName.padEnd(28)} ${r.email}`);
        sent++;
      } catch (e) {
        console.log(`  ✗ ${clientName.padEnd(28)} ${r.email}   ${e.message}`);
        fails.push({ code, recipient: r.email, error: e.message });
        failed++;
      }
    }
  }

  console.log(`\nDone. Sent ${sent}, skipped ${skipped} client${skipped===1?'':'s'} with no recipients, failed ${failed}.`);
  if (failed) { console.error(JSON.stringify(fails, null, 2)); process.exit(1); }
})();
