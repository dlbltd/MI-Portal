# AIrep001 — Management Information (MI) Report Writing Process

**Document reference:** AIrep001
**Version:** 1.0
**Issue date:** 11 May 2026
**Owner:** Managing Director, DLB Investigations Ltd
**Approved by:** Managing Director
**Next review date:** 11 May 2027
**Classification:** Internal
**Related document:** AIarch001 (technical/security architecture — see `docs/AIarch001-MI-Architecture.md`)

---

## 1. Purpose

This procedure defines how DLB Investigations Ltd produces and distributes the monthly Management Information (MI) report to clients via the DLB MI Portal. It exists to ensure that:

- MI is released to clients on a consistent, predictable cadence
- The figures presented are accurate, complete and verifiable against source data
- The process can be performed reliably by any trained employee, not solely by the originator
- Each release is auditable and exceptions are recorded

It supports compliance with ISO 9001:2015 clauses 7.5 (Documented Information), 8.1 (Operational Planning and Control), 8.5 (Production and Service Provision) and 9.1 (Monitoring, Measurement, Analysis and Evaluation).

## 2. Scope

This procedure applies to:

- Every monthly MI release covering all clients listed in `scripts/client-map.json`
- All staff who hold the **MI Analyst** role or its designated backup
- All systems involved in the MI production chain: TrackOps, the DLB MI Portal GitHub repository (`dlbltd/MI-Portal`), GitHub Actions, GitHub Pages and Microsoft 365 (mailbox `midata@dlbinvestigations.co.uk`)

Out of scope: production of bespoke ad-hoc MI for individual client requests; reporting against the internal SLA dashboard.

## 3. Responsibilities

| Role | Responsibility |
|---|---|
| **Process Owner** (Managing Director) | Approves this procedure and its revisions. Owns the relationship with TrackOps and Microsoft for upstream issues. Holds final authority over data corrections. |
| **MI Analyst** (primary) | Executes the monthly release on schedule. Performs all verification checks. Maintains the recipient list and client mapping. |
| **MI Analyst (Backup)** | Performs the release in the primary's absence. Must complete the training checklist (Annex A) before being entrusted with a live run. |
| **IT / Systems** | Maintains GitHub repository access. Holds the Azure AD app registration credentials. Rotates Microsoft Graph client secrets per the schedule in Annex B. |

## 4. Definitions

| Term | Meaning |
|---|---|
| **MI** | Management Information — the monthly performance report produced for each insurer/legal client |
| **TrackOps** | Case management system used by DLB at `https://dlbinvestigations.viewcases.com`. Source of truth for case data. |
| **MI Portal** | Static website at `https://dlbltd.github.io/MI-Portal/`. Per-client dashboard rendered from generated JS data files. |
| **SLA** | Service Level Agreement. See `scripts/process-csv.js` header comments for the precise thresholds applied per case type. |
| **RTC case** | A case whose Case Type is "RTC" or whose Services/Flags contain the term "RTC". Subject to the 48-hour report SLA. |
| **General case** | Any case that is not RTC. Subject to the 5-day update and 72-hour report SLAs. |
| **Release cycle** | One full execution of this procedure for a given calendar month. |

## 5. References

- ISO 9001:2015 — Quality management systems — Requirements
- `scripts/process-csv.js` — CSV processor (source code documents SLA rules in comments)
- `scripts/client-map.json` — TrackOps client-name → MI-Portal file mapping
- `scripts/client-recipients.json` — Email addresses per client
- `.github/workflows/monthly-mi-email.yml` — Scheduled mailer configuration
- DLB-QMS-FORM-MI-01 — Monthly MI Release Record (Annex C of this document)

## 6. Process flow

```
┌─────────────────────────┐
│  Day -2 (3rd of month)  │   Pre-release data quality review
│  Review TrackOps data   │   Fix any source typos
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  Day 0  (5th of month)  │   Production day
│  Export CSV             │
│  Run processor          │
│  Verify outputs         │
│  Publish to portal      │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  Day 0, 08:00 UTC       │   Automated mailer
│  GitHub Actions fires   │   No manual intervention
│  Sends to all clients   │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  Day +1                 │   Post-release verification
│  Check Sent Items       │
│  Record completion      │
└─────────────────────────┘
```

## 7. Procedure

### 7.1 Pre-release data quality review (Day -2, ~30 min)

The MI Analyst shall, two working days before each release:

1. Sign into TrackOps at `https://dlbinvestigations.viewcases.com`.
2. Open the Cases view filtered to the current calendar year.
3. Spot-check 10 cases that are marked Invoiced or Invoice Paid and verify that the following fields are populated:
   - **Date Created**
   - **Date client first updated?**
   - **Date statement obtained** (where applicable to the case type)
   - **Date Report sent to client?**
4. Flag any cases with implausibly old or future dates (e.g. a "Date client first updated?" earlier than "Date Created" indicates a data-entry typo and should be corrected at source).
5. Record the spot-check on the Monthly MI Release Record (Annex C).

### 7.2 Production day — export and process (Day 0, ~10 min)

The MI Analyst shall:

1. Sign into TrackOps. Navigate to **Cases**.
2. Filter to `Date Created` between **1 January [current year]** and **today**.
3. Click **Export → CSV**. Save the file to `~/Downloads/` with its default name.
4. On the workstation, open a terminal and run:

   ```bash
   cd ~/Desktop/MI-Portal
   git pull origin main
   node scripts/process-csv.js ~/Downloads/cases_*_<timestamp>.csv
   ```

5. Review the script output. Each client line shows:
   - Case count (total) and RTC count in parentheses
   - SLA percentages for each measurable SLA dimension
6. **Verification checks** (all must pass before continuing):
   - [ ] **No "Unmatched client names"** appear in the script output. If any do, add the client name (lowercased) to `scripts/client-map.json` mapping to the correct file, then re-run.
   - [ ] **Total case count matches expectation** for the period (compare to TrackOps Cases view total).
   - [ ] **No script errors** ("ReferenceError", "SyntaxError" etc.).
7. Open `clients/zego.js` in a text editor and confirm the header reads `Period: Jan–Dec [year]` and `Updated: [today's date]`.

### 7.3 Production day — publish (Day 0, ~5 min)

1. Review the changes:

   ```bash
   git status
   git diff --stat clients/
   ```

   This will list which client files were modified. Large unexpected diffs (e.g. a client suddenly losing 50% of cases) shall be investigated before publishing.

2. Commit and push:

   ```bash
   git add clients/
   git commit -m "MI update: [Month] [Year] — Jan–Dec [Year]"
   git push origin main
   ```

3. **Verification** — wait ~90 seconds, then in a browser open `https://dlbltd.github.io/MI-Portal/`. Enter the access code `ZEGO26` (a known RTC client). Confirm:
   - [ ] Dashboard loads without an error banner at the top of the page
   - [ ] Header shows the current period (e.g. "Jan–Dec 2026") and today's date
   - [ ] At least one Case Detail Log row matches a case verified in §7.1 against the same TrackOps record

### 7.4 Automated distribution (Day 0, 08:00 UTC)

This step is fully automated by the GitHub Actions workflow `Monthly MI release email`. The workflow:

1. Reads `scripts/client-recipients.json` and `clients/*.js`
2. Acquires an OAuth access token from Microsoft via the registered Azure AD application
3. Sends one email per recipient, each personalised with the client's name and the release period
4. Logs success and failure to the workflow run output

**No manual action is required for this step.** The MI Analyst shall, however, confirm the run on Day +1 (§7.5).

### 7.5 Post-release verification (Day +1, ~10 min)

The MI Analyst shall:

1. Open `https://github.com/dlbltd/MI-Portal/actions`. Locate the most recent run of the "Monthly MI release email" workflow scheduled at 08:00 UTC on Day 0.
2. Confirm the run shows a green tick (Success).
3. Open the run, click into the "Send monthly MI emails via Microsoft Graph" step, and verify the log shows the expected number of `✓` lines (one per recipient) and `Sent N, skipped M, failed 0`.
4. Sign into the `midata@dlbinvestigations.co.uk` mailbox via Outlook. Check Sent Items contains messages with subject pattern `[Client] — [Month] [Year] MI release`.
5. **Spot-check** one client by phone or reply-to-test: confirm receipt with their nominated MI contact.
6. Record completion on Annex C.

### 7.6 Adding or removing a client

When a new client is onboarded or an existing client is offboarded the MI Analyst (or designate) shall:

1. **Onboarding a new client:**
   - Decide the access code (UPPERCASE, suffix with the current year, e.g. `NEWCLIENT26`).
   - Add the client to `index.html` `CLIENT_REGISTRY`.
   - Add the lowercased TrackOps client name(s) to `scripts/client-map.json` (include every alias TrackOps uses).
   - Add recipient(s) to `scripts/client-recipients.json`.
   - If the client is on the RTC service, set `is_rtc: true` in their `client-map.json` entry.
   - Commit and push.
2. **Offboarding a client:**
   - Remove their entry from `index.html` `CLIENT_REGISTRY` (revokes access).
   - Remove from `scripts/client-recipients.json` (stops emails).
   - Leave `scripts/client-map.json` and `clients/[name].js` in place for historical reference unless the client expressly requests data deletion.

All changes shall be made via a single commit with a message of the form `Client onboard: [Name]` or `Client offboard: [Name]`.

## 8. Records retained

| Record | Where | Retention |
|---|---|---|
| Per-month TrackOps CSV export | `~/Downloads/` on MI Analyst's workstation | 12 months |
| Generated `clients/*.js` files | `dlbltd/MI-Portal` repository (git history) | Indefinite |
| Monthly MI Release Record (Annex C) | DLB QMS folder | 3 years |
| GitHub Actions run logs | GitHub | 90 days (GitHub default) |
| Sent emails | `midata@dlbinvestigations.co.uk` Sent Items | Per DLB email retention policy |

## 9. Exception handling

| Symptom | Cause | Action |
|---|---|---|
| `Missing column: X` script error | TrackOps CSV export schema changed | Inspect the CSV header row. Add the missing column to `scripts/process-csv.js` (`need` array) and to the column accessor map. Notify Process Owner. |
| "Unmatched client names" in output | TrackOps uses a new spelling or new client | Add the lowercased name to `scripts/client-map.json` mapping to the correct file. Re-run §7.2 step 4. |
| Negative day-diff cases listed | Data-entry typos at source (wrong year) | The script already excludes these from metrics. Email the affected fee-earner with the list and ask them to correct in TrackOps before the next release. |
| Dashboard loads but shows red error banner | JavaScript error — most likely a generated `clients/*.js` file has a syntax problem | Open browser DevTools console. Read the error. Roll back the publish with `git revert HEAD && git push` and investigate. |
| Mailer workflow fails (red cross in GitHub Actions) | Most common: Microsoft Graph client secret expired; or Azure app permissions revoked | Open the failing run log. If "AADSTS7000215" or similar, rotate the secret per Annex B. If permission error, IT to re-grant Mail.Send admin consent. Re-run the workflow manually via "Run workflow" once fixed. |
| One recipient bounces | Stale email address or full mailbox | Update `scripts/client-recipients.json` and commit. No need to re-run; the rest delivered. |
| Whole pipeline missed a month | Production day not actioned, or workstation unavailable | Backup MI Analyst shall execute. If unavailable, Process Owner shall notify clients of the delay and target a release within 5 working days. |

## 10. Annexes

### Annex A — MI Analyst training checklist

A new MI Analyst shall not perform an unsupervised release until they have:

- [ ] Read this procedure in full
- [ ] Observed one full release performed by the current MI Analyst
- [ ] Performed one supervised release end-to-end
- [ ] Demonstrated correct identification of a data-quality typo in TrackOps and corrective action
- [ ] Demonstrated retrieval of a Microsoft Graph workflow run log and interpretation of its output
- [ ] Signed Annex C against their first supervised release

### Annex B — Secret rotation schedule

| Credential | Rotation interval | Owner | Process |
|---|---|---|---|
| Microsoft Graph client secret | Every 18 months (or 60 days before expiry, whichever is sooner) | IT | Entra → App registrations → DLB MI Mailer → Certificates & secrets → New secret → copy Value → `gh secret set GRAPH_CLIENT_SECRET --repo dlbltd/MI-Portal`. Delete old secret after first successful workflow run on the new one. |
| TrackOps API token (when in use) | Annually, or immediately on staff departure | MI Analyst | TrackOps → Settings → API Tokens → Reset Token. |
| GitHub personal access token (deploy key) | Annually | IT | Per GitHub standard practice. |

### Annex C — Monthly MI Release Record

For each monthly release the MI Analyst shall complete:

```
Month / Year:           __________________________
MI Analyst name:        __________________________
Pre-release review date:__________________________ (Day -2)
Spot-check cases (any 3 client + case-number pairs verified):
   1. _______________________________________________
   2. _______________________________________________
   3. _______________________________________________
Data quality issues found:    __________________________
                              __________________________
Production date:        __________________________ (Day 0)
CSV filename:           __________________________
Total cases processed:  ______
Unmatched client names: ______ (must be 0)
Dashboard verified:     [ ] Yes  [ ] No (notes: __________)
Commit SHA pushed:      __________________________

Mailer run date:        __________________________ (Day 0 auto)
Workflow run URL:       __________________________
Recipients sent:        ______
Recipients failed:      ______
Spot-check delivery confirmed by: ___________________ on _______

Sign-off:               __________________________  Date: ______
                        (MI Analyst signature)
```

## 11. Revision history

| Version | Date | Author | Summary of changes |
|---|---|---|---|
| 1.0 | 11 May 2026 | David Booker | Initial issue. Establishes monthly release cadence on 5th of month with automated email distribution via Microsoft Graph. |
