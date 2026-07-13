const ADMIN_CODE = 'DLBVIP26';

const CLIENT_FILES = [
  'clients/zego.js',
  'clients/inshur.js',
  'clients/firstcentral.js',
  'clients/trinity.js',
  'clients/dwf.js',
  'clients/carcareplan.js',
  'clients/ande.js',
  'clients/transportation.js',
  'clients/collingwood.js',
  'clients/action365.js',
  'clients/jpsolicitors.js',
  'clients/keoghs.js',
  'clients/weightmans.js',
  'clients/zebra.js',
  'clients/directcommercial.js',
  'clients/keyclaims.js',
  'clients/msg.js',
  'clients/mulsanne.js',
  'clients/rostella.js',
  'clients/xsd.js',
];

function login(){
  const v = document.getElementById('pw').value.trim().toUpperCase();
  if (v === ADMIN_CODE){
    sessionStorage.setItem('dlb_admin_all','1');
    showOverview();
  } else {
    document.getElementById('err').style.display = 'block';
  }
}
function logout(){
  sessionStorage.removeItem('dlb_admin_all');
  location.reload();
}
function showOverview(){
  document.getElementById('loginGate').style.display = 'none';
  document.getElementById('content').style.display = 'block';
  loadAll();
}

document.getElementById('btnAdminLogin').addEventListener('click', login);
document.getElementById('btnAdminLogout').addEventListener('click', logout);
document.getElementById('pw').addEventListener('keydown', e => { if(e.key==='Enter') login(); });
if (sessionStorage.getItem('dlb_admin_all') === '1') showOverview();

async function loadAll(){
  const clients = [];
  for (const f of CLIENT_FILES){
    try{
      const r = await fetch(f + '?cb=' + Date.now());
      if (!r.ok) continue;
      const txt = await r.text();
      const m = txt.match(/var\s+DLB_CLIENT_DATA\s*=\s*([\s\S]+?);\s*$/);
      if (!m) continue;
      const data = JSON.parse(m[1]);
      data.__file = f.replace('clients/','');
      clients.push(data);
    } catch(e){ console.warn('skip',f,e.message); }
  }
  render(clients);
}

const fmtMoney = v => '£' + (v||0).toLocaleString('en-GB', {maximumFractionDigits:0});
const slaBadge = pct => {
  if (pct === null || pct === undefined) return '<span class="badge b-grey">—</span>';
  const cls = pct >= 80 ? 'b-green' : pct >= 50 ? 'b-amber' : 'b-red';
  return `<span class="badge ${cls}">${pct}%</span>`;
};

let _sortKey = 'rev';
let _sortDir = -1; // -1 desc
let _clientsCache = [];

function render(clients){
  _clientsCache = clients.filter(c => (c.total_cases||0) > 0);
  // Pull period/last-updated from the first client with data
  if (_clientsCache.length){
    document.getElementById('periodLine').textContent = 'Consolidated · ' + (_clientsCache[0].report_period || 'Jan–May 2026');
    document.getElementById('updatedPill').textContent = 'Updated ' + (_clientsCache[0].last_updated || '—');
  }
  buildKpis(_clientsCache);
  renderTable();
  renderMonthly(_clientsCache);
  renderSlaChart(_clientsCache);
  renderRevChart(_clientsCache);
}

function buildKpis(clients){
  const totalCases = clients.reduce((s,c)=>s+(c.total_cases||0),0);
  const totalRtcCases = clients.reduce((s,c)=>s+(c.rtc_case_count||0),0);
  const totalGenCases = clients.reduce((s,c)=>s+(c.general_case_count||0),0);
  const perCaseRev = clients.reduce((s,c)=>s+((c.total_fees_rtc||0)+(c.total_fees_general||0)),0);
  const lineRev = clients.reduce((s,c)=>s+(c.total_invoiced_lineitems||0),0);
  // Weighted SLA by case count
  let slaW = 0, slaN = 0;
  for (const c of clients){
    if (c.sla_compliance_pct !== null && c.sla_compliance_pct !== undefined){
      slaW += (c.sla_compliance_pct||0) * (c.total_cases||0);
      slaN += (c.total_cases||0);
    }
  }
  const wSla = slaN ? Math.round(slaW/slaN) : 0;
  const activeClients = clients.length;

  const slaCls = wSla >= 80 ? 'green' : wSla >= 50 ? 'amber' : '';
  const html = `
    <div class="kpi"><div class="label">Active Clients</div><div class="value">${activeClients}</div><div class="sub">with cases in period</div></div>
    <div class="kpi"><div class="label">Total Cases</div><div class="value">${totalCases.toLocaleString()}</div><div class="sub">${totalGenCases} General · ${totalRtcCases} RTC</div></div>
    <div class="kpi rtc"><div class="label">RTC Cases</div><div class="value">${totalRtcCases.toLocaleString()}</div><div class="sub">${totalCases? Math.round(totalRtcCases/totalCases*100):0}% of total</div></div>
    <div class="kpi"><div class="label">Per-case Revenue</div><div class="value">${fmtMoney(perCaseRev)}</div><div class="sub">from cases CSV</div></div>
    <div class="kpi"><div class="label">Line-item Revenue</div><div class="value">${fmtMoney(lineRev)}</div><div class="sub">from invoice details</div></div>
    <div class="kpi ${slaCls}"><div class="label">Weighted SLA %</div><div class="value">${wSla}%</div><div class="sub">case-count weighted</div></div>
  `;
  document.getElementById('kpiRow').innerHTML = html;
}

function renderTable(){
  const rows = _clientsCache.map(c => {
    const perCase = (c.total_fees_rtc||0)+(c.total_fees_general||0);
    const avgFee = c.total_cases ? perCase/c.total_cases : 0;
    return {
      raw: c,
      name: c.client_name || c.__file,
      cases: c.total_cases || 0,
      rtc: c.rtc_case_count || 0,
      general: c.general_case_count || 0,
      rev: perCase,
      lineitems: c.total_invoiced_lineitems || 0,
      avgfee: avgFee,
      sla: c.sla_compliance_pct ?? null,
      updated: c.last_updated || '',
    };
  });
  rows.sort((a,b) => {
    const av = a[_sortKey], bv = b[_sortKey];
    if (typeof av === 'string') return _sortDir * av.localeCompare(bv);
    if (av === null) return 1; if (bv === null) return -1;
    return _sortDir * (av - bv);
  });

  const body = rows.map(r => `
    <tr>
      <td>${r.name}</td>
      <td class="r">${r.cases.toLocaleString()}</td>
      <td class="r">${r.rtc ? `<span class="badge b-rtc">${r.rtc}</span>` : '—'}</td>
      <td class="r">${r.general || '—'}</td>
      <td class="r">${fmtMoney(r.rev)}</td>
      <td class="r">${fmtMoney(r.lineitems)}</td>
      <td class="r">${fmtMoney(r.avgfee)}</td>
      <td class="r">${slaBadge(r.sla)}</td>
      <td>${r.updated}</td>
    </tr>
  `).join('');
  document.getElementById('clientRows').innerHTML = body;

  // Totals row
  const T = rows.reduce((a,r)=>({cases:a.cases+r.cases, rtc:a.rtc+r.rtc, general:a.general+r.general, rev:a.rev+r.rev, lineitems:a.lineitems+r.lineitems}),
                       {cases:0,rtc:0,general:0,rev:0,lineitems:0});
  const slaW = rows.reduce((s,r)=> r.sla!==null ? s+r.sla*r.cases : s, 0);
  const slaN = rows.reduce((s,r)=> r.sla!==null ? s+r.cases : s, 0);
  const wSla = slaN ? Math.round(slaW/slaN) : 0;
  document.getElementById('clientFoot').innerHTML = `
    <tr>
      <td>Total (${rows.length} clients)</td>
      <td class="r">${T.cases.toLocaleString()}</td>
      <td class="r">${T.rtc}</td>
      <td class="r">${T.general}</td>
      <td class="r">${fmtMoney(T.rev)}</td>
      <td class="r">${fmtMoney(T.lineitems)}</td>
      <td class="r">${fmtMoney(T.cases ? T.rev/T.cases : 0)}</td>
      <td class="r">${slaBadge(wSla)} <span style="color:var(--muted);font-size:10px;margin-left:4px">weighted</span></td>
      <td></td>
    </tr>
  `;
}

document.querySelectorAll('#clientTable thead th').forEach(th => {
  th.addEventListener('click', () => {
    const k = th.dataset.sort;
    if (_sortKey === k) _sortDir = -_sortDir;
    else { _sortKey = k; _sortDir = (k === 'name' || k === 'updated') ? 1 : -1; }
    renderTable();
  });
});

let _charts = {};
function destroyChart(id){ if (_charts[id]) { _charts[id].destroy(); _charts[id] = null; } }

function renderMonthly(clients){
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const sums = months.map(() => ({cases:0, rev:0, slaW:0, slaN:0}));
  for (const c of clients){
    for (const m of (c.monthly || [])){
      const i = months.indexOf(m.month);
      if (i < 0) continue;
      sums[i].cases += m.case_count || 0;
      sums[i].rev += m.total_fees || 0;
      if (m.sla_compliance_pct !== null && m.sla_compliance_pct !== undefined && m.case_count){
        sums[i].slaW += (m.sla_compliance_pct||0) * (m.case_count||0);
        sums[i].slaN += (m.case_count||0);
      }
    }
  }
  // Trim to first non-zero through last non-zero
  let first=0,last=11;
  while (first < 12 && !sums[first].cases) first++;
  while (last > first && !sums[last].cases) last--;
  const labels = months.slice(first, last+1);
  const cases  = sums.slice(first, last+1).map(s=>s.cases);
  const rev    = sums.slice(first, last+1).map(s=>Math.round(s.rev));
  const sla    = sums.slice(first, last+1).map(s=>s.slaN ? Math.round(s.slaW/s.slaN) : null);

  destroyChart('monthChart');
  _charts.monthChart = new Chart(document.getElementById('monthChart'), {
    data: {
      labels,
      datasets: [
        { type:'bar', label:'Cases', data:cases, backgroundColor:'rgba(74,127,193,0.5)', borderColor:'#4a7fc1', borderWidth:1, yAxisID:'y' },
        { type:'line', label:'Weighted SLA %', data:sla, borderColor:'#5a9e7c', backgroundColor:'#5a9e7c', tension:0.3, yAxisID:'y1', borderWidth:2, pointRadius:3 },
      ]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{labels:{color:'#8a95a3'}} },
      scales:{
        x:{ ticks:{color:'#8a95a3'}, grid:{color:'rgba(255,255,255,0.04)'} },
        y:{ ticks:{color:'#8a95a3'}, grid:{color:'rgba(255,255,255,0.04)'}, title:{display:true,text:'Cases',color:'#8a95a3'} },
        y1:{ position:'right', min:0, max:100, ticks:{color:'#5a9e7c', callback:v=>v+'%'}, grid:{drawOnChartArea:false}, title:{display:true,text:'SLA %',color:'#5a9e7c'} },
      }
    }
  });
}

function renderSlaChart(clients){
  const sorted = clients.filter(c=> (c.total_cases||0)>0 && c.sla_compliance_pct !== null && c.sla_compliance_pct !== undefined)
                        .sort((a,b)=> (b.sla_compliance_pct||0) - (a.sla_compliance_pct||0));
  const labels = sorted.map(c=>c.client_name);
  const data = sorted.map(c=>c.sla_compliance_pct||0);
  const colors = data.map(v => v>=80 ? '#5a9e7c' : v>=50 ? '#b8860b' : '#c0392b');
  destroyChart('slaChart');
  _charts.slaChart = new Chart(document.getElementById('slaChart'), {
    type:'bar',
    data:{ labels, datasets:[{ data, backgroundColor:colors }] },
    options:{
      responsive:true, maintainAspectRatio:false, indexAxis:'y',
      plugins:{ legend:{display:false}, tooltip:{callbacks:{label:ctx=>ctx.parsed.x+'%'}} },
      scales:{ x:{ min:0, max:100, ticks:{color:'#8a95a3',callback:v=>v+'%'}, grid:{color:'rgba(255,255,255,0.04)'} }, y:{ ticks:{color:'#e8ecf0'}, grid:{display:false} } }
    }
  });
}

function renderRevChart(clients){
  const sorted = clients.map(c => ({
    name: c.client_name,
    rtc: c.total_fees_rtc || 0,
    gen: c.total_fees_general || 0,
    total: (c.total_fees_rtc||0)+(c.total_fees_general||0)
  })).sort((a,b)=> b.total - a.total).slice(0, 12);

  destroyChart('revChart');
  _charts.revChart = new Chart(document.getElementById('revChart'), {
    type:'bar',
    data:{
      labels: sorted.map(s=>s.name),
      datasets: [
        { label:'General', data: sorted.map(s=>s.gen), backgroundColor:'#4a7fc1' },
        { label:'RTC',     data: sorted.map(s=>s.rtc), backgroundColor:'#7c3aed' },
      ]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{labels:{color:'#8a95a3'}}, tooltip:{callbacks:{label:ctx=>ctx.dataset.label+': £'+ctx.parsed.y.toLocaleString()}} },
      scales:{
        x:{ stacked:true, ticks:{color:'#8a95a3'}, grid:{display:false} },
        y:{ stacked:true, ticks:{color:'#8a95a3',callback:v=>'£'+v.toLocaleString()}, grid:{color:'rgba(255,255,255,0.04)'} }
      }
    }
  });
}
