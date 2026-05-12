// ============================================================
// DLB Investigations Ltd — MI Portal Client Data
// Client:  First Central Insurance
// File:    firstcentral.js
// Period:  Jan–Dec 2026
// Updated: 12 May 2026
// GENERATED AUTOMATICALLY — DO NOT EDIT MANUALLY
// ============================================================

var DLB_CLIENT_DATA = {

  client_name:                  "First Central Insurance",
  report_period:                "Jan–Dec 2026",
  last_updated:                 "12 May 2026",
  is_rtc_client:                true,
  total_cases:                  29,

  avg_days_creation_to_update:         0.9,
  avg_days_creation_to_update_general: 1,
  avg_days_stmt_to_report:             5.2,
  avg_days_stmt_to_report_rtc:         1.2,
  avg_days_stmt_to_report_general:     13.2,

  sla_ack_pct:                  100,
  sla_contact_pct:              100,
  sla_update_pct:               100,
  sla_report_general_pct:       0,
  sla_report_rtc_pct:           83,
  has_rtc_cases:                true,
  has_general_cases:            true,
  sla_compliance_pct:           89,
  sla_met:                      10,
  sla_not_met:                  8,

  avg_fee_rtc:                  155.65,
  avg_fee_general:              435,
  total_fees_rtc:               2646,
  total_fees_general:           5220,
  rtc_case_count:               17,
  general_case_count:           12,
  fees_by_type: [
    { type:"Motor Fraud", is_rtc:false, case_count:10, total_fees:4080, avg_fee:408 },
    { type:"RTC", is_rtc:true, case_count:17, total_fees:2646, avg_fee:155.65 },
    { type:"Motor Theft", is_rtc:false, case_count:2, total_fees:1140, avg_fee:570 }
  ],

  // Line-item-driven revenue (from TrackOps invoice details export)
  total_invoiced_lineitems:     8125,
  total_lineitem_count:         39,
  fees_by_item: [
    { item:"Stage 1 Investigation", is_rtc:false, count:7, total:3100, avg:442.86 },
    { item:"RTC", is_rtc:true, count:15, total:2205, avg:147 },
    { item:"Motor Theft Investigation", is_rtc:false, count:2, total:950, avg:475 },
    { item:"Cold Calls", is_rtc:false, count:7, total:780, avg:111.43 },
    { item:"Interpreter (1/2 day)", is_rtc:false, count:3, total:460, avg:153.33 },
    { item:"Stage 2 Investigation", is_rtc:false, count:2, total:400, avg:200 },
    { item:"Failed Appointment", is_rtc:false, count:2, total:170, avg:85 },
    { item:"Miscellanoeus", is_rtc:false, count:1, total:60, avg:60 }
  ],

  monthly: [
    { month:"Jan", month_num:1, case_count:1, case_count_rtc:0, case_count_general:1, total_fees:144, ave_fees:144, total_fees_rtc:0, total_fees_general:144, ave_days_creation_to_update:0, ave_days_creation_to_update_general:0, ave_days_stmt_to_report:0, ave_days_stmt_to_report_rtc:0, ave_days_stmt_to_report_general:0, sla_ack_pct:null, sla_ack_met:0, sla_ack_n:0, sla_contact_pct:null, sla_contact_met:0, sla_contact_n:0, sla_update_pct:null, sla_update_met:0, sla_update_n:0, sla_report_general_pct:null, sla_report_general_met:0, sla_report_general_n:0, sla_report_rtc_pct:null, sla_report_rtc_met:0, sla_report_rtc_n:0, sla_compliance_pct:0, sla_met:0, sla_not_met:0 },
    { month:"Feb", month_num:2, case_count:7, case_count_rtc:0, case_count_general:7, total_fees:3864, ave_fees:552, total_fees_rtc:0, total_fees_general:3864, ave_days_creation_to_update:1.3, ave_days_creation_to_update_general:1.3, ave_days_stmt_to_report:15, ave_days_stmt_to_report_rtc:0, ave_days_stmt_to_report_general:15, sla_ack_pct:100, sla_ack_met:6, sla_ack_n:6, sla_contact_pct:100, sla_contact_met:6, sla_contact_n:6, sla_update_pct:100, sla_update_met:6, sla_update_n:6, sla_report_general_pct:0, sla_report_general_met:0, sla_report_general_n:4, sla_report_rtc_pct:null, sla_report_rtc_met:0, sla_report_rtc_n:0, sla_compliance_pct:82, sla_met:0, sla_not_met:4 },
    { month:"Mar", month_num:3, case_count:1, case_count_rtc:0, case_count_general:1, total_fees:72, ave_fees:72, total_fees_rtc:0, total_fees_general:72, ave_days_creation_to_update:0, ave_days_creation_to_update_general:0, ave_days_stmt_to_report:0, ave_days_stmt_to_report_rtc:0, ave_days_stmt_to_report_general:0, sla_ack_pct:null, sla_ack_met:0, sla_ack_n:0, sla_contact_pct:null, sla_contact_met:0, sla_contact_n:0, sla_update_pct:null, sla_update_met:0, sla_update_n:0, sla_report_general_pct:null, sla_report_general_met:0, sla_report_general_n:0, sla_report_rtc_pct:null, sla_report_rtc_met:0, sla_report_rtc_n:0, sla_compliance_pct:0, sla_met:0, sla_not_met:0 },
    { month:"Apr", month_num:4, case_count:20, case_count_rtc:17, case_count_general:3, total_fees:3786, ave_fees:189.3, total_fees_rtc:2646, total_fees_general:1140, ave_days_creation_to_update:0.8, ave_days_creation_to_update_general:0, ave_days_stmt_to_report:2.4, ave_days_stmt_to_report_rtc:1.2, ave_days_stmt_to_report_general:9.5, sla_ack_pct:100, sla_ack_met:18, sla_ack_n:18, sla_contact_pct:100, sla_contact_met:18, sla_contact_n:18, sla_update_pct:100, sla_update_met:2, sla_update_n:2, sla_report_general_pct:0, sla_report_general_met:0, sla_report_general_n:2, sla_report_rtc_pct:83, sla_report_rtc_met:10, sla_report_rtc_n:12, sla_compliance_pct:92, sla_met:10, sla_not_met:4 },
    { month:"May", month_num:5, case_count:0, case_count_rtc:0, case_count_general:0, total_fees:0, ave_fees:0, total_fees_rtc:0, total_fees_general:0, ave_days_creation_to_update:0, ave_days_creation_to_update_general:0, ave_days_stmt_to_report:0, ave_days_stmt_to_report_rtc:0, ave_days_stmt_to_report_general:0, sla_ack_pct:null, sla_ack_met:0, sla_ack_n:0, sla_contact_pct:null, sla_contact_met:0, sla_contact_n:0, sla_update_pct:null, sla_update_met:0, sla_update_n:0, sla_report_general_pct:null, sla_report_general_met:0, sla_report_general_n:0, sla_report_rtc_pct:null, sla_report_rtc_met:0, sla_report_rtc_n:0, sla_compliance_pct:0, sla_met:0, sla_not_met:0 },
    { month:"Jun", month_num:6, case_count:0, case_count_rtc:0, case_count_general:0, total_fees:0, ave_fees:0, total_fees_rtc:0, total_fees_general:0, ave_days_creation_to_update:0, ave_days_creation_to_update_general:0, ave_days_stmt_to_report:0, ave_days_stmt_to_report_rtc:0, ave_days_stmt_to_report_general:0, sla_ack_pct:null, sla_ack_met:0, sla_ack_n:0, sla_contact_pct:null, sla_contact_met:0, sla_contact_n:0, sla_update_pct:null, sla_update_met:0, sla_update_n:0, sla_report_general_pct:null, sla_report_general_met:0, sla_report_general_n:0, sla_report_rtc_pct:null, sla_report_rtc_met:0, sla_report_rtc_n:0, sla_compliance_pct:0, sla_met:0, sla_not_met:0 },
    { month:"Jul", month_num:7, case_count:0, case_count_rtc:0, case_count_general:0, total_fees:0, ave_fees:0, total_fees_rtc:0, total_fees_general:0, ave_days_creation_to_update:0, ave_days_creation_to_update_general:0, ave_days_stmt_to_report:0, ave_days_stmt_to_report_rtc:0, ave_days_stmt_to_report_general:0, sla_ack_pct:null, sla_ack_met:0, sla_ack_n:0, sla_contact_pct:null, sla_contact_met:0, sla_contact_n:0, sla_update_pct:null, sla_update_met:0, sla_update_n:0, sla_report_general_pct:null, sla_report_general_met:0, sla_report_general_n:0, sla_report_rtc_pct:null, sla_report_rtc_met:0, sla_report_rtc_n:0, sla_compliance_pct:0, sla_met:0, sla_not_met:0 },
    { month:"Aug", month_num:8, case_count:0, case_count_rtc:0, case_count_general:0, total_fees:0, ave_fees:0, total_fees_rtc:0, total_fees_general:0, ave_days_creation_to_update:0, ave_days_creation_to_update_general:0, ave_days_stmt_to_report:0, ave_days_stmt_to_report_rtc:0, ave_days_stmt_to_report_general:0, sla_ack_pct:null, sla_ack_met:0, sla_ack_n:0, sla_contact_pct:null, sla_contact_met:0, sla_contact_n:0, sla_update_pct:null, sla_update_met:0, sla_update_n:0, sla_report_general_pct:null, sla_report_general_met:0, sla_report_general_n:0, sla_report_rtc_pct:null, sla_report_rtc_met:0, sla_report_rtc_n:0, sla_compliance_pct:0, sla_met:0, sla_not_met:0 },
    { month:"Sep", month_num:9, case_count:0, case_count_rtc:0, case_count_general:0, total_fees:0, ave_fees:0, total_fees_rtc:0, total_fees_general:0, ave_days_creation_to_update:0, ave_days_creation_to_update_general:0, ave_days_stmt_to_report:0, ave_days_stmt_to_report_rtc:0, ave_days_stmt_to_report_general:0, sla_ack_pct:null, sla_ack_met:0, sla_ack_n:0, sla_contact_pct:null, sla_contact_met:0, sla_contact_n:0, sla_update_pct:null, sla_update_met:0, sla_update_n:0, sla_report_general_pct:null, sla_report_general_met:0, sla_report_general_n:0, sla_report_rtc_pct:null, sla_report_rtc_met:0, sla_report_rtc_n:0, sla_compliance_pct:0, sla_met:0, sla_not_met:0 },
    { month:"Oct", month_num:10, case_count:0, case_count_rtc:0, case_count_general:0, total_fees:0, ave_fees:0, total_fees_rtc:0, total_fees_general:0, ave_days_creation_to_update:0, ave_days_creation_to_update_general:0, ave_days_stmt_to_report:0, ave_days_stmt_to_report_rtc:0, ave_days_stmt_to_report_general:0, sla_ack_pct:null, sla_ack_met:0, sla_ack_n:0, sla_contact_pct:null, sla_contact_met:0, sla_contact_n:0, sla_update_pct:null, sla_update_met:0, sla_update_n:0, sla_report_general_pct:null, sla_report_general_met:0, sla_report_general_n:0, sla_report_rtc_pct:null, sla_report_rtc_met:0, sla_report_rtc_n:0, sla_compliance_pct:0, sla_met:0, sla_not_met:0 },
    { month:"Nov", month_num:11, case_count:0, case_count_rtc:0, case_count_general:0, total_fees:0, ave_fees:0, total_fees_rtc:0, total_fees_general:0, ave_days_creation_to_update:0, ave_days_creation_to_update_general:0, ave_days_stmt_to_report:0, ave_days_stmt_to_report_rtc:0, ave_days_stmt_to_report_general:0, sla_ack_pct:null, sla_ack_met:0, sla_ack_n:0, sla_contact_pct:null, sla_contact_met:0, sla_contact_n:0, sla_update_pct:null, sla_update_met:0, sla_update_n:0, sla_report_general_pct:null, sla_report_general_met:0, sla_report_general_n:0, sla_report_rtc_pct:null, sla_report_rtc_met:0, sla_report_rtc_n:0, sla_compliance_pct:0, sla_met:0, sla_not_met:0 },
    { month:"Dec", month_num:12, case_count:0, case_count_rtc:0, case_count_general:0, total_fees:0, ave_fees:0, total_fees_rtc:0, total_fees_general:0, ave_days_creation_to_update:0, ave_days_creation_to_update_general:0, ave_days_stmt_to_report:0, ave_days_stmt_to_report_rtc:0, ave_days_stmt_to_report_general:0, sla_ack_pct:null, sla_ack_met:0, sla_ack_n:0, sla_contact_pct:null, sla_contact_met:0, sla_contact_n:0, sla_update_pct:null, sla_update_met:0, sla_update_n:0, sla_report_general_pct:null, sla_report_general_met:0, sla_report_general_n:0, sla_report_rtc_pct:null, sla_report_rtc_met:0, sla_report_rtc_n:0, sla_compliance_pct:0, sla_met:0, sla_not_met:0 }
  ],

  cases: [
    { ref:"1132601", client_ref:"FC/901468570", type:"Motor Fraud", status:"Invoice Paid", created:"21 Jan 2026", first_updated:"1 Sep 2025", stmt_date:"", report_sent:"", days_creation_to_update:null, days_stmt_to_report:null, invoice:144, is_rtc_case:false, sla_ack:null, sla_contact:null, sla_update:null, sla_report:null, report_proxy:false, sla_report_target_days:3 },
    { ref:"1136602", client_ref:"FC/901514109", type:"Motor Fraud", status:"Invoice Paid", created:"10 Feb 2026", first_updated:"10 Feb 2026", stmt_date:"15 Feb 2026", report_sent:"19 Feb 2026", days_creation_to_update:0, days_stmt_to_report:4, invoice:1056, is_rtc_case:false, sla_ack:true, sla_contact:true, sla_update:true, sla_report:false, report_proxy:false, sla_report_target_days:3 },
    { ref:"1137202", client_ref:"FC/901500992", type:"Motor Fraud", status:"Enquiries ongoing", created:"11 Feb 2026", first_updated:"15 Feb 2026", stmt_date:"", report_sent:"", days_creation_to_update:4, days_stmt_to_report:null, invoice:0, is_rtc_case:false, sla_ack:true, sla_contact:true, sla_update:true, sla_report:null, report_proxy:false, sla_report_target_days:3 },
    { ref:"1137402", client_ref:"FC/901474836", type:"Motor Fraud", status:"Invoice Paid", created:"12 Feb 2026", first_updated:"15 Feb 2026", stmt_date:"24 Feb 2026", report_sent:"25 Mar 2026", days_creation_to_update:3, days_stmt_to_report:29, invoice:912, is_rtc_case:false, sla_ack:true, sla_contact:true, sla_update:true, sla_report:false, report_proxy:false, sla_report_target_days:3 },
    { ref:"1137502", client_ref:"FC/901486653", type:"Motor Fraud", status:"Invoice Paid", created:"12 Feb 2026", first_updated:"12 Feb 2026", stmt_date:"", report_sent:"", days_creation_to_update:0, days_stmt_to_report:null, invoice:672, is_rtc_case:false, sla_ack:true, sla_contact:true, sla_update:true, sla_report:null, report_proxy:false, sla_report_target_days:3 },
    { ref:"1139602", client_ref:"FC/901522926", type:"Motor Fraud", status:"Invoice Paid", created:"19 Feb 2026", first_updated:"20 Feb 2026", stmt_date:"6 Mar 2026", report_sent:"11 Mar 2026", days_creation_to_update:1, days_stmt_to_report:5, invoice:408, is_rtc_case:false, sla_ack:true, sla_contact:true, sla_update:true, sla_report:false, report_proxy:false, sla_report_target_days:3 },
    { ref:"1141002", client_ref:"FC/901535625", type:"Motor Fraud", status:"Invoice Paid", created:"25 Feb 2026", first_updated:"25 Feb 2026", stmt_date:"4 Mar 2026", report_sent:"26 Mar 2026", days_creation_to_update:0, days_stmt_to_report:22, invoice:816, is_rtc_case:false, sla_ack:true, sla_contact:true, sla_update:true, sla_report:false, report_proxy:false, sla_report_target_days:3 },
    { ref:"1141202", client_ref:"FC/901515505", type:"Motor Fraud", status:"Invoice Paid", created:"26 Feb 2026", first_updated:"", stmt_date:"", report_sent:"", days_creation_to_update:null, days_stmt_to_report:null, invoice:0, is_rtc_case:false, sla_ack:null, sla_contact:null, sla_update:null, sla_report:null, report_proxy:false, sla_report_target_days:3 },
    { ref:"1145003", client_ref:"FC/901473263", type:"Motor Fraud", status:"PH unresponsive", created:"13 Mar 2026", first_updated:"", stmt_date:"", report_sent:"", days_creation_to_update:null, days_stmt_to_report:null, invoice:72, is_rtc_case:false, sla_ack:null, sla_contact:null, sla_update:null, sla_report:null, report_proxy:false, sla_report_target_days:3 },
    { ref:"1149604", client_ref:"FC/901566941", type:"Motor Theft", status:"Invoice Paid", created:"1 Apr 2026", first_updated:"1 Apr 2026", stmt_date:"8 Apr 2026", report_sent:"16 Apr 2026", days_creation_to_update:0, days_stmt_to_report:8, invoice:570, is_rtc_case:false, sla_ack:true, sla_contact:true, sla_update:true, sla_report:false, report_proxy:false, sla_report_target_days:3 },
    { ref:"1149704", client_ref:"FC/901567482", type:"Motor Theft", status:"Invoice Paid", created:"1 Apr 2026", first_updated:"1 Apr 2026", stmt_date:"9 Apr 2026", report_sent:"20 Apr 2026", days_creation_to_update:0, days_stmt_to_report:11, invoice:570, is_rtc_case:false, sla_ack:true, sla_contact:true, sla_update:true, sla_report:false, report_proxy:false, sla_report_target_days:3 },
    { ref:"1151404", client_ref:"FC/901569926", type:"RTC", status:"Invoiced", created:"7 Apr 2026", first_updated:"7 Apr 2026", stmt_date:"14 Apr 2026", report_sent:"17 Apr 2026", days_creation_to_update:0, days_stmt_to_report:3, invoice:176.4, is_rtc_case:true, sla_ack:true, sla_contact:true, sla_update:null, sla_report:false, report_proxy:false, sla_report_target_days:2 },
    { ref:"1151504", client_ref:"FC/901570498", type:"RTC", status:"Invoiced", created:"7 Apr 2026", first_updated:"9 Apr 2026", stmt_date:"22 Apr 2026", report_sent:"23 Apr 2026", days_creation_to_update:2, days_stmt_to_report:1, invoice:176.4, is_rtc_case:true, sla_ack:true, sla_contact:true, sla_update:null, sla_report:true, report_proxy:false, sla_report_target_days:2 },
    { ref:"1151604", client_ref:"FC/901568025", type:"RTC", status:"Invoice Paid", created:"7 Apr 2026", first_updated:"9 Apr 2026", stmt_date:"22 Apr 2026", report_sent:"23 Apr 2026", days_creation_to_update:2, days_stmt_to_report:1, invoice:176.4, is_rtc_case:true, sla_ack:true, sla_contact:true, sla_update:null, sla_report:true, report_proxy:false, sla_report_target_days:2 },
    { ref:"1151704", client_ref:"FC/901567446", type:"Motor Theft", status:"Invoice Paid", created:"7 Apr 2026", first_updated:"7 Apr 2026", stmt_date:"", report_sent:"", days_creation_to_update:0, days_stmt_to_report:null, invoice:0, is_rtc_case:true, sla_ack:true, sla_contact:true, sla_update:null, sla_report:null, report_proxy:false, sla_report_target_days:2 },
    { ref:"1151804", client_ref:"FC/901567406", type:"Motor Theft", status:"Invoice Paid", created:"7 Apr 2026", first_updated:"7 Apr 2026", stmt_date:"8 Apr 2026", report_sent:"8 Apr 2026", days_creation_to_update:0, days_stmt_to_report:0, invoice:176.4, is_rtc_case:true, sla_ack:true, sla_contact:true, sla_update:null, sla_report:true, report_proxy:false, sla_report_target_days:2 },
    { ref:"1151904", client_ref:"FC/901569719", type:"RTC", status:"Invoice Paid", created:"7 Apr 2026", first_updated:"7 Apr 2026", stmt_date:"15 Apr 2026", report_sent:"20 Apr 2026", days_creation_to_update:0, days_stmt_to_report:5, invoice:176.4, is_rtc_case:true, sla_ack:true, sla_contact:true, sla_update:null, sla_report:false, report_proxy:false, sla_report_target_days:2 },
    { ref:"1153104", client_ref:"FC/901571032", type:"RTC", status:"Invoiced", created:"8 Apr 2026", first_updated:"", stmt_date:"", report_sent:"", days_creation_to_update:null, days_stmt_to_report:null, invoice:176.4, is_rtc_case:true, sla_ack:null, sla_contact:null, sla_update:null, sla_report:null, report_proxy:false, sla_report_target_days:2 },
    { ref:"1153204", client_ref:"FC/901570798", type:"RTC", status:"Invoice Paid", created:"8 Apr 2026", first_updated:"8 Apr 2026", stmt_date:"", report_sent:"", days_creation_to_update:0, days_stmt_to_report:null, invoice:176.4, is_rtc_case:true, sla_ack:true, sla_contact:true, sla_update:null, sla_report:null, report_proxy:false, sla_report_target_days:2 },
    { ref:"1153304", client_ref:"FC/901568473", type:"RTC", status:"Invoiced", created:"8 Apr 2026", first_updated:"8 Apr 2026", stmt_date:"", report_sent:"", days_creation_to_update:0, days_stmt_to_report:null, invoice:176.4, is_rtc_case:true, sla_ack:true, sla_contact:true, sla_update:null, sla_report:null, report_proxy:false, sla_report_target_days:2 },
    { ref:"1153504", client_ref:"FC/901570931", type:"RTC", status:"Invoice Paid", created:"8 Apr 2026", first_updated:"8 Apr 2026", stmt_date:"9 Apr 2026", report_sent:"9 Apr 2026", days_creation_to_update:0, days_stmt_to_report:0, invoice:176.4, is_rtc_case:true, sla_ack:true, sla_contact:true, sla_update:null, sla_report:true, report_proxy:false, sla_report_target_days:2 },
    { ref:"1153704", client_ref:"FC/901567641", type:"RTC", status:"Invoice Paid", created:"9 Apr 2026", first_updated:"28 Mar 2026", stmt_date:"15 Apr 2026", report_sent:"16 Apr 2026", days_creation_to_update:null, days_stmt_to_report:1, invoice:176.4, is_rtc_case:true, sla_ack:true, sla_contact:true, sla_update:null, sla_report:true, report_proxy:false, sla_report_target_days:2 },
    { ref:"1153804", client_ref:"FC/901563566", type:"RTC", status:"Invoice Paid", created:"9 Apr 2026", first_updated:"14 Apr 2026", stmt_date:"", report_sent:"", days_creation_to_update:5, days_stmt_to_report:null, invoice:0, is_rtc_case:true, sla_ack:true, sla_contact:true, sla_update:null, sla_report:null, report_proxy:false, sla_report_target_days:2 },
    { ref:"1154104", client_ref:"FC/901572769", type:"RTC", status:"Invoiced", created:"10 Apr 2026", first_updated:"9 Apr 2026", stmt_date:"15 Apr 2026", report_sent:"15 Apr 2026", days_creation_to_update:null, days_stmt_to_report:0, invoice:176.4, is_rtc_case:true, sla_ack:true, sla_contact:true, sla_update:null, sla_report:true, report_proxy:false, sla_report_target_days:2 },
    { ref:"1155204", client_ref:"FC/901573224", type:"RTC", status:"Invoice Paid", created:"14 Apr 2026", first_updated:"14 Apr 2026", stmt_date:"16 Apr 2026", report_sent:"17 Apr 2026", days_creation_to_update:0, days_stmt_to_report:1, invoice:176.4, is_rtc_case:true, sla_ack:true, sla_contact:true, sla_update:null, sla_report:true, report_proxy:false, sla_report_target_days:2 },
    { ref:"1155704", client_ref:"FC/901571090", type:"RTC", status:"Invoiced", created:"14 Apr 2026", first_updated:"15 Apr 2026", stmt_date:"28 Apr 2026", report_sent:"29 Apr 2026", days_creation_to_update:1, days_stmt_to_report:1, invoice:176.4, is_rtc_case:true, sla_ack:true, sla_contact:true, sla_update:null, sla_report:true, report_proxy:false, sla_report_target_days:2 },
    { ref:"1156104", client_ref:"FC/901441239", type:"RTC", status:"Invoiced", created:"15 Apr 2026", first_updated:"15 Apr 2026", stmt_date:"22 Apr 2026", report_sent:"23 Apr 2026", days_creation_to_update:0, days_stmt_to_report:1, invoice:176.4, is_rtc_case:true, sla_ack:true, sla_contact:true, sla_update:null, sla_report:true, report_proxy:false, sla_report_target_days:2 },
    { ref:"1157004", client_ref:"FC/901534927", type:"Motor Fraud", status:"Invoice Paid", created:"17 Apr 2026", first_updated:"22 Jan 2026", stmt_date:"", report_sent:"", days_creation_to_update:null, days_stmt_to_report:null, invoice:0, is_rtc_case:false, sla_ack:null, sla_contact:null, sla_update:null, sla_report:null, report_proxy:false, sla_report_target_days:3 },
    { ref:"1157904", client_ref:"FC/901573865", type:"RTC", status:"Invoiced", created:"21 Apr 2026", first_updated:"23 Apr 2026", stmt_date:"27 Apr 2026", report_sent:"27 Apr 2026", days_creation_to_update:2, days_stmt_to_report:0, invoice:176.4, is_rtc_case:true, sla_ack:true, sla_contact:true, sla_update:null, sla_report:true, report_proxy:false, sla_report_target_days:2 }
  ]

};
