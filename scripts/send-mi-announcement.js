#!/usr/bin/env node
// One-off MI release announcement — single Microsoft Graph sendMail with all
// recipients in Bcc so addresses are never visible to each other. Generic body
// (no client name, no first-name personalisation).
//
// Required env vars (same as send-monthly-email.js):
//   GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET, GRAPH_SENDER
// Optional:
//   GRAPH_FROM_NAME   display name (default "DLB Investigations")
//   PORTAL_URL        override portal URL
//   PERIOD_LABEL      e.g. "Jan–May 2026"
//   DRY_RUN=1         log recipients but do not send
//   SAVE_TO_SENT=1    save copy in sender's Sent Items

const fs   = require('fs');
const path = require('path');

const tenantId     = process.env.GRAPH_TENANT_ID;
const clientId     = process.env.GRAPH_CLIENT_ID;
const clientSecret = process.env.GRAPH_CLIENT_SECRET;
const sender       = process.env.GRAPH_SENDER;
const fromName     = process.env.GRAPH_FROM_NAME || 'DLB Investigations';
const portalUrl    = process.env.PORTAL_URL || 'https://mi.dlbinvestigations.co.uk/';
const periodLabel  = process.env.PERIOD_LABEL || 'Jan–May 2026';
const dryRun       = process.env.DRY_RUN === '1';
const saveToSent   = process.env.SAVE_TO_SENT === '1';

if (!dryRun) {
  const missing = ['GRAPH_TENANT_ID','GRAPH_CLIENT_ID','GRAPH_CLIENT_SECRET','GRAPH_SENDER']
    .filter(k => !process.env[k]);
  if (missing.length) { console.error('Missing env vars:', missing.join(', ')); process.exit(1); }
}

// Collect every recipient from client-recipients.json (skip _comment keys + empties)
const recipientsByCode = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'client-recipients.json'), 'utf8')
).recipients;

const bccList = [];
const seen = new Set();
for (const [code, list] of Object.entries(recipientsByCode)) {
  if (code.startsWith('_') || !Array.isArray(list)) continue;
  for (const r of list) {
    const addr = String(r.email || '').trim();
    if (!addr) continue;
    const key = addr.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    bccList.push({ address: addr, name: r.name || addr });
  }
}

if (!bccList.length) { console.error('No recipients found.'); process.exit(1); }

const subject = `DLB MI Portal — June 2026 update`;

const text = `Hello,

The latest Management Information report (covering ${periodLabel}) is now live on the DLB MI Portal.

Visit ${portalUrl} and sign in with the access code provided by your DLB account manager. The dashboard covers:

  • RTC and general SLA compliance
  • Revenue and case volume
  • Fee breakdown by work type
  • Month-by-month performance trend
  • Full case detail log

NEW: you can now export the full dataset to Excel or save the dashboard as PDF using the buttons in the top-right of the portal.

If anything looks off or you need a new access code, just reply to this email.

Best regards,
${fromName}
`;

const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1e2128;line-height:1.55;max-width:560px;margin:24px auto;padding:0 16px">
<p>Hello,</p>
<p>The latest <strong>Management Information report</strong> (covering <strong>${periodLabel}</strong>) is now live on the DLB MI Portal.</p>
<p style="margin:28px 0;text-align:center">
  <a href="${portalUrl}" style="display:inline-block;background:#4a7fc1;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:600;letter-spacing:0.5px">Open the MI Portal →</a>
</p>
<p>Sign in with the access code provided by your DLB account manager. The dashboard covers:</p>
<ul style="color:#3a404d">
  <li>RTC and general SLA compliance</li>
  <li>Revenue and case volume</li>
  <li>Fee breakdown by work type</li>
  <li>Month-by-month performance trend</li>
  <li>Full case detail log</li>
</ul>
<p><strong>NEW:</strong> you can now export the full dataset to <strong>Excel</strong> or save the dashboard as <strong>PDF</strong> using the buttons in the top-right of the portal.</p>
<p>If anything looks off or you need a new access code, just reply to this email.</p>
<p style="margin-top:24px;color:#3a404d">Best regards,<br>${fromName}</p>
<hr style="border:none;border-top:1px solid #e1e4e8;margin:24px 0">
<p style="font-size:11px;color:#8a95a3">DLB Investigations Ltd · MI release notification</p>
</body></html>`;

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

async function sendBccBlast(token) {
  const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`;
  const message = {
    subject,
    body: { contentType: 'HTML', content: html },
    from: { emailAddress: { address: sender, name: fromName } },
    toRecipients: [{ emailAddress: { address: sender, name: fromName } }],
    bccRecipients: bccList.map(r => ({ emailAddress: { address: r.address, name: r.name } })),
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, saveToSentItems: saveToSent }),
  });
  if (res.status === 202) return;
  let detail = `HTTP ${res.status}`;
  try { detail = JSON.stringify(await res.json()); } catch {}
  throw new Error(`Graph sendMail failed: ${detail}`);
}

(async () => {
  console.log(`Announcement blast — ${bccList.length} BCC recipients, subject: "${subject}"`);
  for (const r of bccList) console.log(`  · ${r.name.padEnd(28)} <${r.address}>`);
  if (dryRun) { console.log('\n[DRY RUN] No mail sent.'); return; }
  const token = await getToken();
  console.log('\n✓ Graph auth OK');
  await sendBccBlast(token);
  console.log(`✓ Sent to ${bccList.length} BCC recipients via Microsoft Graph.`);
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
