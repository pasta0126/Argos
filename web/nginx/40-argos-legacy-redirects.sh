#!/bin/sh
# If this host used to serve the API, ARGOS_LEGACY_API_URL makes its old API paths answer
# 308 to the API's current URL (308 keeps method and body; `curl -L` drops Authorization
# across hosts, so scripts still need the new URL). Unset: no redirects.
set -eu
out=/etc/nginx/conf.d/legacy-redirects.inc
rm -f "$out"
[ -n "${ARGOS_LEGACY_API_URL:-}" ] || exit 0
to="${ARGOS_LEGACY_API_URL%/}"
cat > "$out" <<CONF
location ^~ /v1/          { return 308 $to\$request_uri; }
location = /health        { return 308 $to\$request_uri; }
location ^~ /docs         { return 308 $to\$request_uri; }
location ^~ /redoc        { return 308 $to\$request_uri; }
location = /openapi.json  { return 308 $to\$request_uri; }
CONF
echo "$0: redirecting old API paths to $to"
