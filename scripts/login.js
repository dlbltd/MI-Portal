// ============================================================
// CLIENT REGISTRY
// Each entry maps an access code to a client data file.
// Add a new client by adding a new line here and creating
// their data file in /clients/
// ============================================================
const CLIENT_REGISTRY = {
  // FORMAT: "ACCESS-CODE": "clients/filename.js"
  // ── DLB Investigations Ltd — Client List 2026 ──────────────────
  "FIRSTCENTRAL26":   "clients/firstcentral.js",    // First Central Insurance
  "ZEBRA26":          "clients/zebra.js",            // Zebra
  "TRINITY26":        "clients/trinity.js",          // Trinity
  "INSHUR26":         "clients/inshur.js",           // Inshur
  "DWF26":            "clients/dwf.js",              // DWF Law
  "CARCAREPLAN26":    "clients/carcareplan.js",      // Car Care Plan
  "ACTION36526":      "clients/action365.js",        // Action 365
  "COLLINGWOOD26":    "clients/collingwood.js",      // Collingwood Insurance
  "DIRECTCOMM26":     "clients/directcommercial.js", // Direct Commercial
  "ANDE26":           "clients/ande.js",              // And-E
  "JPSOLICITORS26":   "clients/jpsolicitors.js",     // J&P Solicitors
  "KEYCLAIMS26":      "clients/keyclaims.js",        // Key Claims
  "MSG26":            "clients/msg.js",              // MSG
  "MULSANNE26":       "clients/mulsanne.js",         // Mulsanne Insurance
  "ROSTELLA26":       "clients/rostella.js",         // Rostella
  "XSD26":            "clients/xsd.js",              // XSD
  "ZEGO26":           "clients/zego.js",             // Zego Insurance
  "WEIGHTMANS26":     "clients/weightmans.js",       // Weightmans
  "KEOGHS26":         "clients/keoghs.js",           // Keoghs LLP
  "TRANSPORT26":      "clients/transportation.js",   // Transportation Claims Ltd
  "MXONECLAIM26":     "clients/mxoneclaim.js",       // MX Oneclaim
  // ── Add new clients below ──────────────────────────────────────
  "DEMO26":           "clients/demo.js",              // Demo — Meridian Motor Insurance (client presentations)
};

function handleLogin() {
  const code = document.getElementById('accessCode').value.trim().toUpperCase();
  // Internal admin code → all-clients overview
  if (code === 'DLBVIP26') {
    sessionStorage.setItem('dlb_admin_all', '1');
    window.location.href = 'dashboard-all.html';
    return;
  }
  const target = CLIENT_REGISTRY[code];
  if (target) {
    // Store in session and redirect
    sessionStorage.setItem('dlb_auth', code);
    sessionStorage.setItem('dlb_client', target);
    window.location.href = 'dashboard.html';
  } else {
    document.getElementById('errorMsg').style.display = 'block';
  }
}

document.getElementById('btnLogin').addEventListener('click', handleLogin);

document.getElementById('accessCode').addEventListener('keydown', e => {
  if (e.key === 'Enter') handleLogin();
});

document.getElementById('btnSso').addEventListener('click', () => {
  if (window.DLB_AUTH) window.DLB_AUTH.login();
});

// If already authenticated this session, go straight to dashboard
if (sessionStorage.getItem('dlb_auth')) {
  window.location.href = 'dashboard.html';
}

// Dual-mode: if running on Azure Static Web Apps, surface the "Sign in with
// work email" option. If the user is already signed in via Azure AD, send
// them straight to the dashboard.
(async () => {
  if (!window.DLB_AUTH) return;
  const principal = await window.DLB_AUTH.getPrincipal();
  if (principal) {
    // Already authenticated via Azure AD → go to dashboard
    window.location.href = 'dashboard.html';
    return;
  }
  // Auth endpoint exists (we got null but no exception) → show SSO option.
  // On plain GitHub Pages /.auth/me returns 404; we hide the SSO block.
  try {
    const probe = await fetch('/.auth/me', { method: 'HEAD' });
    if (probe.status !== 404) {
      document.getElementById('ssoBlock').style.display = 'block';
    }
  } catch {}

  // Optional: surface a "Access denied — your account does not have
  // permission for this client" banner if redirected with ?denied=1
  if (new URLSearchParams(location.search).get('denied') === '1') {
    const e = document.getElementById('errorMsg');
    e.textContent = 'Your account does not have access to a client dashboard. Contact your DLB account manager.';
    e.style.display = 'block';
  }
})();
