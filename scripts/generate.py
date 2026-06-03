#!/usr/bin/env python3
"""
DLB MI Portal — client data generator.
Reads the TrackOps cases + invoice_details CSV exports and emits one
<client>.js file per client in the shape the dashboard expects
(var DLB_CLIENT_DATA = {...}).

Per-case revenue is derived by summing invoice line items linked via the
invoice CSV's 'Case' column, so per-case figures reconcile to invoiced totals.
"""
import pandas as pd, numpy as np, sys, re, json, datetime as dt

CASES_CSV = '/mnt/user-data/uploads/cases_2026-01-01_-_2026-05-31_1780490786.csv'
INV_CSV   = '/mnt/user-data/uploads/invoice_details_2026-01-01_-_2026-05-31_1780490814.csv'
PERIOD    = "Jan–May 2026"
LAST_UPD  = "31 May 2026"
MONTHS    = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

# SLA targets (days)
RTC_REPORT_TARGET = 2   # 48h
GEN_REPORT_TARGET = 3   # 72h
UPDATE_TARGET     = 5   # 5d

def parse_date(s):
    if pd.isna(s) or str(s).strip()=='' : return None
    for fmt in ('%Y-%m-%d','%d %b %Y','%d/%m/%Y'):
        try: return dt.datetime.strptime(str(s).strip()[:10], fmt).date()
        except ValueError: continue
    try: return pd.to_datetime(s).date()
    except Exception: return None

def fmt_date(d):
    if d is None: return ""
    return f"{d.day} {MONTHS[d.month-1]} {d.year}"

def days_between(a,b):
    da,db = parse_date(a), parse_date(b)
    if da is None or db is None: return None
    return (db-da).days

def is_rtc(case_type):
    return str(case_type).strip().upper()=='RTC' or 'RTC' in str(case_type).upper()

def safe_pct(met,n):
    return None if not n else round(met/n*100)

def build_client(name, cases_df, inv_df):
    cdf = cases_df[cases_df['Client']==name].copy()
    idf = inv_df[inv_df['Client']==name].copy()

    # OPTION 1: raw invoice file. Line-item totals include ALL client invoices in
    # the period (incl. invoices linked to cases created outside this export window
    # — e.g. cases opened in 2025 but invoiced in Jan–May 2026). Per-case revenue
    # comes from the cases CSV 'Invoice Total' column (legacy parity).
    # Per-case invoice sum kept for cross-check / fallback only.
    percase_total = idf.groupby('Case')['Total'].sum().to_dict()
    # Item-level breakdown (case-linked only)
    item_group = idf.groupby('Item').agg(count=('Total','size'), total=('Total','sum')).reset_index()
    fees_by_item = []
    for _,r in item_group.sort_values('total',ascending=False).iterrows():
        fees_by_item.append({
            'item': r['Item'], 'is_rtc': is_rtc_item(r['Item']),
            'count': int(r['count']), 'total': round(float(r['total']),2),
            'avg': round(float(r['total'])/r['count'],2) if r['count'] else 0
        })
    total_invoiced_lineitems = round(float(idf['Total'].sum()),2)
    total_lineitem_count = int(len(idf))

    def parse_money(v):
        if v is None or (isinstance(v,float) and np.isnan(v)): return 0.0
        s = re.sub(r'[^0-9.\-]', '', str(v))
        try: return float(s) if s else 0.0
        except ValueError: return 0.0

    cases_out=[]
    rtc_n=gen_n=0
    rtc_fees=gen_fees=0.0
    # SLA tallies
    sla_report_rtc_met=sla_report_rtc_n=0
    sla_report_gen_met=sla_report_gen_n=0
    sla_update_met=sla_update_n=0
    monthly = {m:dict(case_count=0,case_count_rtc=0,case_count_general=0,
                      total_fees=0.0,total_fees_rtc=0.0,total_fees_general=0.0,
                      cu_days=[],sr_days=[],sr_rtc_days=[],sr_gen_days=[],
                      rep_rtc_met=0,rep_rtc_n=0,rep_gen_met=0,rep_gen_n=0,upd_met=0,upd_n=0)
               for m in MONTHS}

    for _,r in cdf.iterrows():
        ref=str(r['Case Number'])
        ctype=str(r['Case Type']).strip()
        rtc=is_rtc(ctype)
        created=r['Date Created']; first_upd=r['Date client first updated?']
        stmt=r['Date statement obtained']; report=r['Date Report sent to client?']
        # per-case fee = cases CSV 'Invoice Total' column (legacy parity).
        # Falls back to line-item sum if column missing/blank.
        inv_amt = parse_money(r.get('Invoice Total'))
        if inv_amt == 0.0:
            fallback = percase_total.get(ref, None)
            if fallback is None and ref.isdigit():
                fallback = percase_total.get(int(ref), None)
            if fallback is not None:
                inv_amt = float(fallback)
        inv_amt = round(inv_amt, 2)

        d_cu = days_between(created, first_upd)
        d_sr = days_between(stmt, report)
        # report SLA: measured stmt->report; proxy from first_updated if no stmt date
        proxy=False
        d_sr_eff=d_sr
        if d_sr is None and parse_date(report) is not None and parse_date(first_upd) is not None:
            d_sr_eff=days_between(first_upd, report); proxy=True

        target = RTC_REPORT_TARGET if rtc else GEN_REPORT_TARGET
        sla_report = None
        if d_sr_eff is not None:
            sla_report = (d_sr_eff <= target)
        sla_update = None
        if not rtc and d_cu is not None:
            sla_update = (d_cu <= UPDATE_TARGET)

        cdate=parse_date(created)
        mon = MONTHS[cdate.month-1] if cdate else None

        cases_out.append(dict(
            ref=ref, client_ref=(None if pd.isna(r['Client Reference']) else str(r['Client Reference'])),
            type=ctype, status=str(r['Case Status']),
            created=fmt_date(parse_date(created)), first_updated=fmt_date(parse_date(first_upd)),
            stmt_date=fmt_date(parse_date(stmt)), report_sent=fmt_date(parse_date(report)),
            days_creation_to_update=d_cu, days_stmt_to_report=d_sr_eff,
            invoice=inv_amt, is_rtc_case=rtc,
            sla_ack=True, sla_contact=True,  # not in source data; matches legacy hardcode
            sla_update=sla_update, sla_report=sla_report, report_proxy=proxy,
            sla_report_target_days=target
        ))

        if rtc: rtc_n+=1; rtc_fees+=inv_amt
        else: gen_n+=1; gen_fees+=inv_amt
        if sla_report is not None:
            if rtc: sla_report_rtc_n+=1; sla_report_rtc_met+=int(sla_report)
            else: sla_report_gen_n+=1; sla_report_gen_met+=int(sla_report)
        if sla_update is not None:
            sla_update_n+=1; sla_update_met+=int(sla_update)

        if mon:
            mm=monthly[mon]; mm['case_count']+=1
            mm['case_count_rtc']+= int(rtc); mm['case_count_general']+= int(not rtc)
            mm['total_fees']+=inv_amt
            if rtc: mm['total_fees_rtc']+=inv_amt
            else:   mm['total_fees_general']+=inv_amt
            if d_cu is not None: mm['cu_days'].append(d_cu)
            if d_sr_eff is not None:
                mm['sr_days'].append(d_sr_eff)
                (mm['sr_rtc_days'] if rtc else mm['sr_gen_days']).append(d_sr_eff)
            if sla_report is not None:
                if rtc: mm['rep_rtc_n']+=1; mm['rep_rtc_met']+=int(sla_report)
                else: mm['rep_gen_n']+=1; mm['rep_gen_met']+=int(sla_report)
            if sla_update is not None:
                mm['upd_n']+=1; mm['upd_met']+=int(sla_update)

    # monthly rollup
    monthly_out=[]
    for i,m in enumerate(MONTHS):
        mm=monthly[m]
        cc=mm['case_count']
        avg=lambda L: round(sum(L)/len(L),1) if L else 0
        rep_rtc_pct = safe_pct(mm['rep_rtc_met'],mm['rep_rtc_n'])
        rep_gen_pct = safe_pct(mm['rep_gen_met'],mm['rep_gen_n'])
        upd_pct     = safe_pct(mm['upd_met'],mm['upd_n'])
        ack_pct = 100 if cc else None
        # overall monthly compliance = mean of all SLA components (ack, contact, update,
        # report-rtc, report-general) — matches legacy process-csv.js which averaged
        # every available pct, not just the report SLA.
        comp_parts=[p for p in [ack_pct,ack_pct,upd_pct,rep_rtc_pct,rep_gen_pct] if p is not None]
        comp = round(sum(comp_parts)/len(comp_parts)) if comp_parts else 0
        monthly_out.append(dict(
            month=m, month_num=i+1, case_count=cc,
            case_count_rtc=mm['case_count_rtc'], case_count_general=mm['case_count_general'],
            total_fees=round(mm['total_fees'],2), ave_fees=round(mm['total_fees']/cc) if cc else 0,
            total_fees_rtc=round(mm['total_fees_rtc'],2),
            total_fees_general=round(mm['total_fees_general'],2),
            ave_days_creation_to_update=avg(mm['cu_days']),
            ave_days_creation_to_update_general=avg(mm['cu_days']),
            ave_days_stmt_to_report=avg(mm['sr_days']),
            ave_days_stmt_to_report_rtc=avg(mm['sr_rtc_days']),
            ave_days_stmt_to_report_general=avg(mm['sr_gen_days']),
            sla_ack_pct=ack_pct, sla_ack_met=cc, sla_ack_n=cc,
            sla_contact_pct=ack_pct, sla_contact_met=cc, sla_contact_n=cc,
            sla_update_pct=upd_pct, sla_update_met=mm['upd_met'], sla_update_n=mm['upd_n'],
            sla_report_general_pct=rep_gen_pct, sla_report_general_met=mm['rep_gen_met'], sla_report_general_n=mm['rep_gen_n'],
            sla_report_rtc_pct=rep_rtc_pct, sla_report_rtc_met=mm['rep_rtc_met'], sla_report_rtc_n=mm['rep_rtc_n'],
            sla_compliance_pct=comp, sla_met=mm['rep_rtc_met']+mm['rep_gen_met'],
            sla_not_met=(mm['rep_rtc_n']-mm['rep_rtc_met'])+(mm['rep_gen_n']-mm['rep_gen_met'])
        ))

    total_cases=len(cases_out)
    sla_report_met = sla_report_rtc_met+sla_report_gen_met
    sla_report_n   = sla_report_rtc_n+sla_report_gen_n
    # Overall compliance = mean of all available SLA-component pcts (legacy parity).
    _ack    = 100 if total_cases else None
    _upd    = safe_pct(sla_update_met, sla_update_n)
    _rrtc   = safe_pct(sla_report_rtc_met, sla_report_rtc_n)
    _rgen   = safe_pct(sla_report_gen_met, sla_report_gen_n)
    _parts  = [p for p in [_ack, _ack, _upd, _rrtc, _rgen] if p is not None]
    overall_pct = round(sum(_parts)/len(_parts)) if _parts else 0

    # fees_by_type (per-case, RTC collapsed)
    bytype={}
    for c in cases_out:
        t = 'RTC' if c['is_rtc_case'] else c['type']
        bt=bytype.setdefault(t, dict(type=t,is_rtc=c['is_rtc_case'],case_count=0,total_fees=0.0))
        bt['case_count']+=1; bt['total_fees']+=c['invoice']
    fees_by_type=[]
    for t,bt in sorted(bytype.items(), key=lambda kv:-kv[1]['total_fees']):
        fees_by_type.append(dict(type=t,is_rtc=bt['is_rtc'],case_count=bt['case_count'],
            total_fees=round(bt['total_fees'],2),
            avg_fee=round(bt['total_fees']/bt['case_count'],2) if bt['case_count'] else 0))

    data=dict(
        client_name=DISPLAY.get(name,name), report_period=PERIOD, last_updated=LAST_UPD,
        is_rtc_client=(rtc_n>0), total_cases=total_cases,
        avg_days_creation_to_update=_avg([c['days_creation_to_update'] for c in cases_out]),
        avg_days_creation_to_update_general=_avg([c['days_creation_to_update'] for c in cases_out if not c['is_rtc_case']]),
        avg_days_stmt_to_report=_avg([c['days_stmt_to_report'] for c in cases_out]),
        avg_days_stmt_to_report_rtc=_avg([c['days_stmt_to_report'] for c in cases_out if c['is_rtc_case']]),
        avg_days_stmt_to_report_general=_avg([c['days_stmt_to_report'] for c in cases_out if not c['is_rtc_case']]),
        sla_ack_pct=(100 if total_cases else None), sla_contact_pct=(100 if total_cases else None),
        sla_update_pct=safe_pct(sla_update_met,sla_update_n),
        sla_report_general_pct=safe_pct(sla_report_gen_met,sla_report_gen_n),
        sla_report_rtc_pct=safe_pct(sla_report_rtc_met,sla_report_rtc_n),
        has_rtc_cases=(rtc_n>0), has_general_cases=(gen_n>0),
        sla_compliance_pct=overall_pct, sla_met=sla_report_met, sla_not_met=sla_report_n-sla_report_met,
        avg_fee_rtc=round(rtc_fees/rtc_n,2) if rtc_n else 0,
        avg_fee_general=round(gen_fees/gen_n,2) if gen_n else 0,
        total_fees_rtc=round(rtc_fees,2), total_fees_general=round(gen_fees,2),
        rtc_case_count=rtc_n, general_case_count=gen_n,
        fees_by_type=fees_by_type,
        total_invoiced_lineitems=total_invoiced_lineitems, total_lineitem_count=total_lineitem_count,
        fees_by_item=fees_by_item,
        monthly=monthly_out, cases=cases_out
    )
    return data

def _avg(L):
    L=[x for x in L if x is not None]
    return round(sum(L)/len(L),1) if L else 0

def is_rtc_item(item):
    return str(item).strip().upper()=='RTC'

# Map raw client name -> (filename, display name) ; only those requested
DISPLAY = {
    'Zego':'Zego',
    'Inshur':'Inshur',
    'First Central insurance & Technology Group':'First Central Insurance',
    'Trinity Claims Limited':'Trinity Claims',
    'Car Care Plan':'Car Care Plan',
    'DWF LLP':'DWF LLP',
    'And-E':'And-E',
    'Transportation Claims Ltd':'Transportation Claims',
}
FILENAME = {
    'Zego':'zego.js','Inshur':'inshur.js',
    'First Central insurance & Technology Group':'firstcentral.js',
    'Trinity Claims Limited':'trinity.js','Car Care Plan':'carcareplan.js',
    'DWF LLP':'dwf.js','And-E':'ande.js','Transportation Claims Ltd':'transport.js',
}

def to_js(data, raw_name):
    header=(f"// ============================================================\n"
            f"// DLB Investigations Ltd — MI Portal Client Data\n"
            f"// Client:  {data['client_name']}\n"
            f"// File:    {FILENAME[raw_name]}\n"
            f"// Period:  {data['report_period']}\n"
            f"// Updated: {data['last_updated']}\n"
            f"// GENERATED AUTOMATICALLY FROM TrackOps CSV — DO NOT EDIT MANUALLY\n"
            f"// ============================================================\n\n")
    body="var DLB_CLIENT_DATA = " + json.dumps(data, indent=2, ensure_ascii=False) + ";\n"
    # JSON null -> JS null is fine; JSON true/false fine. Keep as-is.
    return header+body

if __name__=='__main__':
    cases=pd.read_csv(CASES_CSV); inv=pd.read_csv(INV_CSV)
    targets = sys.argv[1:] if len(sys.argv)>1 else list(FILENAME.keys())
    for raw in targets:
        d=build_client(raw, cases, inv)
        js=to_js(d, raw)
        out='gen/'+FILENAME[raw]
        import os; os.makedirs('gen',exist_ok=True)
        open(out,'w').write(js)
        print(f"{d['client_name']:28s} cases={d['total_cases']:3d} rtc={d['rtc_case_count']:3d} "
              f"inv£{d['total_invoiced_lineitems']:>10,.2f} percaseSLA={d['sla_compliance_pct']}% -> {out}")
