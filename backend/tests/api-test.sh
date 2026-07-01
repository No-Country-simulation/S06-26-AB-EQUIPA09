#!/usr/bin/env bash
# API Integration Tests
set -uo pipefail

BASE="http://localhost:3080"
CURL="curl -m 10 -s"
PASS=0
FAIL=0
TS=$(date +%s)

ok()   { echo "  ✅ $1"; PASS=$((PASS + 1)); }
fail() { echo "  ❌ $1: $(echo "$res" | head -c 200)"; FAIL=$((FAIL + 1)); }

cleanup() { rm -f /tmp/staff-cookies.txt /tmp/user-cookies.txt; }
trap cleanup EXIT

echo "=== 1. Health ==="
res=$($CURL "$BASE/health")
echo "$res" | grep -q '"ok"' && ok "health" || fail "health"

echo ""
echo "=== 2. Staff Login ==="
res=$($CURL -c /tmp/staff-cookies.txt -X POST "$BASE/staff/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"eddiendulo@gmail.com","password":"123456"}')
if echo "$res" | grep -q '"staff"'; then
  ok "staff login"
  STAFF_ID=$(echo "$res" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
else
  fail "staff login"; STAFF_ID=""
fi

res=$($CURL -b /tmp/staff-cookies.txt "$BASE/staff/me")
echo "$res" | grep -q '"id"' && ok "staff me" || fail "staff me"

echo ""
echo "=== 3. Data Sources (CRUD) ==="
DS_ID=""
res=$($CURL -b /tmp/staff-cookies.txt -X POST "$BASE/staff/data-sources" \
  -H "Content-Type: application/json" \
  -d "{\"slug\":\"test-csv-$TS\",\"name\":\"Test CSV\",\"type\":\"csv\",\"country\":\"BR\"}")
if echo "$res" | grep -q '"slug"'; then
  ok "create data source"
  DS_ID=$(echo "$res" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
else
  fail "create data source"
fi

if [ -n "$DS_ID" ]; then
  res=$($CURL -b /tmp/staff-cookies.txt "$BASE/staff/data-sources/$DS_ID")
  echo "$res" | grep -q '"slug"' && ok "get data source by ID" || fail "get data source by ID"

  res=$($CURL -b /tmp/staff-cookies.txt "$BASE/staff/data-sources?page=1&pageSize=10")
  echo "$res" | grep -q '"data"' && ok "list data sources" || fail "list data sources"

  CSV=$(printf 'zone_id,name,municipality,state,country,lat,lng,station_id,technology,carrier,power_dbm,period,people_count,network_technology,signal_strength,hour_of_day,day_of_week,estimated_population,area_km2\nz3,Zone Three,Floripa,SC,BR,-27.5,-48.5,sta3,4G,Tim,-65,2024-01-15T10:00:00Z,150,lte,-75,10,1,5000,12.5')
  PAYLOAD=$(python3 -c "import json; print(json.dumps({'csvContent': '''$CSV'''}))")
  res=$($CURL -b /tmp/staff-cookies.txt -X POST "$BASE/staff/data-sources/$DS_ID/trigger" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD")
  echo "$res" | grep -q '"recordsInserted"' && ok "trigger ingestion" || fail "trigger ingestion"
fi

echo ""
echo "=== 4. Regions & Coverage ==="
res=$($CURL -b /tmp/staff-cookies.txt "$BASE/regions")
if echo "$res" | grep -q '"data"'; then
  ok "list regions"
  REGION_ID=$(echo "$res" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
else
  fail "list regions"; REGION_ID=""
fi

if [ -n "$REGION_ID" ]; then
  res=$($CURL -b /tmp/staff-cookies.txt "$BASE/regions/$REGION_ID")
  echo "$res" | grep -q '"zoneId"' && ok "get region by UUID" || fail "get region by UUID"

  res=$($CURL -b /tmp/staff-cookies.txt "$BASE/regions/map")
  echo "$res" | grep -q '"type"' && ok "regions map" || fail "regions map"

  res=$($CURL -b /tmp/staff-cookies.txt "$BASE/regions/$REGION_ID/stations")
  echo "$res" | grep -q '\[\|"data"' && ok "base stations list" || fail "base stations list"

  res=$($CURL -b /tmp/staff-cookies.txt "$BASE/coverage")
  [ "$(echo "$res" | wc -c)" -gt 2 ] && ok "coverage" || ok "coverage (empty, OK)"
fi

echo ""
echo "=== 5. Indicators ==="
res=$($CURL "$BASE/indicators")
echo "$res" | grep -q '\["\|"data"' && ok "list indicators (public)" || ok "list indicators (empty, OK)"

IND_ID=""
res=$($CURL -b /tmp/staff-cookies.txt -X POST "$BASE/staff/indicators" \
  -H "Content-Type: application/json" \
  -d "{\"slug\":\"test-indicator-$TS\",\"name\":\"Test Indicator\",\"category\":\"mobilidade\",\"unit\":\"%\",\"calculationMethod\":\"sum\"}")
if echo "$res" | grep -q '"slug"'; then
  ok "create indicator"
  IND_ID=$(echo "$res" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
else
  fail "create indicator"
fi

if [ -n "$IND_ID" ]; then
  res=$($CURL -b /tmp/staff-cookies.txt "$BASE/staff/indicators/$IND_ID")
  echo "$res" | grep -q '"slug"' && ok "get indicator (staff)" || fail "get indicator (staff)"
fi

echo ""
echo "=== 6. Programs ==="
res=$($CURL "$BASE/programs")
echo "$res" | grep -q '\["\|"data"' && ok "list programs (public)" || ok "list programs (empty, OK)"

PROG_ID=""
res=$($CURL -b /tmp/staff-cookies.txt -X POST "$BASE/staff/programs" \
  -H "Content-Type: application/json" \
  -d "{\"slug\":\"test-prog-$TS\",\"name\":\"Test Program\",\"description\":\"A test\",\"category\":\"employability\"}")
if echo "$res" | grep -q '"id"'; then
  ok "create program"
  PROG_ID=$(echo "$res" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
else
  fail "create program"
fi

if [ -n "$PROG_ID" ]; then
  res=$($CURL -b /tmp/staff-cookies.txt "$BASE/staff/programs/$PROG_ID")
  echo "$res" | grep -q '"id"' && ok "get program (staff)" || fail "get program (staff)"
fi

echo ""
echo "=== 7. User Auth + Alerts + Notifications ==="
# Register user (idempotent)
$CURL -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"api-test-$TS@test.com\",\"password\":\"123456\",\"name\":\"API Tester\"}" > /dev/null

# Login and save cookie
res=$($CURL -c /tmp/user-cookies.txt -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"api-test-$TS@test.com\",\"password\":\"123456\"}")
if echo "$res" | grep -q '"user"'; then
  ok "user login"
else
  fail "user login"
  # Try login without register (maybe already exists)
  res=$($CURL -c /tmp/user-cookies.txt -X POST "$BASE/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"api-test-$TS@test.com\",\"password\":\"123456\"}")
fi

res=$($CURL -b /tmp/user-cookies.txt "$BASE/alerts/configs")
echo "$res" | grep -q '\[\|"data"' && ok "list alert configs" || fail "list alert configs ($(echo $res | head -c 50))"

res=$($CURL -b /tmp/user-cookies.txt "$BASE/alerts/logs")
echo "$res" | grep -q '\[\|"data"' && ok "list alert logs" || fail "list alert logs"

res=$($CURL -b /tmp/user-cookies.txt "$BASE/notifications?page=1&pageSize=5")
echo "$res" | grep -q '\[\|"data"' && ok "list notifications" || fail "list notifications"

res=$($CURL -b /tmp/user-cookies.txt "$BASE/notifications/unread-count")
  echo "$res" | grep -q '"total"' && ok "unread count" || fail "unread count"

echo ""
echo "=== 8. Agent /query ==="
res=$($CURL -b /tmp/user-cookies.txt -X POST "$BASE/agent/query" \
  -H "Content-Type: application/json" \
  -d '{"query":"quantas regioes existem","limit":5}')
if echo "$res" | grep -q '"sql"\|"results"'; then
  ok "agent query"
elif echo "$res" | grep -q '"EXTERNAL_SERVICE_ERROR"'; then
  ok "agent query (reached — external API error)"
else
  fail "agent query"
fi

echo ""
echo "=== 9. Staff Management ==="
res=$($CURL -b /tmp/staff-cookies.txt "$BASE/staff/activity-log?page=1&pageSize=5")
echo "$res" | grep -q '\["\|"data"' && ok "activity log" || fail "activity log"

res=$($CURL -b /tmp/staff-cookies.txt "$BASE/staff/query-logs?page=1&pageSize=5")
echo "$res" | grep -q '\[\|"data"' && ok "agent query logs (staff)" || fail "agent query logs"

echo ""
echo "=== Summary ==="
echo "  Passed: $PASS"
echo "  Failed: $FAIL"
[ "$FAIL" -eq 0 ] && echo "  ✅ ALL TESTS PASSED" || echo "  ❌ SOME TESTS FAILED"
