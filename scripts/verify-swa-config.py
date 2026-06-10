#!/usr/bin/env python3
# Cross-checks staticwebapp.config.json, auth-shim.js and clients/ are consistent.
# Run before pushing if any of those three change.
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
cfg  = json.load(open(os.path.join(ROOT, 'staticwebapp.config.json')))
shim = open(os.path.join(ROOT, 'auth-shim.js')).read()

errors = []

routes = cfg['routes']
client_route_indices = [i for i, r in enumerate(routes) if r['route'].startswith('/clients/')]
wildcard_indices     = [i for i, r in enumerate(routes) if r['route'] == '/clients/*']
specific_indices     = [i for i in client_route_indices if i not in wildcard_indices]

if len(wildcard_indices) != 1:
    errors.append(f'Expected exactly one /clients/* wildcard route, found {len(wildcard_indices)}')
elif specific_indices and wildcard_indices[0] < max(specific_indices):
    errors.append('/clients/* wildcard must come AFTER all specific /clients/<file>.js routes (SWA matches top-down, first wins)')

wild = routes[wildcard_indices[0]] if wildcard_indices else None
if wild and 'dlb-admin' not in wild['allowedRoles']:
    errors.append('/clients/* wildcard should restrict to dlb-admin so new files default to admin-only')
if wild and ('authenticated' in wild['allowedRoles'] or 'anonymous' in wild['allowedRoles']):
    errors.append('/clients/* wildcard must not allow "authenticated"/"anonymous" — would leak across tenants')

fs_files = sorted(f for f in os.listdir(os.path.join(ROOT, 'clients')) if f.endswith('.js'))
routed_files = sorted(
    r['route'].split('/')[-1]
    for r in routes
    if r['route'].startswith('/clients/') and r['route'] != '/clients/*'
)
missing = set(fs_files) - set(routed_files)
extra   = set(routed_files) - set(fs_files)
if missing:
    errors.append(f'Client files with no specific SWA route: {sorted(missing)}')
if extra:
    errors.append(f'SWA routes for files that do not exist: {sorted(extra)}')

shim_pairs = re.findall(r"'(client-[\w]+)':\s*'clients/([\w]+\.js)'", shim)
for role, fname in shim_pairs:
    match = [r for r in routes if r['route'] == f'/clients/{fname}']
    if not match:
        errors.append(f'auth-shim maps {role} -> {fname} but no SWA route exists for that file')
        continue
    if role not in match[0]['allowedRoles']:
        errors.append(f'auth-shim maps {role} -> {fname} but SWA route allows {match[0]["allowedRoles"]}')

if errors:
    print('FAIL')
    for e in errors:
        print(' -', e)
    sys.exit(1)

print(f'OK: {len(specific_indices)} client routes, wildcard at index {wildcard_indices[0]}, shim map consistent')
