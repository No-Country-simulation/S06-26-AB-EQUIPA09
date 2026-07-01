#!/usr/bin/env bash
set -euo pipefail

BASE="http://localhost:3080"
DATA_DIR="/home/edgar/Desktop/HACKATHONBIT44/backend/data"
CURL="curl -m 30 -s"
PASS=0
FAIL=0

ok()   { PASS=$((PASS + 1)); echo "  ✅ $1"; }
fail() { FAIL=$((FAIL + 1)); echo "  ❌ $1"; }
info() { echo "  ℹ️  $1"; }

cleanup() {
  rm -f /tmp/staff-cookies.txt /tmp/cdrv_*.csv /tmp/login_r.json /tmp/ingest_*.json
}
trap cleanup EXIT

echo "=== Staff Login ==="
res=$($CURL -c /tmp/staff-cookies.txt -X POST "$BASE/staff/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"eddiendulo@gmail.com","password":"123456"}')
if echo "$res" | grep -q '"staff"'; then
  ok "staff login"
else
  fail "staff login"
  echo "$res" | jq . 2>/dev/null || echo "$res"
  exit 1
fi

C=" -b /tmp/staff-cookies.txt"

#################################################
echo ""
echo "=== 1. ANTENAS FLP (132 antenas) ==="
#################################################

# Map: ecgi,cluster,municipio,lat,lon → CDRView format
info "A mapear antenas_flp.csv..."
{
  echo "zone_id,name,municipality,state,country,lat,lng,station_id,technology,carrier,power_dbm,period,people_count,network_technology,signal_strength,hour_of_day,day_of_week,estimated_population,area_km2"
  tail -n +2 "$DATA_DIR/antenas_flp.csv" | while IFS=',' read -r ecgi cluster municipio lat lon; do
    lat=$(echo "$lat" | xargs)
    lon=$(echo "$lon" | xargs)
    echo "${cluster},${cluster},${municipio},SC,BR,${lat},${lon},${ecgi},4G,,,2024-06-01T12:00:00,1,unknown,,12,6,,"
  done
} > /tmp/cdrv_antenas.csv
ANT_LINES=$(wc -l < /tmp/cdrv_antenas.csv)
info "${ANT_LINES} linhas CDRView (incl. header)"

res=$($CURL $C -X POST "$BASE/staff/data-sources" \
  -H 'Content-Type: application/json' \
  -d '{"slug":"antenas-flp-'$(date +%s)'","name":"Antenas Florianópolis (real)","description":"132 antenas da FLP","type":"csv","country":"BR"}')
DS_ANT_ID=$(echo "$res" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -n "$DS_ANT_ID" ]; then
  ok "data source antenas criada (${DS_ANT_ID:0:8})"
else
  fail "criar data source antenas"
  echo "     $res"
  DS_ANT_ID=""
fi

if [ -n "$DS_ANT_ID" ]; then
  # Upload via trigger endpoint
  CSV_ANT=$(cat /tmp/cdrv_antenas.csv)
  res=$($CURL $C -X POST "$BASE/staff/data-sources/$DS_ANT_ID/trigger" \
    -H 'Content-Type: application/json' \
    -d "$(jq -n --arg csv "$CSV_ANT" '{csvContent: $csv}')")
  REC=$(echo "$res" | grep -o '"recordsInserted":[0-9]*' | cut -d: -f2)
  RG=$(echo "$res" | grep -o '"regionsUpserted":[0-9]*' | cut -d: -f2)
  ST=$(echo "$res" | grep -o '"stationsUpserted":[0-9]*' | cut -d: -f2)
  if [ -n "$REC" ] && [ "$REC" -gt 0 ] 2>/dev/null; then
    ok "ingestão antenas → ${REC} records, ${RG} regiões, ${ST} estações"
  else
    fail "ingestão antenas"
    echo "     $res"
  fi
fi

#################################################
echo ""
echo "=== 2. TRAJETOS COMUNS (506 pares OD) ==="
#################################################

# Map: each OD pair → 2 CDRView records (origin + destination)
info "A mapear trajetos_comuns.csv..."
{
  echo "zone_id,name,municipality,state,country,lat,lng,station_id,technology,carrier,power_dbm,period,people_count,network_technology,signal_strength,hour_of_day,day_of_week,estimated_population,area_km2"
  tail -n +2 "$DATA_DIR/trajetos_comuns.csv" | while IFS=',' read -r co mo lo_x lo_y cd md ld_x ld_y mesmo nc nv dist periodo; do
    co=$(echo "$co" | xargs); mo=$(echo "$mo" | xargs)
    lo_x=$(echo "$lo_x" | xargs); lo_y=$(echo "$lo_y" | xargs)
    cd=$(echo "$cd" | xargs); md=$(echo "$md" | xargs)
    ld_x=$(echo "$ld_x" | xargs); ld_y=$(echo "$ld_y" | xargs)
    nc=$(echo "$nc" | tr -d '[:space:]'); nc=${nc:-0}
    periodo=$(echo "$periodo" | xargs)
    case "${periodo}" in
      MANHA)  p="2024-06-01T08:00:00"; h=8  ;;
      TARDE)  p="2024-06-01T14:00:00"; h=14 ;;
      NOITE)  p="2024-06-01T20:00:00"; h=20 ;;
      *)      p="2024-06-01T12:00:00"; h=12 ;;
    esac
    echo "${co},${co},${mo},SC,BR,${lo_x},${lo_y},,4G,,,${p},${nc},unknown,,${h},0,,"
    echo "${cd},${cd},${md},SC,BR,${ld_x},${ld_y},,4G,,,${p},${nc},unknown,,${h},0,,"
  done
} > /tmp/cdrv_trajetos.csv
TRAJ_LINES=$(wc -l < /tmp/cdrv_trajetos.csv)
info "${TRAJ_LINES} linhas CDRView (2 por par OD)"

res=$($CURL $C -X POST "$BASE/staff/data-sources" \
  -H 'Content-Type: application/json' \
  -d '{"slug":"trajetos-comuns-'$(date +%s)'","name":"Trajetos Comuns FLP (real)","description":"506 pares OD de Florianópolis","type":"csv","country":"BR"}')
DS_TRAJ_ID=$(echo "$res" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -n "$DS_TRAJ_ID" ]; then
  ok "data source trajetos criada (${DS_TRAJ_ID:0:8})"
else
  fail "criar data source trajetos"
  echo "     $res"
  DS_TRAJ_ID=""
fi

if [ -n "$DS_TRAJ_ID" ]; then
  CSV_TRAJ=$(cat /tmp/cdrv_trajetos.csv)
  res=$($CURL $C -X POST "$BASE/staff/data-sources/$DS_TRAJ_ID/trigger" \
    -H 'Content-Type: application/json' \
    -d "$(jq -n --arg csv "$CSV_TRAJ" '{csvContent: $csv}')")
  REC=$(echo "$res" | grep -o '"recordsInserted":[0-9]*' | cut -d: -f2)
  RG=$(echo "$res" | grep -o '"regionsUpserted":[0-9]*' | cut -d: -f2)
  if [ -n "$REC" ] && [ "$REC" -gt 0 ] 2>/dev/null; then
    ok "ingestão trajetos → ${REC} records, ${RG} regiões"
  else
    fail "ingestão trajetos"
    echo "     $res"
  fi
fi

#################################################
echo ""
echo "=== 3. VERIFICAÇÃO DOS DADOS INGERIDOS ==="
#################################################

info "A consultar regiões via API pública..."
res=$($CURL "$BASE/regions")
REG_TOTAL=$(echo "$res" | grep -o '"total":[0-9]*' | cut -d: -f2)
info "total regiões: ${REG_TOTAL}"

# List some real region names
REAL_REGIONS=$(echo "$res" | grep -oP '"name":"\K[^"]+' | head -10)
info "regiões encontradas:"
echo "$REAL_REGIONS" | while read -r name; do
  echo "         - ${name}"
done

# Check the antenas data source status
info "Data sources:"
res=$($CURL $C "$BASE/staff/data-sources")
TOTAL_DS=$(echo "$res" | grep -o '"total":[0-9]*' | cut -d: -f2 || echo "?")
echo "         total: ${TOTAL_DS}"

if [ -n "${DS_ANT_ID:-}" ]; then
  res=$($CURL $C "$BASE/staff/data-sources/$DS_ANT_ID")
  NAME_DS=$(echo "$res" | grep -oP '"name":"\K[^"]+')
  LAST=$(echo "$res" | grep -oP '"lastIngestedAt":"\K[^"]+')
  echo "         antenas: ${NAME_DS} (última ingestão: ${LAST:-nunca})"
fi

if [ -n "${DS_TRAJ_ID:-}" ]; then
  res=$($CURL $C "$BASE/staff/data-sources/$DS_TRAJ_ID")
  NAME_DS=$(echo "$res" | grep -oP '"name":"\K[^"]+')
  LAST=$(echo "$res" | grep -oP '"lastIngestedAt":"\K[^"]+')
  echo "         trajetos: ${NAME_DS} (última ingestão: ${LAST:-nunca})"
fi

echo ""
echo "=== Summary ==="
echo "  Passed: $PASS"
echo "  Failed: $FAIL"
if [ "$FAIL" -eq 0 ]; then
  echo "  ✅ REAL DATA TESTS PASSED"
else
  echo "  ❌ Some tests failed"
  exit 1
fi
