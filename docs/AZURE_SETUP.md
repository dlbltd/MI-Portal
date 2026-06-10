# Azure Static Web Apps — Setup & Migration Guide

This guide walks through migrating the DLB MI Portal from GitHub Pages to **Azure Static Web Apps** with **Entra ID (Azure AD) authentication**, so clients can sign in with their work email instead of a shared access code, and corporate firewalls that block GitHub Pages will allow it (Microsoft endpoints are universally trusted).

The portal is **dual-mode**: while both deployments run in parallel, GitHub Pages continues to serve the existing access-code-based portal and Azure SWA serves the SSO version. Once you're happy with the Azure version, you can retire GitHub Pages.

---

## 1. One-time Azure setup (≈ 15 min, no charge)

### 1.1 Create the Static Web App resource

1. Sign in to https://portal.azure.com (create a free account if you don't have one — the SWA Free tier covers this site comfortably).
2. Search **"Static Web Apps"** in the top bar → **+ Create**.
3. Fill in:
   - **Subscription:** *your default*
   - **Resource group:** create new → `dlb-mi-portal`
   - **Name:** `dlb-mi-portal`
   - **Plan type:** **Free**
   - **Region:** `West Europe`
   - **Deployment details → Source:** **GitHub**
     - Authorize Azure to access GitHub when prompted
     - **Organization:** `dlbltd`
     - **Repository:** `MI-Portal`
     - **Branch:** `main`
   - **Build presets:** **Custom**
     - **App location:** `/`
     - **Output location:** *(leave blank)*
4. **Review + create** → **Create**.

Azure will commit a new workflow file to the repo automatically (we already have ours, so just delete Azure's auto-generated one or let them coexist — they don't conflict).

### 1.2 Copy the deployment token

1. In the new Static Web App resource → **Overview** → **Manage deployment token**.
2. Copy the token.
3. In GitHub → repo settings → **Secrets and variables → Actions → New repository secret**:
   - **Name:** `AZURE_STATIC_WEB_APPS_API_TOKEN`
   - **Value:** *paste token*

### 1.3 Enable the deploy workflow

The Azure deploy workflow is gated by a repo **variable** so it doesn't fail on every push before Azure is set up. Turn it on:

- GitHub → repo → **Settings → Secrets and variables → Actions → Variables tab → New repository variable**:
  - **Name:** `AZURE_SWA_ENABLED`
  - **Value:** `true`

### 1.4 Verify first deploy

Push any commit (or trigger the workflow manually from the Actions tab) — within ~2 min, Azure will deploy. The Overview page shows the default URL, e.g. `https://<random-name>.azurestaticapps.net`.

Open it. You should see the same login screen as GitHub Pages, plus a new **"Sign in with your work email"** button below the access code.

---

## 2. Custom domain — parallel run, then flip

Cutover is staged: stand Azure up on a **new** subdomain first, pilot SSO with one client, then DNS-flip `mi.dlbinvestigations.co.uk` to Azure. GitHub Pages keeps serving the production URL during the pilot, so a broken Azure setup never takes the dashboard down.

### 2.1 Stand Azure up on `mi-new.dlbinvestigations.co.uk`

1. SWA resource → **Custom domains** → **+ Add**.
2. **Domain type:** **Custom domain on other DNS**.
3. Enter `mi-new.dlbinvestigations.co.uk` → **Next**.
4. Azure shows a CNAME validation record. Add it at your DNS provider:
   - **Host:** `mi-new`
   - **Type:** `CNAME`
   - **Value:** *(the `<random-name>.azurestaticapps.net` hostname Azure gave you)*
5. Click **Validate**. Once validated, Azure issues a free SSL certificate (≈ 5–10 min).

Now `mi.dlbinvestigations.co.uk` still resolves to GitHub Pages (legacy access-code portal) and `mi-new.dlbinvestigations.co.uk` resolves to Azure (SSO portal). Both are live.

### 2.2 Pilot with one client

Invite a single contact at one client (Inshur or And-E recommended — both are heavy users and have nominated technical contacts already) using the role-invite flow in §3. Send them the `mi-new` URL and confirm:

- They can sign in with their work email.
- They land on **their** dashboard, not anyone else's.
- Their IT firewall doesn't block `*.azurestaticapps.net` or `mi-new.dlbinvestigations.co.uk`.

Leave the pilot in place for ~2 weeks. Watch for sign-in failures via SWA → **Insights**.

### 2.3 Flip `mi.dlbinvestigations.co.uk` to Azure

Once the pilot is green:

1. SWA resource → **Custom domains** → **+ Add** → `mi.dlbinvestigations.co.uk`. Validate the CNAME at your DNS provider (replace the existing GitHub Pages CNAME with the Azure hostname). DNS propagation is usually under 10 min.
2. Azure issues a second SSL cert.
3. GitHub Pages keeps serving until DNS fully propagates — there is no downtime window.
4. **Keep `mi-new` alive** as a permanent alias. It costs nothing and is handy for diagnostics.

### 2.4 Decommission GitHub Pages (optional)

Once `mi.` is on Azure, the GitHub Pages site is no longer reachable via the custom domain. You can either:

- Leave the GitHub Pages site enabled at `dlbltd.github.io/MI-Portal` as a no-DNS fallback (rolling back means changing one CNAME), **or**
- Disable GitHub Pages in repo Settings → Pages.

Leaving it enabled is recommended for the first month post-cutover.

---

## 3. Invite client users (one row of clicks per user)

Each client contact gets their own login. No shared codes.

1. SWA resource → **Role management** (left sidebar) → **+ Invite**.
2. Fill in:
   - **Authorization provider:** `Microsoft`
   - **Invitee's email address:** e.g. `jon.crawley@inshur.com`
   - **Domain:** *(prepopulated)*
   - **Role(s):** the client role for their company. Use these role names exactly:

| Client | Role to assign |
|---|---|
| Inshur | `client-inshur` |
| Zego | `client-zego` |
| First Central | `client-firstcentral` |
| Trinity | `client-trinity` |
| DWF | `client-dwf` |
| Car Care Plan | `client-carcareplan` |
| And-E | `client-ande` |
| Transportation Claims | `client-transport` |
| Collingwood | `client-collingwood` |
| Zebra | `client-zebra` |
| J&P Solicitors | `client-jpsolicitors` |
| Keoghs | `client-keoghs` |
| Weightmans | `client-weightmans` |
| Action 365 | `client-action365` |
| Rostella | `client-rostella` |
| **DLB internal (sees all)** | `dlb-admin` |

   - **Maximum number of hours:** `8640` (≈ 1 year)
3. **Generate** → copy the invitation link → email it to the user.

When they click the link, they'll be prompted to sign in with their work email. Their role is then permanently attached to their Microsoft account for this site.

A user can hold multiple roles (e.g. an internal DLB account manager with `dlb-admin` + `client-inshur`). Add roles by re-inviting with additional role names.

---

## 4. Verify the role-based access

Test on `mi-new.dlbinvestigations.co.uk` before flipping `mi.` in §2.3:

1. Send yourself an invite as `client-inshur`. Accept it.
2. Sign in. You should land on the dashboard with Inshur's data, **without** ever entering an access code.
3. **Cross-tenant test:** try to fetch `https://mi-new.dlbinvestigations.co.uk/clients/zego.js` directly in the browser. Azure should return 403 (redirected to `/index.html?denied=1`). If it returns 200 with Zego data, the `staticwebapp.config.json` route ordering is wrong — see §4.1.
4. Sign yourself out (`/.auth/logout`) and confirm you're sent back to the login page.
5. Re-sign in as `dlb-admin` (re-invite yourself with that role added). You should land on `/dashboard-all.html`.

### 4.1 Route-ordering pre-flight

SWA matches `routes` top-down, first match wins. If `/clients/*` appears before the specific per-file routes, role checks are silently bypassed. A verification script ships in the repo — run it locally before pushing any change to `staticwebapp.config.json`, `auth-shim.js`, or `clients/`:

```sh
python3 scripts/verify-swa-config.py
```

It also fails the build if a new `clients/<name>.js` is added without a matching role-gated route.

---

## 5. Access codes after migration — keep as permanent fallback

Access codes stay live on Azure SWA as a **permanent secondary path**, not a transitional one. SSO is the default for ongoing client users; access codes cover everything SSO doesn't fit:

- **One-off external recipients** — loss adjusters, panel solicitors, brokers given temporary visibility on a specific client. Provisioning an Entra guest invite for a single look-up is overkill; hand them a code instead.
- **Break-glass** — if Entra ID has an outage or a customer's tenant federation breaks, the code path is unaffected. The SSO button stays visible but clients can still get in.
- **Pre-SSO clients** — until every client contact has been invited and accepted their Entra invitation, the code is their route in.

In `index.html` the access-code form is always visible. The **"Sign in with your work email"** button is additionally shown on Azure SWA (detected by probing `/.auth/me`); on plain GitHub Pages only the code form appears. Both paths converge on the same `dashboard.html`, which resolves which client's data to load via the auth-shim — SSO roles take precedence over the session-stored code when both are present.

---

## 6. Day-to-day operations

- **Adding a new client:** same as before — create `clients/<name>.js`, add the file to `index.html`'s registry (for the access-code fallback) and `staticwebapp.config.json` (for role-based access). Then invite that client's users with the matching role.
- **Removing a client's access:** SWA → Role management → find the user → Delete.
- **Auditing who logged in when:** SWA → Insights / Diagnostic logs. (Enable Application Insights for richer logging — paid feature.)
- **Rolling back:** if anything goes wrong on Azure, point the CNAME back to GitHub Pages — instant rollback.

---

## 7. Cost

The Free tier of Azure Static Web Apps allows:

- 100 GB bandwidth/month
- 0.5 GB storage
- Unlimited custom domains
- Free SSL
- Up to 100 staging environments
- Entra ID (Microsoft) authentication

The MI portal is well within these limits — expected cost: **£0/month** on the Free tier.

If you ever exceed the limits (unlikely), the Standard tier is around £6/month.
