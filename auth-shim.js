// auth-shim.js — runs on every page. Detects whether we're hosted on Azure Static
// Web Apps (which exposes /.auth/me) or on plain static hosting (GitHub Pages).
//
// On Azure SWA: returns the signed-in user's identity + roles, so dashboard.html
// can decide which client data to load without a shared access code.
// On GitHub Pages: returns null (falls back to the legacy access-code flow).

window.DLB_AUTH = (function () {
  const ROLE_TO_CLIENT_FILE = {
    'client-inshur':        'clients/inshur.js',
    'client-zego':          'clients/zego.js',
    'client-firstcentral':  'clients/firstcentral.js',
    'client-trinity':       'clients/trinity.js',
    'client-dwf':           'clients/dwf.js',
    'client-carcareplan':   'clients/carcareplan.js',
    'client-ande':          'clients/itb.js',
    'client-transport':     'clients/transportation.js',
    'client-collingwood':   'clients/collingwood.js',
    'client-zebra':         'clients/zebra.js',
    'client-jpsolicitors':  'clients/jpsolicitors.js',
    'client-keoghs':        'clients/keoghs.js',
    'client-weightmans':    'clients/weightmans.js',
    'client-action365':     'clients/action365.js',
    'client-rostella':      'clients/rostella.js',
  };

  let _cache = undefined;

  async function fetchIdentity() {
    if (_cache !== undefined) return _cache;
    try {
      const res = await fetch('/.auth/me', { credentials: 'same-origin' });
      if (!res.ok) { _cache = null; return null; }
      const body = await res.json();
      const principal = (body && body.clientPrincipal) || null;
      _cache = principal;
      return principal;
    } catch (e) {
      _cache = null;
      return null;
    }
  }

  function pickClientFile(principal) {
    if (!principal) return null;
    const roles = principal.userRoles || [];
    if (roles.includes('dlb-admin')) return { adminAll: true, file: null };
    for (const r of roles) {
      const file = ROLE_TO_CLIENT_FILE[r];
      if (file) return { adminAll: false, file };
    }
    return null;
  }

  return {
    /** True if we're on Azure SWA (i.e. /.auth/me responded). */
    async isAzure() {
      const p = await fetchIdentity();
      return p !== null || !!(window.location.hostname.endsWith('.azurestaticapps.net'));
    },
    /** The signed-in principal, or null if not on SWA / not signed in. */
    async getPrincipal() {
      return await fetchIdentity();
    },
    /** Determine which client.js file the current user should see. */
    async resolveClient() {
      const p = await fetchIdentity();
      return pickClientFile(p);
    },
    /** Convenience: trigger Azure AD login. */
    login() {
      window.location.href = '/.auth/login/aad?post_login_redirect_uri=/dashboard.html';
    },
    /** Convenience: log out of Azure AD. */
    logout() {
      window.location.href = '/.auth/logout?post_logout_redirect_uri=/index.html';
    },
    ROLE_TO_CLIENT_FILE,
  };
})();
