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

### 1.3 Verify first deploy

Push any commit (or trigger the workflow manually) — within ~2 min, Azure will deploy. The Overview page shows the default URL, e.g. `https://<random-name>.azurestaticapps.net`.

Open it. You should see the same login screen as GitHub Pages, plus a new **"Sign in with your work email"** button below the access code.

---

## 2. Configure custom domain (optional but recommended)

Use `mi.dlbinvestigations.co.uk` for Azure SWA instead of GitHub Pages.

1. SWA resource → **Custom domains** → **+ Add**.
2. **Domain type:** **Custom domain on other DNS**.
3. Enter `mi.dlbinvestigations.co.uk` → **Next**.
4. Azure shows a CNAME or TXT validation record. Add it at your DNS provider for `dlbinvestigations.co.uk`.
5. Click **Validate**.
6. Once validated, Azure issues a free SSL certificate.
7. **Switch over** by updating the existing `mi` CNAME to point at the Azure SWA hostname instead of GitHub Pages.

(Plan a brief downtime — usually under 10 minutes for DNS propagation. Or keep GitHub Pages on a temporary subdomain like `mi-legacy.dlbinvestigations.co.uk` for a few weeks during cutover.)

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

1. Send yourself an invite as `client-inshur`.
2. Sign in. You should land on the dashboard with Inshur's data, **without** ever entering an access code.
3. Try to navigate directly to `/clients/zego.js` — Azure should return 403 (your role doesn't include `client-zego`).
4. Sign yourself out (`/.auth/logout`) and confirm you're sent back to the login page.

---

## 5. What happens to the existing access codes?

- They keep working on **GitHub Pages** indefinitely (the code in `index.html` falls back to the access-code flow when `/.auth/me` returns 404, which is what GitHub Pages does).
- On **Azure SWA**, the access code box still works as a backup, *but* the SSO button is shown above it as the recommended path. Once all clients are migrated, you can remove the access-code form entirely.
- You can keep both deployments live for a transition period, or DNS-switch the production URL to Azure once you're satisfied.

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
