#!/usr/bin/env bash
set -euo pipefail

PRIMARY_DOMAIN="myfng.in"
PRIMARY_WWW="www.myfng.in"
OLD_DOMAIN="myfng.cloud"

echo "=== DNS ==="
echo "myfng.in      -> $(dig +short ${PRIMARY_DOMAIN} | paste -sd ',' -)"
echo "www.myfng.in  -> $(dig +short ${PRIMARY_WWW} | paste -sd ',' -)"
echo "myfng.cloud   -> $(dig +short ${OLD_DOMAIN} | paste -sd ',' -)"

echo
echo "=== HTTPS Status ==="
curl -sS -I "https://${PRIMARY_DOMAIN}" | sed -nE '/^(HTTP\/|[Ll]ocation:)/p'
echo
curl -sS -I "https://${PRIMARY_WWW}" | sed -nE '/^(HTTP\/|[Ll]ocation:)/p'
echo
curl -sS -I "https://${OLD_DOMAIN}" | sed -nE '/^(HTTP\/|[Ll]ocation:)/p'
echo
curl -sS -I "https://${OLD_DOMAIN}/login" | sed -nE '/^(HTTP\/|[Ll]ocation:)/p'

echo
echo "Cutover check finished."
