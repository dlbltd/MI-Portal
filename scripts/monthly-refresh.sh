#!/usr/bin/env bash
# Monthly MI refresh — run this each month after downloading the two TrackOps CSVs.
# Usage:
#   ./scripts/monthly-refresh.sh <cases-csv> <invoices-csv>
#
# Period label and email subject are calculated automatically from today's date.
# Graph credentials are loaded from .env in the project root.

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

CASES_CSV="$1"
INVOICES_CSV="$2"

if [[ -z "$CASES_CSV" || -z "$INVOICES_CSV" ]]; then
  echo "Usage: ./scripts/monthly-refresh.sh <cases-csv> <invoices-csv>"
  exit 1
fi

echo "==> Generating client files..."
node scripts/process-csv.js "$CASES_CSV" --invoices "$INVOICES_CSV" --year 2026

echo ""
echo "==> Committing and pushing..."
git add clients/
git commit -m "MI data refresh — $(date '+%d %b %Y')"
git push

echo ""
echo "==> Sending announcement email..."
SAVE_TO_SENT=1 node scripts/send-mi-announcement.js

echo ""
echo "All done."
