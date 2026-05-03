#!/bin/sh
set -e

MC_ALIAS="${MC_ALIAS:-local}"
MC_ENDPOINT="${MC_ENDPOINT:-http://minio:9000}"
ROOT_USER="${MINIO_ROOT_USER:?MINIO_ROOT_USER is required}"
ROOT_PASSWORD="${MINIO_ROOT_PASSWORD:?MINIO_ROOT_PASSWORD is required}"
BUCKET="${S3_BUCKET:?S3_BUCKET is required}"
ORIGINS="${MINIO_CORS_ORIGINS:?MINIO_CORS_ORIGINS is required (comma-separated URLs)}"

mc alias set "$MC_ALIAS" "$MC_ENDPOINT" "$ROOT_USER" "$ROOT_PASSWORD"
mc mb -p "$MC_ALIAS/$BUCKET" || true

build_origins_json() {
  OLDIFS="$IFS"
  IFS=','
  first=1
  out=""
  for origin in $ORIGINS; do
    trimmed=$(printf '%s' "$origin" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    [ -z "$trimmed" ] && continue
    [ -n "$out" ] && out="$out,"
    out="$out\"$trimmed\""
    first=0
  done
  IFS="$OLDIFS"
  printf '[%s]' "$out"
}

origins_json=$(build_origins_json)
printf '[{"AllowedOrigins":%s,"AllowedMethods":["GET","PUT","POST","HEAD"],"AllowedHeaders":["*"],"ExposeHeaders":["ETag"],"MaxAgeSeconds":3000}]' "$origins_json" >/tmp/cors.json
mc cors set "$MC_ALIAS/$BUCKET" /tmp/cors.json