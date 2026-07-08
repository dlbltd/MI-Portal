#!/usr/bin/env node
// Email a client their MI data as a CSV attachment via Microsoft Graph —
// for use when the client cannot reach the portal (corp firewall etc.).
//
// Usage:  CLIENT_CODE=INSHUR26 node scripts/email-client-data.js
// Or:     node scripts/email-client-data.js INSHUR26 ANDE26
//
// Env vars (same as the other Graph senders):
//   GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET, GRAPH_SENDER
//   GRAPH_FROM_NAME (optional), DRY_RUN=1 (optional), SAVE_TO_SENT=1 (optional)

const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const tenantId     = process.env.GRAPH_TENANT_ID;
const clientId     = process.env.GRAPH_CLIENT_ID;
const clientSecret = process.env.GRAPH_CLIENT_SECRET;
const sender       = process.env.GRAPH_SENDER;
const fromName     = process.env.GRAPH_FROM_NAME || 'DLB Investigations';
const dryRun       = process.env.DRY_RUN === '1';
const saveToSent   = process.env.SAVE_TO_SENT === '1';

const codes = (process.argv.slice(2).length ? process.argv.slice(2) : (process.env.CLIENT_CODE || '').split(/[\s,]+/))
  .map(s => s.trim().toUpperCase()).filter(Boolean);

if (!codes.length) { console.error('Provide at least one CLIENT_CODE (e.g. INSHUR26 ANDE26).'); process.exit(1); }
if (!dryRun) {
  const missing = ['GRAPH_TENANT_ID','GRAPH_CLIENT_ID','GRAPH_CLIENT_SECRET','GRAPH_SENDER']
    .filter(k => !process.env[k]);
  if (missing.length) { console.error('Missing env vars:', missing.join(', ')); process.exit(1); }
}

// ── Registry: access code → client JS file (kept in step with index.html) ──
const REGISTRY = {
  FIRSTCENTRAL26: 'clients/firstcentral.js',
  ZEBRA26:        'clients/zebra.js',
  TRINITY26:      'clients/trinity.js',
  INSHUR26:       'clients/inshur.js',
  DWF26:          'clients/dwf.js',
  CARCAREPLAN26:  'clients/carcareplan.js',
  ACTION36526:    'clients/action365.js',
  COLLINGWOOD26:  'clients/collingwood.js',
  ANDE26:         'clients/ande.js',
  JPSOLICITORS26: 'clients/jpsolicitors.js',
  KEOGHS26:       'clients/keoghs.js',
  WEIGHTMANS26:   'clients/weightmans.js',
  TRANSPORT26:    'clients/transportation.js',
  ZEGO26:         'clients/zego.js',
};

const recipientsByCode = JSON.parse(fs.readFileSync(path.join(__dirname, 'client-recipients.json'), 'utf8')).recipients;

function loadClient(file) {
  const target = path.resolve(ROOT, file);
  const relative = path.relative(ROOT, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Invalid file path`);
  }
  const src = fs.readFileSync(target, 'utf8');
  const m = src.match(/var\s+DLB_CLIENT_DATA\s*=\s*([\s\S]+?);\s*$/);
  if (!m) throw new Error(`Cannot parse ${file}`);
  return JSON.parse(m[1]);
}

function csvEscape(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function buildCsv(client) {
  const lines = [];
  lines.push(`DLB Investigations — Management Information Report`);
  lines.push(`Client,${csvEscape(client.client_name)}`);
  lines.push(`Report period,${csvEscape(client.report_period)}`);
  lines.push(`Last updated,${csvEscape(client.last_updated)}`);
  lines.push('');

  lines.push('--- Headline KPIs ---');
  lines.push('Metric,Value');
  lines.push(`Total cases,${client.total_cases || 0}`);
  lines.push(`RTC cases,${client.rtc_case_count || 0}`);
  lines.push(`General cases,${client.general_case_count || 0}`);
  lines.push(`Total fees — RTC,${client.total_fees_rtc || 0}`);
  lines.push(`Total fees — General,${client.total_fees_general || 0}`);
  lines.push(`Avg fee — RTC,${client.avg_fee_rtc || 0}`);
  lines.push(`Avg fee — General,${client.avg_fee_general || 0}`);
  lines.push(`Total invoiced (line items),${client.total_invoiced_lineitems || 0}`);
  lines.push(`Overall SLA compliance %,${client.sla_compliance_pct ?? ''}`);
  lines.push(`SLA — Update %,${client.sla_update_pct ?? ''}`);
  lines.push(`SLA — Report (General) %,${client.sla_report_general_pct ?? ''}`);
  lines.push(`SLA — Report (RTC) %,${client.sla_report_rtc_pct ?? ''}`);
  lines.push(`Avg days creation → first update,${client.avg_days_creation_to_update ?? ''}`);
  lines.push(`Avg days statement → report,${client.avg_days_stmt_to_report ?? ''}`);
  lines.push('');

  lines.push('--- Monthly summary ---');
  lines.push('Month,Cases,RTC cases,General cases,Total fees,RTC fees,General fees,Avg fee,Update SLA %,Report SLA RTC %,Report SLA General %,Overall SLA %');
  for (const m of (client.monthly || [])) {
    if (!m.case_count) continue;
    lines.push([m.month, m.case_count, m.case_count_rtc, m.case_count_general, m.total_fees, m.total_fees_rtc, m.total_fees_general, m.ave_fees,
      m.sla_update_pct ?? '', m.sla_report_rtc_pct ?? '', m.sla_report_general_pct ?? '', m.sla_compliance_pct ?? ''].map(csvEscape).join(','));
  }
  lines.push('');

  lines.push('--- Fees by work type ---');
  lines.push('Type,RTC,Cases,Total fees,Avg fee');
  for (const t of (client.fees_by_type || [])) {
    lines.push([t.type, t.is_rtc ? 'Yes' : 'No', t.case_count, t.total_fees, t.avg_fee].map(csvEscape).join(','));
  }
  lines.push('');

  lines.push('--- Fees by line item ---');
  lines.push('Item,RTC,Count,Total,Avg');
  for (const i of (client.fees_by_item || [])) {
    lines.push([i.item, i.is_rtc ? 'Yes' : 'No', i.count, i.total, i.avg].map(csvEscape).join(','));
  }
  lines.push('');

  // Case-level detail is intentionally EXCLUDED from email attachments — too
  // sensitive to send by plain email. Case refs / client refs / per-case dates
  // remain accessible only via the access-code-gated portal.
  return lines.join('\n');
}

function buildEmail(client, recipName) {
  const first = (recipName || '').split(' ')[0] || 'there';
  const subject = `${client.client_name} — MI Report (${client.report_period}) — data attached`;
  const text = `Hi ${first},

We've been told the DLB MI Portal isn't reachable from your network at the moment (your IT team are looking into it). In the meantime please find your full ${client.report_period} MI data attached as a CSV file (opens directly in Excel).

The file contains:
  • Headline KPIs (cases, revenue, SLA compliance)
  • Month-by-month performance
  • Fee breakdown by work type and by line item
  • Full case-level detail log

Once the portal is reachable again you'll be able to view all of this — plus charts — at https://mi.dlbinvestigations.co.uk/

Any questions, just reply to this email.

Best regards,
${fromName}
`;
  const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1e2128;line-height:1.55;max-width:560px;margin:24px auto;padding:0 16px">
<p>Hi ${first},</p>
<p>We've been told the DLB MI Portal isn't reachable from your network at the moment (your IT team are looking into it). In the meantime please find your full <strong>${client.report_period}</strong> MI data attached as a CSV file (opens directly in Excel).</p>
<p>The file contains:</p>
<ul>
  <li>Headline KPIs — cases, revenue, SLA compliance</li>
  <li>Month-by-month performance</li>
  <li>Fee breakdown by work type and by line item</li>
  <li>Full case-level detail log</li>
</ul>
<p>Once the portal is reachable again you'll be able to view all of this — plus charts — at <a href="https://mi.dlbinvestigations.co.uk/">mi.dlbinvestigations.co.uk</a>.</p>
<p>Any questions, just reply to this email.</p>
<p style="margin-top:24px">Best regards,<br>${fromName}</p>
</body></html>`;
  return { subject, text, html };
}

function safeName(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

async function getToken() {
  const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: clientId, client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials',
  });
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  const json = await res.json();
  if (!res.ok) throw new Error(`Token request failed (${res.status}): ${json.error_description || JSON.stringify(json)}`);
  return json.access_token;
}

async function sendOne(token, { to, toName, subject, html, attachName, attachContent }) {
  const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`;
  const body = {
    message: {
      subject,
      body: { contentType: 'HTML', content: html },
      from: { emailAddress: { address: sender, name: fromName } },
      toRecipients: [{ emailAddress: { address: to, name: toName || to } }],
      attachments: [{
        '@odata.type': '#microsoft.graph.fileAttachment',
        name: attachName,
        contentType: 'text/csv',
        contentBytes: Buffer.from(attachContent, 'utf8').toString('base64'),
      }],
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

(async () => {
  let token = null;
  if (!dryRun) { token = await getToken(); console.log('✓ Graph auth OK\n'); }

  for (const code of codes) {
    const file = REGISTRY[code];
    if (!file) { console.error(`! Unknown access code: ${code}`); continue; }
    const recips = recipientsByCode[code] || [];
    if (!recips.length) { console.error(`! No recipients in client-recipients.json for ${code}`); continue; }

    const client = loadClient(file);
    const csv = buildCsv(client);
    const attachName = `${safeName(client.client_name)}-mi-${safeName(client.report_period)}.csv`;

    console.log(`${code} (${client.client_name}) — ${recips.length} recipient(s), CSV ${csv.length.toLocaleString()} bytes`);
    for (const r of recips) {
      const email = buildEmail(client, r.name);
      if (dryRun) { console.log(`  [DRY] → ${r.name} <${r.email}>   ${attachName}`); continue; }
      try {
        await sendOne(token, { to: r.email, toName: r.name, subject: email.subject, html: email.html, attachName, attachContent: csv });
        console.log(`  ✓ ${r.name.padEnd(28)} ${r.email}`);
      } catch (e) {
        console.log(`  ✗ ${r.name.padEnd(28)} ${r.email}   ${e.message}`);
      }
    }
  }
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
