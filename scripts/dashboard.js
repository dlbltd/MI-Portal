// Visible JS error banner — temporary diagnostic
window.addEventListener('error', e => {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#c0392b;color:#fff;padding:14px 20px;font:13px/1.4 monospace;white-space:pre-wrap;';
  el.textContent = '⚠ JS ERROR: ' + e.message + '\nat ' + (e.filename||'?') + ':' + (e.lineno||'?') + ':' + (e.colno||'?');
  document.body && document.body.appendChild(el);
});

// Dual-mode auth resolution:
//   • Azure SWA: /.auth/me returns the signed-in user + their roles. Roles like
//     "client-inshur" or "dlb-admin" map to which clients/*.js file to load.
//   • GitHub Pages (legacy): sessionStorage was populated by index.html with the
//     access code → client file mapping.
let authCode  = sessionStorage.getItem('dlb_auth');
let clientFile = sessionStorage.getItem('dlb_client');

async function _resolveAuth(){
  // If SWA identity is present, prefer it (it's authoritative)
  if (window.DLB_AUTH) {
    const principal = await window.DLB_AUTH.getPrincipal();
    if (principal) {
      const resolved = await window.DLB_AUTH.resolveClient();
      if (!resolved) { window.location.href = 'index.html?denied=1'; return false; }
      if (resolved.adminAll) { window.location.href = 'dashboard-all.html'; return false; }
      authCode  = principal.userId || principal.userDetails;
      clientFile = resolved.file;
      return true;
    }
  }
  // Fall back to session-based access code (GitHub Pages legacy path)
  if (!authCode || !clientFile) { window.location.href = 'index.html'; return false; }
  return true;
}

Chart.defaults.color = '#6b7a99';
Chart.defaults.borderColor = 'rgba(30,42,69,0.6)';
Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.font.size = 11;

const C = {
  blue:'#4a7fc1', blueA:'rgba(74,127,193,0.2)',
  green:'#5a9e7c', greenA:'rgba(90,158,124,0.2)',
  amber:'#b8860b', amberA:'rgba(184,134,11,0.2)',
  red:'#c0392b', redA:'rgba(192,57,43,0.2)',
  purple:'#7d8fa8', purpleA:'rgba(125,143,168,0.2)',
  rtc:'#7c3aed', rtcA:'rgba(124,58,237,0.2)',
};

function runningAvg(arr) {
  let sum = 0, n = 0;
  return arr.map(v => { if (v && v > 0) { sum += v; n++; } return n ? +(sum/n).toFixed(1) : null; });
}

function daysColor(d) {
  if (d === null || d === undefined) return 'var(--muted)';
  if (d <= 10) return '#5a9e7c';
  if (d <= 20) return '#b8860b';
  return '#c0392b';
}

function daysCell(d, proxy) {
  if (d === null || d === undefined) return '<span class="days-na">—</span>';
  const cls = d <= 10 ? 'days-good' : d <= 20 ? 'days-warn' : 'days-bad';
  return `<span class="${cls}">${d}d${proxy ? ' †' : ''}</span>`;
}

function logout() { sessionStorage.clear(); window.location.href = 'index.html'; }

function renderDashboard(CLIENT) {
  const M      = CLIENT.monthly;
  const CASES  = CLIENT.cases || [];
  const months = M.map(m => m.month);
  const hasRTC     = CLIENT.has_rtc_cases === true;
  const hasGeneral = CLIENT.has_general_cases !== false;

  // Header
  document.getElementById('clientChip').textContent     = CLIENT.client_name;
  document.getElementById('headerSubtitle').textContent = CLIENT.client_name + ' — Management Information';
  document.getElementById('reportPeriod').textContent   = CLIENT.report_period;
  document.getElementById('reportYear').textContent     = CLIENT.report_period;
  document.getElementById('tablePeriodBadge').textContent = CLIENT.report_period;
  document.getElementById('updateBanner').textContent   =
    'Data last updated: ' + CLIENT.last_updated + '  ·  Period: ' + CLIENT.report_period + '  ·  Prepared by DLB Investigations Ltd';
  document.getElementById('footerDate').textContent =
    'Accessed: ' + new Date().toLocaleDateString('en-GB', {day:'numeric',month:'long',year:'numeric'});

  // KPIs
  // Revenue: prefer invoice line-item total (more accurate — reflects actual billed value)
  // and fall back to summing case-CSV monthly totals when invoice data isn't loaded.
  const caseFeesTotal  = M.reduce((a,m) => a + (m.total_fees||0), 0);
  const totalRev   = CLIENT.total_invoiced_lineitems || caseFeesTotal;
  const totalCases = M.reduce((a,m) => a + (m.case_count||0), 0);
  const avgFee     = totalCases ? Math.round(totalRev / totalCases) : 0;
  const usingInvoiceData = (CLIENT.total_invoiced_lineitems || 0) > 0;

  // Overall + per-segment day averages
  const avgUpdate    = CLIENT.avg_days_creation_to_update          || 0;
  const avgUpdateGen = CLIENT.avg_days_creation_to_update_general  || 0;
  const avgStmt      = CLIENT.avg_days_stmt_to_report              || 0;
  const avgStmtRtc   = CLIENT.avg_days_stmt_to_report_rtc          || 0;
  const avgStmtGen   = CLIENT.avg_days_stmt_to_report_general      || 0;
  const slaMet     = CLIENT.sla_met     || 0;
  const slaNotMet  = CLIENT.sla_not_met || 0;
  const slaTot     = slaMet + slaNotMet;
  const slaPct     = slaTot ? Math.round(slaMet / slaTot * 100) : 0;

  document.getElementById('kpiRevenue').textContent    = '£' + totalRev.toLocaleString();
  document.getElementById('kpiRevenueSub').textContent = usingInvoiceData
    ? `${CLIENT.total_lineitem_count} billed items · ${CLIENT.report_period}`
    : CLIENT.report_period;
  document.getElementById('kpiCases').textContent      = totalCases;
  document.getElementById('kpiCasesSub').textContent   = M.filter(m => m.case_count > 0).length + ' active months';
  // (Avg fee is now shown as two pills — RTC and Other — populated below)
  // Histogram helper — bars in red when over SLA threshold (or null for no threshold)
  function renderHistogram(el, days, threshold) {
    if (!el) return;
    if (!days.length) { el.innerHTML = '<div style="font-size:10px;color:var(--muted);align-self:center;margin:auto">No data yet</div>'; return; }
    const max = Math.max(...days);
    const buckets = [];
    for (let i = 0; i <= max; i++) buckets.push(0);
    for (const d of days) buckets[d]++;
    const peak = Math.max(...buckets);
    el.innerHTML = buckets.map((count, day) => {
      const h = peak ? Math.max(2, (count / peak) * 100) : 2;
      const cls = (threshold !== null && day > threshold) ? 'h-bar h-miss' : 'h-bar';
      return `<div class="${cls}" style="height:${h}%" title="${count} case${count===1?'':'s'} at ${day} day${day===1?'':'s'}">${(day===0 || day===max) ? `<span class="h-lbl">${day}d</span>` : ''}</div>`;
    }).join('');
  }

  // ── RTC PERFORMANCE SECTION ─────────────────────────────────
  if (hasRTC) {
    document.getElementById('rtcSectionLabel').style.display = 'flex';
    document.getElementById('rtcKpiRow').style.display       = 'flex';
    const rtcCases = CASES.filter(c => c.is_rtc_case);
    const rtcN = CLIENT.rtc_case_count || 0;
    const totalN = CLIENT.total_cases || CASES.length;
    document.getElementById('kpiRtcCases').textContent     = rtcN;
    document.getElementById('kpiRtcCasesSub').textContent  = totalN ? `${Math.round(rtcN/totalN*100)}% of total cases` : '—';
    // Pull RTC revenue from invoice line items (the "RTC" item) — the case-CSV figures
    // inflate the avg because cases with escalated work include non-RTC line items in their total.
    const rtcItem = (CLIENT.fees_by_item || []).find(x => x.is_rtc);
    if (rtcItem) {
      document.getElementById('kpiRtcRevenue').textContent     = '£' + rtcItem.total.toLocaleString();
      document.getElementById('kpiRtcRevenueSub').textContent  = `${rtcItem.count} billed item${rtcItem.count===1?'':'s'} · avg £${rtcItem.avg.toLocaleString()} per item`;
    } else {
      document.getElementById('kpiRtcRevenue').textContent     = '£' + (CLIENT.total_fees_rtc || 0).toLocaleString();
      document.getElementById('kpiRtcRevenueSub').textContent  = 'case-CSV view — invoice details not loaded';
    }
    document.getElementById('kpiRtcStmtReport').textContent = avgStmtRtc ? avgStmtRtc + 'd' : '—';
    const rtcStmtDays = rtcCases.map(c => c.days_stmt_to_report).filter(d => d !== null);
    renderHistogram(document.getElementById('histRtcStmtReport'), rtcStmtDays, 2);
    document.getElementById('kpiRtcStmtSub').textContent = `${rtcStmtDays.length} measurable case${rtcStmtDays.length===1?'':'s'} · target ≤2d`;
    const rPct = CLIENT.sla_report_rtc_pct;
    document.getElementById('kpiRtcSla').textContent = (rPct === null || rPct === undefined) ? '—' : rPct + '%';
    // Compute met/n on the fly: pct = met/n*100 → met = round(pct*n/100), need n separately
    const rtcMeasurable = rtcCases.filter(c => c.sla_report !== null);
    const rtcMet = rtcMeasurable.filter(c => c.sla_report === true).length;
    document.getElementById('kpiRtcSlaSub').textContent = `${rtcMet}/${rtcMeasurable.length} measurable · target ≤48h`;
  }

  // ── GENERAL PERFORMANCE SECTION ─────────────────────────────
  if (hasGeneral) {
    document.getElementById('genSectionLabel').style.display = 'flex';
    document.getElementById('genKpiRow').style.display       = 'flex';
    const genCases = CASES.filter(c => !c.is_rtc_case);
    const genN = CLIENT.general_case_count || 0;
    const totalN = CLIENT.total_cases || CASES.length;
    document.getElementById('kpiGenCases').textContent     = genN;
    document.getElementById('kpiGenCasesSub').textContent  = totalN ? `${Math.round(genN/totalN*100)}% of total cases` : '—';
    // Sum all non-RTC line items as General revenue
    const genItems = (CLIENT.fees_by_item || []).filter(x => !x.is_rtc);
    if (genItems.length) {
      const genTotal = genItems.reduce((s, x) => s + x.total, 0);
      const genCount = genItems.reduce((s, x) => s + x.count, 0);
      document.getElementById('kpiGenRevenue').textContent    = '£' + genTotal.toLocaleString();
      document.getElementById('kpiGenRevenueSub').textContent = `${genCount} billed item${genCount===1?'':'s'} · avg £${Math.round(genTotal/genCount).toLocaleString()} per item`;
    } else {
      document.getElementById('kpiGenRevenue').textContent    = '£' + (CLIENT.total_fees_general || 0).toLocaleString();
      document.getElementById('kpiGenRevenueSub').textContent = 'case-CSV view — invoice details not loaded';
    }
    document.getElementById('kpiGenUpdate').textContent    = avgUpdateGen ? avgUpdateGen + 'd' : '—';
    const genUpdateDays = genCases.map(c => c.days_creation_to_update).filter(d => d !== null);
    renderHistogram(document.getElementById('histGenUpdate'), genUpdateDays, 5);
    const updPct = CLIENT.sla_update_pct;
    document.getElementById('kpiGenUpdateSub').textContent = (updPct === null || updPct === undefined)
      ? `${genUpdateDays.length} measurable · target ≤5d`
      : `${updPct}% within SLA · ${genUpdateDays.length} measurable · target ≤5d`;
    document.getElementById('kpiGenStmtReport').textContent = avgStmtGen ? avgStmtGen + 'd' : '—';
    const genStmtDays = genCases.map(c => c.days_stmt_to_report).filter(d => d !== null);
    renderHistogram(document.getElementById('histGenStmtReport'), genStmtDays, 3);
    const gPct = CLIENT.sla_report_general_pct;
    document.getElementById('kpiGenStmtSub').textContent = (gPct === null || gPct === undefined)
      ? `${genStmtDays.length} measurable · target ≤3d`
      : `${gPct}% within SLA · ${genStmtDays.length} measurable · target ≤3d`;
  }

  // Revenue by Service Type — driven by invoice line items (one row per billed
  // line in the TrackOps invoice details export). RTC line items get the purple
  // accent. Falls back to the case-type-based view (fees_by_type) when no invoice
  // data is available — useful for testing or partial deployments.
  const fg = document.getElementById('feeGrid');
  const items = CLIENT.fees_by_item || [];
  if (items.length) {
    const overallTotal = CLIENT.total_invoiced_lineitems || 0;
    const overallN     = CLIENT.total_lineitem_count    || 0;
    const overallAvg   = overallN ? Math.round(overallTotal / overallN * 100) / 100 : 0;
    const overallCard = `
      <div class="fee-card overall">
        <div class="fc-label">All Services</div>
        <div class="fc-value">£${overallTotal.toLocaleString()}</div>
        <div class="fc-sub">${overallN} billed item${overallN===1?'':'s'} · avg £${overallAvg.toLocaleString()}</div>
        <div class="fc-total">Total billed in period</div>
      </div>`;
    const itemCards = items.map(b => `
      <div class="fee-card ${b.is_rtc ? 'rtc' : ''}">
        <div class="fc-label">${b.item}</div>
        <div class="fc-value">£${(b.total || 0).toLocaleString()}</div>
        <div class="fc-sub">${b.count} item${b.count===1?'':'s'} · avg £${(b.avg || 0).toLocaleString()}</div>
        <div class="fc-total">${b.is_rtc ? 'RTC service' : 'Other service'}</div>
      </div>`).join('');
    fg.innerHTML = overallCard + itemCards;
  } else if (CLIENT.fees_by_type && CLIENT.fees_by_type.length) {
    // Fallback: no invoice CSV was loaded — show case-type rollup so the dashboard isn't blank
    const overallTotal = (CLIENT.total_fees_rtc || 0) + (CLIENT.total_fees_general || 0);
    const overallN     = (CLIENT.rtc_case_count || 0) + (CLIENT.general_case_count || 0);
    const overallAvg   = overallN ? Math.round(overallTotal / overallN * 100) / 100 : 0;
    fg.innerHTML = `<div class="fee-card overall">
        <div class="fc-label">All Work Types</div>
        <div class="fc-value">£${overallAvg.toLocaleString()}</div>
        <div class="fc-sub">avg / case · ${overallN} case${overallN===1?'':'s'}</div>
        <div class="fc-total">Total £${overallTotal.toLocaleString()} (case-CSV view — no invoice detail)</div>
      </div>` + CLIENT.fees_by_type.map(b => `
      <div class="fee-card ${b.is_rtc ? 'rtc' : ''}">
        <div class="fc-label">${b.type}</div>
        <div class="fc-value">£${(b.avg_fee || 0).toLocaleString()}</div>
        <div class="fc-sub">avg / case · ${b.case_count} case${b.case_count===1?'':'s'}</div>
        <div class="fc-total">Total £${(b.total_fees || 0).toLocaleString()}</div>
      </div>`).join('');
  } else {
    fg.innerHTML = '<div class="fee-card"><div class="fc-label">No data</div></div>';
  }

  // Avg Fee KPI — RTC vs Other split, driven by invoice line items (not case CSV).
  // The case-CSV "avg fee per case" lumps escalated work into the RTC bucket and
  // includes £0 stood-down cases — it gave £173 for Zego which was misleading.
  // Using line items directly: RTC avg = total of "RTC" item / count of those lines.
  const fbItems = CLIENT.fees_by_item || [];
  const rtcItem = fbItems.find(x => x.is_rtc);
  const genLines = fbItems.filter(x => !x.is_rtc);
  const genTotal = genLines.reduce((s, x) => s + x.total, 0);
  const genCount = genLines.reduce((s, x) => s + x.count, 0);
  const genAvg   = genCount ? Math.round(genTotal / genCount) : 0;
  if (rtcItem) {
    document.getElementById('kpiAvgFeeRtc').textContent    = '£' + Math.round(rtcItem.avg).toLocaleString();
    document.getElementById('kpiAvgFeeRtcSub').textContent = `${rtcItem.count} billed items · total £${rtcItem.total.toLocaleString()}`;
  } else {
    document.getElementById('kpiAvgFeeRtc').textContent    = '—';
    document.getElementById('kpiAvgFeeRtcSub').textContent = 'No RTC billed items';
  }
  if (genCount) {
    document.getElementById('kpiAvgFeeGen').textContent    = '£' + genAvg.toLocaleString();
    document.getElementById('kpiAvgFeeGenSub').textContent = `${genCount} billed items · total £${genTotal.toLocaleString()}`;
  } else {
    document.getElementById('kpiAvgFeeGen').textContent    = '—';
    document.getElementById('kpiAvgFeeGenSub').textContent = 'No other billed items';
  }
  const totLines = (rtcItem ? rtcItem.count : 0) + genCount;
  const totRev   = (rtcItem ? rtcItem.total : 0) + genTotal;
  document.getElementById('kpiAvgFeeBreakdown').textContent = totLines
    ? `Overall avg £${Math.round(totRev/totLines).toLocaleString()} across ${totLines} billed items`
    : 'No invoice data loaded';
  // Fee histogram — bucketed in £200 bands, label first and last bucket only
  const fees = CASES.map(c => c.invoice || 0).filter(v => v > 0);
  const feeEl = document.getElementById('histAvgFee');
  if (!feeEl) {
    // Element optional — skip if not in the DOM
  } else if (!fees.length) {
    feeEl.innerHTML = '<div style="font-size:10px;color:var(--muted);align-self:center;margin:auto">No invoiced cases yet</div>';
  } else {
    const W = 200;
    const maxFee = Math.max(...fees);
    const nBuckets = Math.min(20, Math.ceil(maxFee / W) || 1);
    const buckets = new Array(nBuckets).fill(0);
    for (const f of fees) {
      const i = Math.min(nBuckets - 1, Math.floor(f / W));
      buckets[i]++;
    }
    const peak = Math.max(...buckets);
    feeEl.innerHTML = buckets.map((cnt, i) => {
      const h = peak ? Math.max(2, (cnt / peak) * 100) : 2;
      const lo = i * W, hi = (i + 1) * W;
      const lbl = (i === 0) ? '<span class="h-lbl">£0</span>'
                : (i === buckets.length - 1) ? `<span class="h-lbl">£${(maxFee >= W * nBuckets ? `${(W*nBuckets/1000).toFixed(1)}k+` : `${(hi/1000).toFixed(1)}k`)}</span>`
                : '';
      return `<div class="h-bar" style="height:${h}%" title="${cnt} case${cnt===1?'':'s'} between £${lo}–£${hi}">${lbl}</div>`;
    }).join('');
  }
  const overallPct = CLIENT.sla_compliance_pct;
  document.getElementById('kpiSLA').textContent        = (overallPct ?? 0) + '%';
  document.getElementById('kpiSLASub').textContent     = slaMet + ' report met, ' + slaNotMet + ' not met';

  // ── CHARTS ──

  new Chart(document.getElementById('chartRevenue'), {
    type: 'bar',
    data: { labels: months, datasets: [
      { label:'Total Fees', data:M.map(m=>m.total_fees||null), backgroundColor:C.blueA, borderColor:C.blue, borderWidth:1.5, borderRadius:4, order:2 },
      { label:'Running Avg', data:runningAvg(M.map(m=>m.total_fees)), type:'line', borderColor:C.green, borderWidth:2, pointRadius:3, pointBackgroundColor:C.green, tension:0.4, fill:false, order:1 }
    ]},
    options: { responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{position:'top',labels:{boxWidth:10,padding:14}}, tooltip:{callbacks:{label:ctx=>' £'+(ctx.raw||0).toLocaleString()}} },
      scales:{ x:{grid:{display:false}}, y:{grid:{color:'rgba(30,42,69,0.6)'}, ticks:{callback:v=>'£'+v.toLocaleString()}} }
    }
  });

  new Chart(document.getElementById('chartCaseCount'), {
    type: 'bar',
    data: { labels:months, datasets:[{ label:'Cases', data:M.map(m=>m.case_count||null), backgroundColor:C.purpleA, borderColor:C.purple, borderWidth:1.5, borderRadius:4 }]},
    options: { responsive:true, maintainAspectRatio:false,
      plugins:{legend:{display:false}},
      scales:{x:{grid:{display:false}}, y:{grid:{color:'rgba(30,42,69,0.6)'},ticks:{stepSize:1}}}
    }
  });

  new Chart(document.getElementById('chartSLA'), {
    type: 'bar',
    data: { labels: months, datasets: [
      { label:'SLA %', data:M.map(m=>m.sla_compliance_pct>0?m.sla_compliance_pct:null),
        backgroundColor:M.map(m=>m.sla_compliance_pct>=80?C.greenA:m.sla_compliance_pct>=50?C.amberA:C.redA),
        borderColor:M.map(m=>m.sla_compliance_pct>=80?C.green:m.sla_compliance_pct>=50?C.amber:C.red),
        borderWidth:1.5, borderRadius:4 },
      { label:'Target (80%)', data:Array(months.length).fill(80), type:'line', borderColor:C.green, borderWidth:1.5, borderDash:[5,4], pointRadius:0, fill:false }
    ]},
    options: { responsive:true, maintainAspectRatio:false,
      plugins:{legend:{position:'top',labels:{boxWidth:10,padding:14}}, tooltip:{callbacks:{label:ctx=>' '+(ctx.raw||0)+'%'}}},
      scales:{x:{grid:{display:false}}, y:{grid:{color:'rgba(30,42,69,0.6)'},max:110,ticks:{callback:v=>v+'%'}}}
    }
  });

  // Bucket revenue by the same logic used for fee cards: RTC-flagged cases collapse to "RTC"
  const revMap = {};
  CASES.forEach(c => {
    const t = c.is_rtc_case ? 'RTC' : (c.type || 'Unknown');
    if (t === 'Unknown') return;
    revMap[t] = (revMap[t] || 0) + (c.invoice || 0);
  });
  // Unified color palette — keep RTC = purple to match the KPI/fee-card accents.
  const TYPE_PALETTE = {
    'RTC':                       'rgba(124,58,237,0.8)',  // purple — locked to RTC everywhere
    'Motor Fraud':               'rgba(74,127,193,0.8)',  // blue
    'Motor Theft':               'rgba(232,78,106,0.8)',  // red
    'Large Loss':                'rgba(245,166,35,0.8)',  // amber
    'Motor Liability':           'rgba(31,212,160,0.8)',  // teal
    'Intelligence Report':       'rgba(125,143,168,0.8)', // slate
    'Household fraud claim':     'rgba(217,119,87,0.8)',  // burnt-orange
    'Gap Insurance investigation': 'rgba(155,93,229,0.6)',// lilac (rare; muted to avoid RTC clash)
    'Surveillance':              'rgba(90,158,124,0.8)',  // green
    'Trace and Locate only':     'rgba(184,134,11,0.8)',  // gold
    'Fatality':                  'rgba(160,82,45,0.8)',   // sienna
    'Employers Liability':       'rgba(70,130,180,0.6)',  // steel-blue
    'Public Liability':          'rgba(106,90,205,0.6)',  // slate-blue
    'Motor Fire':                'rgba(255,99,71,0.8)',   // tomato
  };
  const colorForType = t => TYPE_PALETTE[t] || 'rgba(138,149,163,0.7)';
  const revLabels = Object.keys(revMap);
  const revColors = revLabels.map(colorForType);
  const pieOpts = { responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'bottom',labels:{boxWidth:10,padding:10,font:{size:11}}}} };
  new Chart(document.getElementById('chartRevPie'), {
    type:'doughnut', data:{labels:revLabels, datasets:[{data:Object.values(revMap), backgroundColor:revColors, borderColor:'rgba(10,13,20,0.8)', borderWidth:2}]},
    options:{...pieOpts, plugins:{...pieOpts.plugins, tooltip:{callbacks:{label:ctx=>' '+ctx.label+': £'+ctx.raw.toLocaleString()}}}}
  });
  new Chart(document.getElementById('chartAvgFee'), {
    type:'line', data:{labels:months, datasets:[
      { label:'Avg Fee', data:M.map(m=>m.ave_fees||null), borderColor:C.amber, backgroundColor:C.amberA, borderWidth:2, pointRadius:4, pointBackgroundColor:C.amber, tension:0.4, fill:true },
      { label:'Running Avg', data:runningAvg(M.map(m=>m.ave_fees)), borderColor:C.blue, borderWidth:2, pointRadius:2, tension:0.4, fill:false }
    ]},
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{legend:{position:'top',labels:{boxWidth:10,padding:14}}, tooltip:{callbacks:{label:ctx=>' £'+(ctx.raw||0).toLocaleString()}}},
      scales:{x:{grid:{display:false}}, y:{grid:{color:'rgba(30,42,69,0.6)'},ticks:{callback:v=>'£'+v}}}
    }
  });

  // ── MONTHLY TABLE ──
  // Hide RTC column at clients with no RTC cases all year (also hide "Update" if no general cases).
  if (!hasRTC)     document.querySelectorAll('.col-rep-rtc').forEach(el => el.style.display = 'none');
  if (!hasGeneral) document.querySelectorAll('.col-rep-gen, .col-update').forEach(el => el.style.display = 'none');
  const tbody = document.getElementById('tableBody');
  const slaCell = (pct, met, n, hide) => {
    if (hide) return '';
    if (pct === null || pct === undefined || !n) return '<td>—</td>';
    const cls = pct >= 80 ? 'b-sla-met' : pct >= 50 ? 'b-mid' : 'b-sla-notmet';
    return `<td><span class="badge ${cls}">${pct}%</span> <span class="sla-frac">(${met}/${n})</span></td>`;
  };
  M.forEach(m => {
    const d = (v, suf='d') => v>0 ? v+suf : '—';
    tbody.innerHTML += `<tr>
      <td><strong>${m.month}</strong></td>
      <td>${m.case_count||0}</td>
      <td>${m.total_fees>0?'£'+m.total_fees.toLocaleString():'—'}</td>
      <td>${m.ave_fees>0?'£'+m.ave_fees.toLocaleString():'—'}</td>
      <td style="color:${daysColor(m.ave_days_creation_to_update)}">${d(m.ave_days_creation_to_update)}</td>
      <td style="color:${daysColor(m.ave_days_stmt_to_report)}">${d(m.ave_days_stmt_to_report)}</td>
      ${slaCell(m.sla_ack_pct, m.sla_ack_met, m.sla_ack_n)}
      ${slaCell(m.sla_contact_pct, m.sla_contact_met, m.sla_contact_n)}
      ${slaCell(m.sla_update_pct, m.sla_update_met, m.sla_update_n, !hasGeneral)}
      ${slaCell(m.sla_report_general_pct, m.sla_report_general_met, m.sla_report_general_n, !hasGeneral)}
      ${slaCell(m.sla_report_rtc_pct, m.sla_report_rtc_met, m.sla_report_rtc_n, !hasRTC)}
    </tr>`;
  });

  // ── CASE TABLE ──
  const cbody = document.getElementById('caseTableBody');
  document.getElementById('caseCountBadge').textContent = CASES.length + ' Cases';
  // Per-case SLA badge — true → ✓, false → ✗, null → —. RTC clients have no Update SLA.
  const caseSla = (v, hide, proxy) => {
    if (hide) return '';
    if (v === true)  return `<td><span class="badge b-sla-met">✓</span>${proxy?' <span class="proxy-note" title="Report SLA measured from first-update date because statement date was not recorded">†</span>':''}</td>`;
    if (v === false) return `<td><span class="badge b-sla-notmet">✗</span>${proxy?' <span class="proxy-note" title="Report SLA measured from first-update date because statement date was not recorded">†</span>':''}</td>`;
    return '<td><span class="badge b-na">—</span></td>';
  };
  CASES.forEach(c => {
    const tc = (c.type||'').includes('Fraud')?'b-mf':(c.type||'').includes('Theft')?'b-mt':(c.type||'').includes('Surv')?'b-sv':'b-ll';
    const statusBadge = (c.status||'').toLowerCase().includes('paid') ? '<span class="badge b-yes">Paid</span>'
      : (c.status||'').toLowerCase().includes('invoic') ? '<span class="badge" style="background:rgba(184,134,11,0.15);color:#b8860b">Invoiced</span>'
      : `<span class="badge b-na">${c.status||'—'}</span>`;
    cbody.innerHTML += `<tr>
      <td style="font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:600">${c.ref||'—'}</td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted)">${c.client_ref||'—'}</td>
      <td><span class="badge ${tc}">${c.type||'—'}</span></td>
      <td>${c.created||'—'}</td>
      <td>${c.first_updated||'—'}</td>
      <td>${c.stmt_date||'—'}</td>
      <td>${c.report_sent||'—'}${c.report_proxy?' <span class="proxy-note">†</span>':''}</td>
      <td>${daysCell(c.days_creation_to_update, false)}</td>
      <td>${daysCell(c.days_stmt_to_report, c.report_proxy)}</td>
      <td>${c.invoice>0?'£'+c.invoice.toLocaleString():'—'}</td>
      ${caseSla(c.sla_ack, false, false)}
      ${caseSla(c.sla_contact, false, false)}
      ${caseSla(c.sla_update, !hasGeneral, false)}
      ${caseSla(c.sla_report, false, c.report_proxy)}
      <td>${statusBadge}</td>
    </tr>`;
  });

  document.getElementById('loadingScreen').style.display = 'none';
  document.getElementById('mainContent').style.display   = 'block';
}

function _dash(v){ return (v===null||v===undefined||v==="")?"":v; }
function _slaTxt(v){ return v===true?"Met":v===false?"Not met":"N/A"; }

async function downloadExcel(){
  const btn = document.getElementById('btnExcel');
  try {
    if (typeof ExcelJS === 'undefined') { alert('Excel library still loading — please try again in a moment.'); return; }
    if (typeof DLB_CLIENT_DATA === 'undefined') { alert('No data loaded yet.'); return; }
    if (btn) { btn.disabled = true; btn.textContent = 'Preparing…'; }
    const CLIENT = DLB_CLIENT_DATA;
    const M = CLIENT.monthly || [];
    const CASES = CLIENT.cases || [];

    // Palette (light & clean, dashboard-aligned)
    const NAVY='FF1F3A5F', BAND='FFF2F5FA', RTCFILL='FFEDE9FB', RTCTXT='FF4A3B8C',
          TOTFILL='FFE3EAF5', GREY='FF6B7280', BORDER='FFD7DDE6';
    const GBP='£#,##0', GBP2='£#,##0.00';
    const _round2 = n => Math.round(n*100)/100;
    const thin = () => ({ style:'thin', color:{argb:BORDER} });
    const borderAll = () => ({ top:thin(), left:thin(), bottom:thin(), right:thin() });
    const styleHeaderRow = row => {
      row.eachCell(c=>{
        c.fill={type:'pattern',pattern:'solid',fgColor:{argb:NAVY}};
        c.font={color:{argb:'FFFFFFFF'},bold:true,size:11};
        c.alignment={vertical:'middle',horizontal:'left',wrapText:true};
        c.border=borderAll();
      });
      row.height=26;
    };
    const pctV = p => (p===null||p===undefined)?'' : p/100;

    const wb = new ExcelJS.Workbook();
    wb.creator='DLB Investigations Ltd'; wb.created=new Date();

    // ---- SUMMARY ----
    const s = wb.addWorksheet('Summary', {views:[{showGridLines:false}]});
    s.columns=[{width:32},{width:20},{width:34}];
    s.mergeCells('A1:C1');
    s.getCell('A1').value='DLB Investigations Ltd — Management Information';
    s.getCell('A1').font={bold:true,size:15,color:{argb:'FFFFFFFF'}};
    s.getCell('A1').fill={type:'pattern',pattern:'solid',fgColor:{argb:NAVY}};
    s.getCell('A1').alignment={vertical:'middle',horizontal:'left',indent:1};
    s.getRow(1).height=34;
    let r=2;
    [['Client',CLIENT.client_name],['Period',CLIENT.report_period],['Data last updated',CLIENT.last_updated]].forEach(([k,v])=>{
      s.getCell('A'+r).value=k; s.getCell('A'+r).font={color:{argb:GREY},size:11};
      s.mergeCells('B'+r+':C'+r); s.getCell('B'+r).value=v; s.getCell('B'+r).font={bold:true,size:11};
      r++;
    });
    r++;
    const hdrRow=r; s.getRow(r).values=['Metric','Value','Detail']; styleHeaderRow(s.getRow(r)); r++;

    const rtcCases = CASES.filter(c=>c.is_rtc_case);
    const genCases = CASES.filter(c=>!c.is_rtc_case);
    const sumFees = arr => _round2(arr.reduce((a,c)=>a+(c.invoice||0),0));
    const avgPerCase = arr => arr.length?Math.round(sumFees(arr)/arr.length):0;
    const caseFeesTotal = M.reduce((a,m)=>a+(m.total_fees||0),0);
    const totalRev = CLIENT.total_invoiced_lineitems || caseFeesTotal;
    const totalCases = M.reduce((a,m)=>a+(m.case_count||0),0);

    const sumRows = [
      ['Total Revenue', totalRev, (CLIENT.total_lineitem_count||0)+' billed items', GBP],
      ['Total Cases', totalCases, M.filter(m=>m.case_count>0).length+' active months', null],
      ['Overall SLA Compliance', (CLIENT.sla_compliance_pct??0)/100, (CLIENT.sla_met||0)+' met / '+(CLIENT.sla_not_met||0)+' not met', '0%'],
      ['Avg Fee per RTC case', rtcCases.length?avgPerCase(rtcCases):'', rtcCases.length?rtcCases.length+' cases · total £'+sumFees(rtcCases).toLocaleString():'No RTC cases', GBP],
      ['Avg Fee per Other case', genCases.length?avgPerCase(genCases):'', genCases.length?genCases.length+' cases · total £'+sumFees(genCases).toLocaleString():'No other cases', GBP],
    ];
    sumRows.forEach((row,i)=>{
      const rr=s.getRow(r);
      rr.getCell(1).value=row[0]; rr.getCell(1).font={size:11};
      rr.getCell(2).value=row[1]; rr.getCell(2).font={bold:true,size:11}; if(row[3]) rr.getCell(2).numFmt=row[3];
      rr.getCell(2).alignment={horizontal:'right'};
      rr.getCell(3).value=row[2]; rr.getCell(3).font={color:{argb:GREY},size:10};
      [1,2,3].forEach(c=>{ rr.getCell(c).border=borderAll(); if(i%2) rr.getCell(c).fill={type:'pattern',pattern:'solid',fgColor:{argb:BAND}}; });
      r++;
    });
    s.views=[{state:'frozen', ySplit:hdrRow, showGridLines:false}];

    // ---- MONTHLY ----
    const mo = wb.addWorksheet('Monthly', {views:[{state:'frozen',ySplit:1,showGridLines:false}], pageSetup:{orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0}});
    const moHead=['Month','Cases','Total Fees','Avg Fee','Avg Create→Update (d)','Avg Stmt→Report (d)','Ack ≤4h','Contact ≤24h','Update ≤5d','Report ≤72h','Report RTC ≤48h'];
    mo.columns=moHead.map((h,i)=>({width:i===0?10:(h.length>14?15:13)}));
    styleHeaderRow(mo.addRow(moHead));
    M.forEach((m,i)=>{
      const rr=mo.addRow([m.month,m.case_count||0,m.total_fees||0,m.ave_fees||0,_dash(m.ave_days_creation_to_update),_dash(m.ave_days_stmt_to_report),pctV(m.sla_ack_pct),pctV(m.sla_contact_pct),pctV(m.sla_update_pct),pctV(m.sla_report_general_pct),pctV(m.sla_report_rtc_pct)]);
      rr.getCell(3).numFmt=GBP; rr.getCell(4).numFmt=GBP;
      rr.eachCell(c=>{ c.border=borderAll(); if(i%2) c.fill={type:'pattern',pattern:'solid',fgColor:{argb:BAND}}; });
      [7,8,9,10,11].forEach(ci=>{ const v=rr.getCell(ci).value; if(typeof v==='number'){ rr.getCell(ci).numFmt='0%'; rr.getCell(ci).font={bold:true,color:{argb:v>=0.8?'FF1E7A46':v>=0.5?'FF8A6D1B':'FFB23030'}}; } });
    });

    // ---- CASES ----
    const cs = wb.addWorksheet('Cases', {views:[{state:'frozen',ySplit:1,showGridLines:false}], pageSetup:{orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0}});
    const csHead=['Case Ref','Client Ref','Type','Created','First Updated','Stmt Date','Report Sent','Days Create→Update','Days Stmt→Report','Invoice','Ack','Contact','Update','Report','Report from first-update','Status'];
    cs.columns=[11,16,18,13,13,12,12,12,12,12,8,9,9,9,14,16].map(w=>({width:w}));
    styleHeaderRow(cs.addRow(csHead));
    if(!CASES.length){ const rr=cs.addRow(['No cases in this period']); cs.mergeCells(rr.number,1,rr.number,16); rr.getCell(1).font={italic:true,color:{argb:GREY}}; }
    CASES.forEach((c,i)=>{
      const rr=cs.addRow([_dash(c.ref),_dash(c.client_ref),_dash(c.type),_dash(c.created),_dash(c.first_updated),_dash(c.stmt_date),_dash(c.report_sent),_dash(c.days_creation_to_update),_dash(c.days_stmt_to_report),c.invoice||0,_slaTxt(c.sla_ack),_slaTxt(c.sla_contact),_slaTxt(c.sla_update),_slaTxt(c.sla_report),c.report_proxy?'Yes':'No',_dash(c.status)]);
      rr.getCell(10).numFmt=GBP2;
      rr.eachCell(c2=>{ c2.border=borderAll(); if(!c2.font) c2.font={size:10}; });
      const fill = c.is_rtc_case ? RTCFILL : (i%2?BAND:null);
      if(fill) rr.eachCell(c2=>c2.fill={type:'pattern',pattern:'solid',fgColor:{argb:fill}});
      if(c.is_rtc_case) rr.getCell(3).font={color:{argb:RTCTXT},bold:true,size:10};
      [11,12,13,14].forEach(ci=>{ const v=rr.getCell(ci).value; rr.getCell(ci).font = v==='Met'?{color:{argb:'FF1E7A46'},bold:true,size:10}:v==='Not met'?{color:{argb:'FFB23030'},bold:true,size:10}:{color:{argb:GREY},size:10}; });
    });

    // ---- REVENUE BY SERVICE (per-case) ----
    const rv = wb.addWorksheet('Revenue by Service', {views:[{state:'frozen',ySplit:1,showGridLines:false}]});
    rv.columns=[{width:30},{width:8},{width:13},{width:14},{width:17}];
    styleHeaderRow(rv.addRow(['Service / Type','RTC?','Case Count','Total (£)','Avg per case (£)']));
    const byType={};
    CASES.forEach(c=>{ const t=c.is_rtc_case?'RTC':(c.type||'Unknown'); (byType[t]=byType[t]||{type:t,is_rtc:!!c.is_rtc_case,count:0,total:0}); byType[t].count++; byType[t].total+=(c.invoice||0); });
    const groups=Object.values(byType).sort((a,b)=>b.total-a.total);
    if(!groups.length){ const rr=rv.addRow(['No cases in this period']); rv.mergeCells(rr.number,1,rr.number,5); rr.getCell(1).font={italic:true,color:{argb:GREY}}; }
    groups.forEach((g,i)=>{
      const rr=rv.addRow([g.type,g.is_rtc?'Yes':'No',g.count,_round2(g.total),g.count?Math.round(g.total/g.count):0]);
      rr.getCell(4).numFmt=GBP2; rr.getCell(5).numFmt=GBP;
      rr.eachCell(c=>c.border=borderAll());
      const fill=g.is_rtc?RTCFILL:(i%2?BAND:null);
      if(fill) rr.eachCell(c=>c.fill={type:'pattern',pattern:'solid',fgColor:{argb:fill}});
      if(g.is_rtc) rr.getCell(1).font={color:{argb:RTCTXT},bold:true};
    });
    if(groups.length){
      const cnt=groups.reduce((a,g)=>a+g.count,0), sm=_round2(groups.reduce((a,g)=>a+g.total,0));
      const tot=rv.addRow(['TOTAL','',cnt,sm,cnt?Math.round(sm/cnt):0]);
      tot.getCell(4).numFmt=GBP2; tot.getCell(5).numFmt=GBP;
      tot.eachCell(c=>{ c.border=borderAll(); c.font={bold:true}; c.fill={type:'pattern',pattern:'solid',fgColor:{argb:TOTFILL}}; });
    }

    // ---- write & download ----
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const safe=(CLIENT.client_name||'client').replace(/[^a-z0-9]+/gi,'_');
    const period=(CLIENT.report_period||'').replace(/[^a-z0-9]+/gi,'_');
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url; a.download='DLB_MI_'+safe+'_'+period+'.xlsx';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(()=>URL.revokeObjectURL(url), 1000);
  } catch(e){
    alert('Could not generate the Excel file: '+e.message);
    console.error(e);
  } finally {
    if (btn) { btn.disabled=false; btn.textContent='Download Excel'; }
  }
}

function downloadPDF(){ window.print(); }

document.getElementById('btnExcel').addEventListener('click', downloadExcel);
document.getElementById('btnPdf').addEventListener('click', downloadPDF);
document.getElementById('btnLogout').addEventListener('click', logout);

(async () => {
  const ok = await _resolveAuth();
  if (!ok) return;
  if (!/^clients\/[a-z0-9]+\.js$/.test(clientFile)) {
    alert('Unable to load data. Please try again.'); sessionStorage.clear();
    window.location.href = 'index.html'; return;
  }
  const script = document.createElement('script');
  script.src = clientFile + '?v=' + Date.now();
  script.onload = () => {
    if (typeof DLB_CLIENT_DATA !== 'undefined') renderDashboard(DLB_CLIENT_DATA);
    else alert('Error loading client data. Please contact your account manager.');
  };
  script.onerror = () => { alert('Unable to load data. Please try again.'); sessionStorage.clear(); window.location.href = 'index.html'; };
  document.head.appendChild(script);
})();
