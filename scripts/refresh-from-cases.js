#!/usr/bin/env node
// Refresh client JS files from an updated TrackOps cases CSV when no new invoice
// CSV is available. Recomputes case list, SLA, monthly summaries, per-case
// revenue (from cases CSV 'Invoice Total' column). Preserves the existing
// fees_by_item / total_invoiced_lineitems / total_lineitem_count fields from
// the prior generation.
//
// Usage:  node scripts/refresh-from-cases.js <path/to/cases.csv> [--period "Jan–May 2026"]

const fs   = require('fs');
const path = require('path');

const ROOT       = path.resolve(__dirname, '..');
const CLIENT_DIR = path.join(ROOT, 'clients');
const MAP_PATH   = path.join(__dirname, 'client-map.json');

const args = process.argv.slice(2);
const csvPath = args[0];
if (!csvPath) { console.error('Usage: node scripts/refresh-from-cases.js <cases.csv> [--period "Jan–May 2026"]'); process.exit(1); }
let periodOverride = null;
for (let i = 1; i < args.length; i++) if (args[i] === '--period') periodOverride = args[++i];

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const RTC_REPORT_TARGET = 2;
const GEN_REPORT_TARGET = 3;
const UPDATE_TARGET     = 5;

function parseCSV(text) {
  text = text.replace(/^﻿/, '');
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') { if (text[i+1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ',') { row.push(field); field = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i+1] === '\n') i++;
        row.push(field); field = '';
        if (row.length > 1 || row[0] !== '') rows.push(row);
        row = [];
      } else field += ch;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function parseDate(s) {
  if (!s) return null;
  s = String(s).trim();
  if (!s) return null;
  // ISO YYYY-MM-DD
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Date.UTC(+m[1], +m[2]-1, +m[3]));
  // DD/MM/YYYY
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return new Date(Date.UTC(+m[3], +m[2]-1, +m[1]));
  // DD Mon YYYY
  m = s.match(/^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})/);
  if (m) {
    const mi = MONTHS.indexOf(m[2].slice(0,3));
    if (mi >= 0) return new Date(Date.UTC(+m[3], mi, +m[1]));
  }
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

const fmtDate = d => d ? `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}` : '';
const daysBetween = (a, b) => {
  const da = parseDate(a), db = parseDate(b);
  if (!da || !db) return null;
  return Math.round((db - da) / 86400000);
};
const parseMoney = v => {
  if (v === null || v === undefined) return 0;
  const s = String(v).replace(/[^0-9.\-]/g, '');
  return s ? parseFloat(s) : 0;
};
const safePct = (met, n) => !n ? null : Math.round(met / n * 100);
const avg = L => { L = L.filter(x => x !== null && x !== undefined); return L.length ? Math.round(L.reduce((a,b)=>a+b,0)/L.length*10)/10 : 0; };

const today = new Date();
const lastUpdated = `${today.getUTCDate()} ${MONTHS[today.getUTCMonth()]} ${today.getUTCFullYear()}`;

const clientMap = JSON.parse(fs.readFileSync(MAP_PATH, 'utf8')).clients;
const rawRows = parseCSV(fs.readFileSync(csvPath, 'utf8'));
const headers = rawRows[0];
const idx = Object.fromEntries(headers.map((h, i) => [h.trim(), i]));
const need = ['Case Number','Client','Case Type','Case Status','Invoice Total','Date Created','Date client first updated?','Date statement obtained','Date Report sent to client?','Client Reference'];
for (const c of need) if (!(c in idx)) console.warn('WARN missing column:', c);

const rows = rawRows.slice(1).map(r => Object.fromEntries(headers.map((h, i) => [h.trim(), r[i] || ''])));

// Group rows by mapped file
const byFile = new Map();
let unmapped = new Map();
for (const r of rows) {
  const clientKey = String(r['Client'] || '').trim().toLowerCase();
  const mapping = clientMap[clientKey];
  if (!mapping) {
    unmapped.set(r['Client'], (unmapped.get(r['Client']) || 0) + 1);
    continue;
  }
  if (!byFile.has(mapping.file)) byFile.set(mapping.file, { mapping, rows: [] });
  byFile.get(mapping.file).rows.push(r);
}

if (unmapped.size) {
  console.log('\nUnmapped client values (add to scripts/client-map.json):');
  for (const [name, n] of unmapped) console.log(`  ${n.toString().padStart(4)} × "${name}"`);
}

function deriveCase(r) {
  const ref = String(r['Case Number'] || '').trim();
  const ctype = String(r['Case Type'] || '').trim();
  const rtc = /\bRTC\b/i.test(ctype);
  const created    = r['Date Created'];
  const firstUpd   = r['Date client first updated?'];
  const stmt       = r['Date statement obtained'];
  const report     = r['Date Report sent to client?'];

  const invAmt = Math.round(parseMoney(r['Invoice Total']) * 100) / 100;

  const dCU = daysBetween(created, firstUpd);
  let dSR = daysBetween(stmt, report);
  let proxy = false;
  if (dSR === null && parseDate(report) && parseDate(firstUpd)) { dSR = daysBetween(firstUpd, report); proxy = true; }

  const target = rtc ? RTC_REPORT_TARGET : GEN_REPORT_TARGET;
  let slaReport = null;
  if (dSR !== null) slaReport = dSR <= target;
  let slaUpdate = null;
  if (!rtc && dCU !== null) slaUpdate = dCU <= UPDATE_TARGET;

  const cdate = parseDate(created);
  const mon = cdate ? MONTHS[cdate.getUTCMonth()] : null;

  return {
    ref,
    client_ref: r['Client Reference'] ? String(r['Client Reference']) : null,
    type: ctype,
    status: String(r['Case Status'] || ''),
    created: fmtDate(parseDate(created)),
    first_updated: fmtDate(parseDate(firstUpd)),
    stmt_date: fmtDate(parseDate(stmt)),
    report_sent: fmtDate(parseDate(report)),
    days_creation_to_update: dCU,
    days_stmt_to_report: dSR,
    invoice: invAmt,
    is_rtc_case: rtc,
    sla_ack: true,
    sla_contact: true,
    sla_update: slaUpdate,
    sla_report: slaReport,
    report_proxy: proxy,
    sla_report_target_days: target,
    _mon: mon,
  };
}

function buildClientData(mapping, csvRows, existing) {
  const cases = csvRows.map(deriveCase);

  let rtcN = 0, genN = 0, rtcFees = 0, genFees = 0;
  let repRtcMet = 0, repRtcN = 0, repGenMet = 0, repGenN = 0;
  let updMet = 0, updN = 0;
  const monthly = MONTHS.map(m => ({ month: m, case_count: 0, case_count_rtc: 0, case_count_general: 0, total_fees: 0, total_fees_rtc: 0, total_fees_general: 0, cu: [], sr: [], srRtc: [], srGen: [], repRtcMet: 0, repRtcN: 0, repGenMet: 0, repGenN: 0, updMet: 0, updN: 0 }));

  for (const c of cases) {
    if (c.is_rtc_case) { rtcN++; rtcFees += c.invoice; } else { genN++; genFees += c.invoice; }
    if (c.sla_report !== null) {
      if (c.is_rtc_case) { repRtcN++; if (c.sla_report) repRtcMet++; }
      else { repGenN++; if (c.sla_report) repGenMet++; }
    }
    if (c.sla_update !== null) { updN++; if (c.sla_update) updMet++; }

    if (c._mon) {
      const mm = monthly[MONTHS.indexOf(c._mon)];
      mm.case_count++;
      if (c.is_rtc_case) { mm.case_count_rtc++; mm.total_fees_rtc += c.invoice; }
      else               { mm.case_count_general++; mm.total_fees_general += c.invoice; }
      mm.total_fees += c.invoice;
      if (c.days_creation_to_update !== null) mm.cu.push(c.days_creation_to_update);
      if (c.days_stmt_to_report !== null) {
        mm.sr.push(c.days_stmt_to_report);
        (c.is_rtc_case ? mm.srRtc : mm.srGen).push(c.days_stmt_to_report);
      }
      if (c.sla_report !== null) {
        if (c.is_rtc_case) { mm.repRtcN++; if (c.sla_report) mm.repRtcMet++; }
        else { mm.repGenN++; if (c.sla_report) mm.repGenMet++; }
      }
      if (c.sla_update !== null) { mm.updN++; if (c.sla_update) mm.updMet++; }
    }
  }

  const monthlyOut = monthly.map((mm, i) => {
    const cc = mm.case_count;
    const repRtcPct = safePct(mm.repRtcMet, mm.repRtcN);
    const repGenPct = safePct(mm.repGenMet, mm.repGenN);
    const updPct = safePct(mm.updMet, mm.updN);
    const ackPct = cc ? 100 : null;
    const parts = [ackPct, ackPct, updPct, repRtcPct, repGenPct].filter(p => p !== null && p !== undefined);
    const comp = parts.length ? Math.round(parts.reduce((a,b)=>a+b,0)/parts.length) : 0;
    return {
      month: mm.month, month_num: i + 1, case_count: cc,
      case_count_rtc: mm.case_count_rtc, case_count_general: mm.case_count_general,
      total_fees: Math.round(mm.total_fees * 100) / 100,
      ave_fees: cc ? Math.round(mm.total_fees / cc) : 0,
      total_fees_rtc: Math.round(mm.total_fees_rtc * 100) / 100,
      total_fees_general: Math.round(mm.total_fees_general * 100) / 100,
      ave_days_creation_to_update: avg(mm.cu),
      ave_days_creation_to_update_general: avg(mm.cu),
      ave_days_stmt_to_report: avg(mm.sr),
      ave_days_stmt_to_report_rtc: avg(mm.srRtc),
      ave_days_stmt_to_report_general: avg(mm.srGen),
      sla_ack_pct: ackPct, sla_ack_met: cc, sla_ack_n: cc,
      sla_contact_pct: ackPct, sla_contact_met: cc, sla_contact_n: cc,
      sla_update_pct: updPct, sla_update_met: mm.updMet, sla_update_n: mm.updN,
      sla_report_general_pct: repGenPct, sla_report_general_met: mm.repGenMet, sla_report_general_n: mm.repGenN,
      sla_report_rtc_pct: repRtcPct, sla_report_rtc_met: mm.repRtcMet, sla_report_rtc_n: mm.repRtcN,
      sla_compliance_pct: comp,
      sla_met: mm.repRtcMet + mm.repGenMet,
      sla_not_met: (mm.repRtcN - mm.repRtcMet) + (mm.repGenN - mm.repGenMet),
    };
  });

  // fees_by_type from cases
  const byType = new Map();
  for (const c of cases) {
    const key = c.is_rtc_case ? 'RTC' : c.type;
    if (!byType.has(key)) byType.set(key, { type: key, is_rtc: c.is_rtc_case, case_count: 0, total_fees: 0 });
    const bt = byType.get(key);
    bt.case_count++; bt.total_fees += c.invoice;
  }
  const feesByType = [...byType.values()].map(b => ({
    type: b.type, is_rtc: b.is_rtc, case_count: b.case_count,
    total_fees: Math.round(b.total_fees * 100) / 100,
    avg_fee: b.case_count ? Math.round(b.total_fees / b.case_count * 100) / 100 : 0,
  })).sort((a, b) => b.total_fees - a.total_fees);

  const ack = cases.length ? 100 : null;
  const updPctAll = safePct(updMet, updN);
  const repRtcPctAll = safePct(repRtcMet, repRtcN);
  const repGenPctAll = safePct(repGenMet, repGenN);
  const compParts = [ack, ack, updPctAll, repRtcPctAll, repGenPctAll].filter(p => p !== null);
  const overall = compParts.length ? Math.round(compParts.reduce((a,b)=>a+b,0)/compParts.length) : 0;

  // Strip internal _mon
  for (const c of cases) delete c._mon;

  return {
    client_name: mapping.name,
    report_period: periodOverride || existing.report_period || 'Jan–May 2026',
    last_updated: lastUpdated,
    is_rtc_client: rtcN > 0 || mapping.is_rtc === true,
    total_cases: cases.length,
    avg_days_creation_to_update: avg(cases.map(c => c.days_creation_to_update)),
    avg_days_creation_to_update_general: avg(cases.filter(c => !c.is_rtc_case).map(c => c.days_creation_to_update)),
    avg_days_stmt_to_report: avg(cases.map(c => c.days_stmt_to_report)),
    avg_days_stmt_to_report_rtc: avg(cases.filter(c => c.is_rtc_case).map(c => c.days_stmt_to_report)),
    avg_days_stmt_to_report_general: avg(cases.filter(c => !c.is_rtc_case).map(c => c.days_stmt_to_report)),
    sla_ack_pct: ack, sla_contact_pct: ack,
    sla_update_pct: updPctAll,
    sla_report_general_pct: repGenPctAll,
    sla_report_rtc_pct: repRtcPctAll,
    has_rtc_cases: rtcN > 0, has_general_cases: genN > 0,
    sla_compliance_pct: overall,
    sla_met: repRtcMet + repGenMet,
    sla_not_met: (repRtcN - repRtcMet) + (repGenN - repGenMet),
    avg_fee_rtc: rtcN ? Math.round(rtcFees / rtcN * 100) / 100 : 0,
    avg_fee_general: genN ? Math.round(genFees / genN * 100) / 100 : 0,
    total_fees_rtc: Math.round(rtcFees * 100) / 100,
    total_fees_general: Math.round(genFees * 100) / 100,
    rtc_case_count: rtcN, general_case_count: genN,
    fees_by_type: feesByType,
    // Preserved from existing (line-item data unchanged in this refresh)
    total_invoiced_lineitems: existing.total_invoiced_lineitems ?? 0,
    total_lineitem_count: existing.total_lineitem_count ?? 0,
    fees_by_item: existing.fees_by_item || [],
    monthly: monthlyOut,
    cases,
  };
}

function readExisting(file) {
  const base = path.resolve(CLIENT_DIR);
  const target = path.resolve(base, file);
  const rel = path.relative(base, target);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    return {};
  }
  const src = fs.readFileSync(target, 'utf8');
  const m = src.match(/var\s+DLB_CLIENT_DATA\s*=\s*([\s\S]+?);\s*$/);
  if (!m) return {};
  try { return JSON.parse(m[1]); } catch { return {}; }
}

function writeFile(file, data) {
  const header = `// ============================================================
// DLB Investigations Ltd — MI Portal Client Data
// Client:  ${data.client_name}
// File:    ${file}
// Period:  ${data.report_period}
// Updated: ${data.last_updated}
// GENERATED AUTOMATICALLY FROM TrackOps CSV — DO NOT EDIT MANUALLY
// ============================================================

`;
  const body = `var DLB_CLIENT_DATA = ${JSON.stringify(data, null, 2)};\n`;
  const base = path.resolve(CLIENT_DIR);
  const target = path.resolve(base, file);
  const relative = path.relative(base, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Invalid file path');
  }
  fs.writeFileSync(target, header + body);
}

let touched = 0;
const summary = [];
for (const [file, { mapping, rows: clientRows }] of byFile) {
  const existing = readExisting(file);
  const oldSla = existing.sla_compliance_pct;
  const oldCases = existing.total_cases;
  const data = buildClientData(mapping, clientRows, existing);
  writeFile(file, data);
  summary.push({ file, name: mapping.name, oldCases, newCases: data.total_cases, oldSla, newSla: data.sla_compliance_pct });
  touched++;
}

console.log(`\nRefreshed ${touched} client files from ${path.basename(csvPath)} (line-item totals preserved):\n`);
console.log('File'.padEnd(22) + 'Client'.padEnd(28) + 'Cases (was→now)'.padEnd(20) + 'SLA (was→now)');
console.log('─'.repeat(85));
for (const s of summary.sort((a,b)=>a.file.localeCompare(b.file))) {
  console.log(
    s.file.padEnd(22) +
    s.name.padEnd(28) +
    `${(s.oldCases ?? '?')} → ${s.newCases}`.padEnd(20) +
    `${(s.oldSla ?? '?')}% → ${s.newSla}%`
  );
}
