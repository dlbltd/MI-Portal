#!/usr/bin/env node
// Process a TrackOps CSV export and (re)generate clients/<file>.js for each
// mapped client. Output schema matches what dashboard.html reads.
//
// Usage:
//   node scripts/process-csv.js <csv-path> [--year YYYY] [--out clients]
//
// SLA model — driven by CASE TYPE, not client:
//   General cases (Motor Fraud, Motor Theft, Large Loss, Intel Report, etc.):
//     sla_ack      ≤ 4hrs   from Date Created            (hard-coded true)
//     sla_contact  ≤ 24hrs  from Date Created            (hard-coded true)
//     sla_update   ≤ 5d     Date Created → first updated (measured)
//     sla_report   ≤ 72hrs  Stmt → Report sent           (measured; falls back to first_updated → Report
//                                                         when stmt is blank, with report_proxy:true)
//   RTC-type cases (Case Type = "RTC"):
//     sla_ack      ≤ 4hrs   (hard-coded true)
//     sla_contact  ≤ 24hrs  (hard-coded true; will be data-driven from RTC API once wired)
//     sla_report   ≤ 48hrs  Stmt → Report (proxy fallback)
//     sla_update   null     (no update SLA for RTC; the 24h text replaces it)
//
// is_rtc_client at the client level indicates the client purchases the RTC service
// (so we can fetch text-sent times from rtc-8jmy.onrender.com) — but the per-case SLA
// thresholds are determined entirely by the case's own type.

const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const SLA_REPORT_DAYS = { rtc: 2, std: 3 };   // 48h / 72h, daily precision
const SLA_UPDATE_DAYS = 5;

// ── CLI args ─────────────────────────────────────────────────
const args = process.argv.slice(2);
if (!args.length || args[0].startsWith('--')) {
  console.error('Usage: node scripts/process-csv.js <csv-path> [--year YYYY] [--out clients]');
  process.exit(1);
}
const csvPath = args[0];
const opts = { year: null, out: 'clients' };
for (let i = 1; i < args.length; i++) {
  if (args[i] === '--year') opts.year = parseInt(args[++i], 10);
  else if (args[i] === '--out') opts.out = args[++i];
}

if (!fs.existsSync(csvPath)) { console.error(`CSV not found: ${csvPath}`); process.exit(1); }
const clientMap = JSON.parse(fs.readFileSync(path.join(__dirname, 'client-map.json'), 'utf8')).clients;
const outDir = path.resolve(ROOT, opts.out);
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// ── CSV parser ───────────────────────────────────────────────
function parseCSV(text) {
  text = text.replace(/^﻿/, '');
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i+1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else {
      if (ch === '"') inQuotes = true;
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

// ── Helpers ──────────────────────────────────────────────────
function parseISODate(s) {
  if (!s) return null;
  const m = s.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2]-1, +m[3]));
  return isNaN(d) ? null : d;
}
const ukDate     = d => d ? `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}` : '';
// Date-diff in whole days. Returns null for missing dates OR when the "later" date
// is actually before the "earlier" one (almost always a TrackOps data-entry typo —
// negative day counts have no business in an SLA dashboard).
const daysBetween = (a, b) => {
  if (!a || !b) return null;
  const d = Math.round((b - a) / 86400000);
  return d < 0 ? null : d;
};
const round1 = n => Math.round(n * 10) / 10;
const round2 = n => Math.round(n * 100) / 100;
const num    = n => (n === null || n === undefined || isNaN(n)) ? 'null'
                  : Number.isInteger(n) ? String(n) : String(round2(n));
const jsBool = b => b === true ? 'true' : b === false ? 'false' : 'null';
const jsStr  = s => '"' + String(s || '').replace(/\\/g,'\\\\').replace(/"/g,'\\"') + '"';
const pct    = (met, not) => (met + not) > 0 ? Math.round(met / (met + not) * 100) : null;

// ── Read + parse ─────────────────────────────────────────────
const rows = parseCSV(fs.readFileSync(csvPath, 'utf8'));
if (!rows.length) { console.error('Empty CSV'); process.exit(1); }
const headers = rows[0].map(h => h.trim());
const idx = Object.fromEntries(headers.map((h,i) => [h, i]));
const need = ['Case Number','Reference No.','Client','Case Type','Case Status','Invoice Total',
              'Date Created','Date client first updated?','Date statement obtained','Date Report sent to client?',
              'Services','Flags'];
for (const h of need) if (idx[h] === undefined) { console.error(`Missing column: ${h}`); process.exit(1); }

// ── Empty monthly template ───────────────────────────────────
function emptyMonthly() {
  return MONTHS.map((m, i) => ({
    month: m, month_num: i+1, case_count: 0,
    case_count_rtc: 0, case_count_general: 0,
    total_fees: 0, ave_fees: 0,
    total_fees_rtc: 0, total_fees_general: 0,
    ave_days_creation_to_update: 0,
    ave_days_creation_to_update_general: 0,  // RTC has no update SLA so not tracked per-segment
    ave_days_stmt_to_report:     0,
    ave_days_stmt_to_report_rtc: 0,
    ave_days_stmt_to_report_general: 0,
    // SLA tallies (filled during pass)
    _ack_met: 0, _ack_not: 0,
    _con_met: 0, _con_not: 0,
    _upd_met: 0, _upd_not: 0,
    _rep_gen_met: 0, _rep_gen_not: 0,
    _rep_rtc_met: 0, _rep_rtc_not: 0,
    // accumulators for averages
    _sumU: 0, _cntU: 0, _sumS: 0, _cntS: 0,
    _sumU_gen: 0, _cntU_gen: 0,
    _sumS_rtc: 0, _cntS_rtc: 0, _sumS_gen: 0, _cntS_gen: 0,
  }));
}

// ── Aggregate ────────────────────────────────────────────────
const byFile = new Map();
const unmatched = new Map();
let lastDate = null;

for (let i = 1; i < rows.length; i++) {
  const r = rows[i];
  if (!r || r.length < 5) continue;
  const clientRaw = (r[idx['Client']] || '').trim();
  if (!clientRaw) continue;
  const mapping = clientMap[clientRaw.toLowerCase()];
  if (!mapping) { unmatched.set(clientRaw, (unmatched.get(clientRaw) || 0) + 1); continue; }
  if (!byFile.has(mapping.file)) byFile.set(mapping.file, { mapping, cases: [], monthly: emptyMonthly() });
  const bucket = byFile.get(mapping.file);

  const caseType = (r[idx['Case Type']] || '').trim();
  const services = (r[idx['Services']] || '').toLowerCase();
  const flags    = (r[idx['Flags']]    || '').toLowerCase();
  // RTC is flagged in any of: Case Type = "RTC", or Services/Flags contains "rtc"
  // (word-bounded to avoid false hits on "rtc" inside other words).
  const rtcRe = /\brtc\b/;
  const isRTCCase = caseType.toUpperCase() === 'RTC' || rtcRe.test(services) || rtcRe.test(flags);

  const dCreated = parseISODate(r[idx['Date Created']]);
  const dFirst   = parseISODate(r[idx['Date client first updated?']]);
  const dStmt    = parseISODate(r[idx['Date statement obtained']]);
  const dReport  = parseISODate(r[idx['Date Report sent to client?']]);
  const invoice  = parseFloat((r[idx['Invoice Total']] || '0').replace(/[^0-9.\-]/g, '')) || 0;

  if (dCreated && (!lastDate || dCreated > lastDate)) lastDate = dCreated;

  const dToUpdate = daysBetween(dCreated, dFirst);
  const dStmtRep  = daysBetween(dStmt,    dReport);

  // ── SLA assessment (per case type, not per client) ─────────
  // Ack + contact: hard-coded true (will be data-driven once timestamps/RTC API available).
  // Tally as "met" only when the case has any other measurable signal (avoids inflating
  // compliance with cases that have zero data).
  const hasAnySignal = dToUpdate !== null || dStmtRep !== null || dReport !== null;
  const sla_ack     = hasAnySignal ? true : null;
  const sla_contact = hasAnySignal ? true : null;

  // Update SLA — general (non-RTC-type) cases only
  let sla_update = null;
  if (!isRTCCase && dToUpdate !== null) sla_update = dToUpdate <= SLA_UPDATE_DAYS;

  // Report SLA target driven by case type: 48h for RTC, 72h for everything else
  const target = isRTCCase ? SLA_REPORT_DAYS.rtc : SLA_REPORT_DAYS.std;
  let sla_report = null, sla_report_proxy = false, days_for_report_sla = null;
  if (dStmtRep !== null) {
    days_for_report_sla = dStmtRep;
    sla_report = dStmtRep <= target;
  } else if (dFirst && dReport) {
    days_for_report_sla = daysBetween(dFirst, dReport);
    sla_report = days_for_report_sla <= target;
    sla_report_proxy = true;
  }

  // Tally into monthly bucket
  const mi = dCreated ? dCreated.getUTCMonth() : null;
  if (mi !== null) {
    const mo = bucket.monthly[mi];
    mo.case_count++;
    mo.total_fees += invoice;
    if (isRTCCase) {
      mo.case_count_rtc++;
      mo.total_fees_rtc += invoice;
      if (dStmtRep !== null) { mo._sumS_rtc += dStmtRep; mo._cntS_rtc++; }
      // RTC has no creation→update SLA — skip per-segment tracking
    } else {
      mo.case_count_general++;
      mo.total_fees_general += invoice;
      if (dToUpdate !== null) { mo._sumU_gen += dToUpdate; mo._cntU_gen++; }
      if (dStmtRep  !== null) { mo._sumS_gen += dStmtRep;  mo._cntS_gen++; }
    }
    if (dToUpdate !== null) { mo._sumU += dToUpdate; mo._cntU++; }
    if (dStmtRep  !== null) { mo._sumS += dStmtRep;  mo._cntS++; }
    if (sla_ack     === true) mo._ack_met++; else if (sla_ack     === false) mo._ack_not++;
    if (sla_contact === true) mo._con_met++; else if (sla_contact === false) mo._con_not++;
    if (sla_update  === true) mo._upd_met++; else if (sla_update  === false) mo._upd_not++;
    if (sla_report !== null) {
      if (isRTCCase) {
        if (sla_report) mo._rep_rtc_met++; else mo._rep_rtc_not++;
      } else {
        if (sla_report) mo._rep_gen_met++; else mo._rep_gen_not++;
      }
    }
  }

  // Fee breakdown — RTC-flagged cases bucket as "RTC" (regardless of literal Case Type);
  // everything else uses its literal Case Type. Avoids double-counting.
  if (!bucket.feesByType) bucket.feesByType = new Map();
  const ftKey = isRTCCase ? 'RTC' : (caseType || 'Unknown');
  if (!bucket.feesByType.has(ftKey)) bucket.feesByType.set(ftKey, { type: ftKey, is_rtc: isRTCCase, case_count: 0, total_fees: 0 });
  const ft = bucket.feesByType.get(ftKey);
  ft.case_count++;
  ft.total_fees += invoice;
  // RTC vs General totals (based on is_rtc_case which considers Case Type + Services + Flags)
  if (!bucket.feesRTC)     bucket.feesRTC     = { case_count: 0, total_fees: 0 };
  if (!bucket.feesGeneral) bucket.feesGeneral = { case_count: 0, total_fees: 0 };
  const feeBucket = isRTCCase ? bucket.feesRTC : bucket.feesGeneral;
  feeBucket.case_count++;
  feeBucket.total_fees += invoice;

  bucket.cases.push({
    ref:           r[idx['Case Number']]    || '',
    client_ref:    r[idx['Reference No.']]  || '',
    type:          r[idx['Case Type']]      || '',
    status:        r[idx['Case Status']]    || '',
    created:       ukDate(dCreated),
    first_updated: ukDate(dFirst),
    stmt_date:     ukDate(dStmt),
    report_sent:   ukDate(dReport),
    days_creation_to_update:  dToUpdate,
    days_stmt_to_report:      dStmtRep,
    invoice:       round2(invoice),
    is_rtc_case: isRTCCase,
    sla_ack, sla_contact, sla_update, sla_report,
    report_proxy: sla_report_proxy,
    sla_report_target_days: target,
  });
}

// ── Finalise + emit ──────────────────────────────────────────
function finalise(bucket) {
  let TU=0, NU=0, TS=0, NS=0;
  let TU_gen=0, NU_gen=0;
  let TS_rtc=0, NS_rtc=0, TS_gen=0, NS_gen=0;
  let ackM=0,ackN=0, conM=0,conN=0, updM=0,updN=0;
  let repGM=0,repGN=0, repRM=0,repRN=0;
  for (const m of bucket.monthly) {
    if (m.case_count > 0) {
      m.total_fees = round2(m.total_fees);
      m.ave_fees   = round2(m.total_fees / m.case_count);
      m.total_fees_rtc     = round2(m.total_fees_rtc);
      m.total_fees_general = round2(m.total_fees_general);
      m.ave_days_creation_to_update         = m._cntU     ? round1(m._sumU     / m._cntU)     : 0;
      m.ave_days_creation_to_update_general = m._cntU_gen ? round1(m._sumU_gen / m._cntU_gen) : 0;
      m.ave_days_stmt_to_report             = m._cntS     ? round1(m._sumS     / m._cntS)     : 0;
      m.ave_days_stmt_to_report_rtc         = m._cntS_rtc ? round1(m._sumS_rtc / m._cntS_rtc) : 0;
      m.ave_days_stmt_to_report_general     = m._cntS_gen ? round1(m._sumS_gen / m._cntS_gen) : 0;
    }
    m.sla_ack_pct             = pct(m._ack_met, m._ack_not);
    m.sla_ack_met             = m._ack_met;
    m.sla_ack_n               = m._ack_met + m._ack_not;
    m.sla_contact_pct         = pct(m._con_met, m._con_not);
    m.sla_contact_met         = m._con_met;
    m.sla_contact_n           = m._con_met + m._con_not;
    m.sla_update_pct          = pct(m._upd_met, m._upd_not);
    m.sla_update_met          = m._upd_met;
    m.sla_update_n            = m._upd_met + m._upd_not;
    m.sla_report_general_pct  = pct(m._rep_gen_met, m._rep_gen_not);
    m.sla_report_general_met  = m._rep_gen_met;
    m.sla_report_general_n    = m._rep_gen_met + m._rep_gen_not;
    m.sla_report_rtc_pct      = pct(m._rep_rtc_met, m._rep_rtc_not);
    m.sla_report_rtc_met      = m._rep_rtc_met;
    m.sla_report_rtc_n        = m._rep_rtc_met + m._rep_rtc_not;
    // Combined compliance (across all measurable SLA outcomes for the month)
    const tM = m._ack_met + m._con_met + m._upd_met + m._rep_gen_met + m._rep_rtc_met;
    const tN = m._ack_not + m._con_not + m._upd_not + m._rep_gen_not + m._rep_rtc_not;
    m.sla_compliance_pct = pct(tM, tN) || 0;
    // Legacy KPI: report SLA totals (combined gen + rtc)
    m.sla_met     = m._rep_gen_met + m._rep_rtc_met;
    m.sla_not_met = m._rep_gen_not + m._rep_rtc_not;

    TU += m._sumU; NU += m._cntU;
    TS += m._sumS; NS += m._cntS;
    TU_gen += m._sumU_gen; NU_gen += m._cntU_gen;
    TS_rtc += m._sumS_rtc; NS_rtc += m._cntS_rtc;
    TS_gen += m._sumS_gen; NS_gen += m._cntS_gen;
    ackM += m._ack_met; ackN += m._ack_not;
    conM += m._con_met; conN += m._con_not;
    updM += m._upd_met; updN += m._upd_not;
    repGM += m._rep_gen_met; repGN += m._rep_gen_not;
    repRM += m._rep_rtc_met; repRN += m._rep_rtc_not;

    for (const k of ['_sumU','_cntU','_sumS','_cntS',
                     '_sumU_gen','_cntU_gen','_sumS_rtc','_cntS_rtc','_sumS_gen','_cntS_gen',
                     '_ack_met','_ack_not','_con_met','_con_not',
                     '_upd_met','_upd_not',
                     '_rep_gen_met','_rep_gen_not','_rep_rtc_met','_rep_rtc_not']) delete m[k];
  }
  const tM = ackM+conM+updM+repGM+repRM;
  const tN = ackN+conN+updN+repGN+repRN;
  return {
    avg_days_creation_to_update:         NU     ? round1(TU     / NU)     : 0,
    avg_days_creation_to_update_general: NU_gen ? round1(TU_gen / NU_gen) : 0,
    avg_days_stmt_to_report:             NS     ? round1(TS     / NS)     : 0,
    avg_days_stmt_to_report_rtc:         NS_rtc ? round1(TS_rtc / NS_rtc) : 0,
    avg_days_stmt_to_report_general:     NS_gen ? round1(TS_gen / NS_gen) : 0,
    sla_ack_pct:             pct(ackM, ackN),
    sla_contact_pct:         pct(conM, conN),
    sla_update_pct:          pct(updM, updN),
    sla_report_general_pct:  pct(repGM, repGN),
    sla_report_rtc_pct:      pct(repRM, repRN),
    has_rtc_cases:           (repRM + repRN) > 0,
    has_general_cases:       (repGM + repGN + updM + updN) > 0,
    sla_compliance_pct: pct(tM, tN) || 0,
    sla_met:     repGM + repRM,
    sla_not_met: repGN + repRN,
    // Fees split (computed in main loop via bucket.feesRTC/feesGeneral/feesByType)
    avg_fee_rtc:     bucket.feesRTC     && bucket.feesRTC.case_count     ? round2(bucket.feesRTC.total_fees     / bucket.feesRTC.case_count)     : 0,
    avg_fee_general: bucket.feesGeneral && bucket.feesGeneral.case_count ? round2(bucket.feesGeneral.total_fees / bucket.feesGeneral.case_count) : 0,
    total_fees_rtc:     bucket.feesRTC     ? round2(bucket.feesRTC.total_fees)     : 0,
    total_fees_general: bucket.feesGeneral ? round2(bucket.feesGeneral.total_fees) : 0,
    rtc_case_count:     bucket.feesRTC     ? bucket.feesRTC.case_count     : 0,
    general_case_count: bucket.feesGeneral ? bucket.feesGeneral.case_count : 0,
    fees_by_type: bucket.feesByType
      ? [...bucket.feesByType.values()]
          .map(b => ({ type: b.type, is_rtc: !!b.is_rtc, case_count: b.case_count, total_fees: round2(b.total_fees), avg_fee: round2(b.total_fees / b.case_count) }))
          .sort((a, b) => b.total_fees - a.total_fees)
      : [],
  };
}

function renderMonth(m) {
  return `    { month:"${m.month}", month_num:${m.month_num}, case_count:${m.case_count}, case_count_rtc:${m.case_count_rtc}, case_count_general:${m.case_count_general}, total_fees:${num(m.total_fees)}, ave_fees:${num(m.ave_fees)}, total_fees_rtc:${num(m.total_fees_rtc)}, total_fees_general:${num(m.total_fees_general)}, ave_days_creation_to_update:${num(m.ave_days_creation_to_update)}, ave_days_creation_to_update_general:${num(m.ave_days_creation_to_update_general)}, ave_days_stmt_to_report:${num(m.ave_days_stmt_to_report)}, ave_days_stmt_to_report_rtc:${num(m.ave_days_stmt_to_report_rtc)}, ave_days_stmt_to_report_general:${num(m.ave_days_stmt_to_report_general)}, sla_ack_pct:${num(m.sla_ack_pct)}, sla_ack_met:${m.sla_ack_met}, sla_ack_n:${m.sla_ack_n}, sla_contact_pct:${num(m.sla_contact_pct)}, sla_contact_met:${m.sla_contact_met}, sla_contact_n:${m.sla_contact_n}, sla_update_pct:${num(m.sla_update_pct)}, sla_update_met:${m.sla_update_met}, sla_update_n:${m.sla_update_n}, sla_report_general_pct:${num(m.sla_report_general_pct)}, sla_report_general_met:${m.sla_report_general_met}, sla_report_general_n:${m.sla_report_general_n}, sla_report_rtc_pct:${num(m.sla_report_rtc_pct)}, sla_report_rtc_met:${m.sla_report_rtc_met}, sla_report_rtc_n:${m.sla_report_rtc_n}, sla_compliance_pct:${m.sla_compliance_pct}, sla_met:${m.sla_met}, sla_not_met:${m.sla_not_met} }`;
}
function renderCase(c) {
  return `    { ref:${jsStr(c.ref)}, client_ref:${jsStr(c.client_ref)}, type:${jsStr(c.type)}, status:${jsStr(c.status)}, created:${jsStr(c.created)}, first_updated:${jsStr(c.first_updated)}, stmt_date:${jsStr(c.stmt_date)}, report_sent:${jsStr(c.report_sent)}, days_creation_to_update:${num(c.days_creation_to_update)}, days_stmt_to_report:${num(c.days_stmt_to_report)}, invoice:${num(c.invoice)}, is_rtc_case:${c.is_rtc_case ? 'true' : 'false'}, sla_ack:${jsBool(c.sla_ack)}, sla_contact:${jsBool(c.sla_contact)}, sla_update:${jsBool(c.sla_update)}, sla_report:${jsBool(c.sla_report)}, report_proxy:${c.report_proxy ? 'true' : 'false'}, sla_report_target_days:${c.sla_report_target_days} }`;
}

const year = opts.year || (lastDate ? lastDate.getUTCFullYear() : new Date().getUTCFullYear());
const period = `Jan–Dec ${year}`;
const today = new Date();
const lastUpdated = `${today.getUTCDate()} ${MONTHS[today.getUTCMonth()]} ${today.getUTCFullYear()}`;

let written = 0;
for (const [file, bucket] of byFile) {
  const top = finalise(bucket);
  bucket.cases.sort((a, b) => (a.ref || '').localeCompare(b.ref || ''));
  const monthlyStr = bucket.monthly.map(renderMonth).join(',\n');
  const casesStr   = bucket.cases.length ? bucket.cases.map(renderCase).join(',\n') : '    // No cases in this period';
  const totalCases = bucket.cases.length;

  const content = `// ============================================================
// DLB Investigations Ltd — MI Portal Client Data
// Client:  ${bucket.mapping.name}
// File:    ${file}
// Period:  ${period}
// Updated: ${lastUpdated}
// GENERATED AUTOMATICALLY — DO NOT EDIT MANUALLY
// ============================================================

var DLB_CLIENT_DATA = {

  client_name:                  "${bucket.mapping.name}",
  report_period:                "${period}",
  last_updated:                 "${lastUpdated}",
  is_rtc_client:                ${bucket.mapping.is_rtc ? 'true' : 'false'},
  total_cases:                  ${totalCases},

  avg_days_creation_to_update:         ${num(top.avg_days_creation_to_update)},
  avg_days_creation_to_update_general: ${num(top.avg_days_creation_to_update_general)},
  avg_days_stmt_to_report:             ${num(top.avg_days_stmt_to_report)},
  avg_days_stmt_to_report_rtc:         ${num(top.avg_days_stmt_to_report_rtc)},
  avg_days_stmt_to_report_general:     ${num(top.avg_days_stmt_to_report_general)},

  sla_ack_pct:                  ${num(top.sla_ack_pct)},
  sla_contact_pct:              ${num(top.sla_contact_pct)},
  sla_update_pct:               ${num(top.sla_update_pct)},
  sla_report_general_pct:       ${num(top.sla_report_general_pct)},
  sla_report_rtc_pct:           ${num(top.sla_report_rtc_pct)},
  has_rtc_cases:                ${top.has_rtc_cases ? 'true' : 'false'},
  has_general_cases:            ${top.has_general_cases ? 'true' : 'false'},
  sla_compliance_pct:           ${top.sla_compliance_pct},
  sla_met:                      ${top.sla_met},
  sla_not_met:                  ${top.sla_not_met},

  avg_fee_rtc:                  ${num(top.avg_fee_rtc)},
  avg_fee_general:              ${num(top.avg_fee_general)},
  total_fees_rtc:               ${num(top.total_fees_rtc)},
  total_fees_general:           ${num(top.total_fees_general)},
  rtc_case_count:               ${top.rtc_case_count},
  general_case_count:           ${top.general_case_count},
  fees_by_type: [
${top.fees_by_type.map(b => `    { type:${jsStr(b.type)}, is_rtc:${b.is_rtc ? 'true' : 'false'}, case_count:${b.case_count}, total_fees:${num(b.total_fees)}, avg_fee:${num(b.avg_fee)} }`).join(',\n')}
  ],

  monthly: [
${monthlyStr}
  ],

  cases: [
${casesStr}
  ]

};
`;
  fs.writeFileSync(path.join(outDir, file), content);
  written++;
  const rtcCases = bucket.cases.filter(c => c.is_rtc_case).length;
  const slaParts = [
    `ack ${top.sla_ack_pct ?? '–'}%`,
    `contact ${top.sla_contact_pct ?? '–'}%`,
    top.has_general_cases ? `update ${top.sla_update_pct ?? '–'}%` : null,
    top.has_general_cases ? `rep-gen ${top.sla_report_general_pct ?? '–'}%` : null,
    top.has_rtc_cases     ? `rep-RTC ${top.sla_report_rtc_pct ?? '–'}%`     : null,
  ].filter(Boolean).join(' · ');
  console.log(`  ✓ ${file.padEnd(22)} ${String(totalCases).padStart(3)} cases  (${rtcCases} RTC)  ${slaParts}`);
}

if (unmatched.size) {
  console.log('\n  Unmatched client names (add to scripts/client-map.json if needed):');
  for (const [k, v] of unmatched) console.log(`    ${v} cases  ←  "${k}"`);
}
console.log(`\nDone. Wrote ${written} file(s) to ${path.relative(ROOT, outDir)}/   Period: ${period}   |   Updated: ${lastUpdated}`);
