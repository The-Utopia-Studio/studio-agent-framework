#!/usr/bin/env bash
# STATE-1 kill-test. Deliberately destructive to LOCAL state only.
# Convex is untouched — that is the point.
set -uo pipefail
cd "$(dirname "$0")/.."

RID="probe-$(date +%s)"
export PROBE_RUN_ID="$RID"
rm -f .probe-run-id

echo "=============================================="
echo " STATE-1 KILL-TEST"
echo " runId: $RID"
echo "=============================================="

echo
echo "[1/5] starting run in a background process..."
pnpm -s probe:start & START_PID=$!

# wait for the gate (or for the process to die on its own)
for _ in $(seq 1 60); do
  [ -f .probe-run-id ] && break
  kill -0 "$START_PID" 2>/dev/null || break
  sleep 1
done

if [ ! -f .probe-run-id ]; then
  echo "ABORT: run never reached the human gate. Check CONVEX_URL / CONVEX_ADMIN_KEY."
  kill -9 "$START_PID" 2>/dev/null
  wait "$START_PID" 2>/dev/null
  exit 1
fi

echo
echo "[2/5] kill -9 (no graceful shutdown, no flush)"
kill -9 "$START_PID" 2>/dev/null
wait "$START_PID" 2>/dev/null
echo "      pid $START_PID killed."

echo
echo "[3/5] destroying ALL Mastra-local state"
BEFORE=$(find . -path ./node_modules -prune -o \
  \( -name '*.db' -o -name '*.sqlite*' -o -name 'mastra.db*' -o -name '*.libsql' \) -print 2>/dev/null | wc -l | tr -d ' ')
rm -rf .mastra mastra.db* *.sqlite* *.libsql .cache node_modules/.cache 2>/dev/null
echo "      removed .mastra/, sqlite/libsql artefacts ($BEFORE found), caches."
LEFT=$(find . -path ./node_modules -prune -o \
  \( -name '*.db' -o -name '*.sqlite*' -o -name '*.libsql' \) -print 2>/dev/null | wc -l | tr -d ' ')
echo "      local db-like files remaining: $LEFT (must be 0)"

echo
echo "[4/5] resuming in a FRESH process, given only the runId string"
pnpm -s probe:resume
RC=$?

echo
echo "[5/5] verdict"
if [ $RC -eq 0 ]; then
  echo "      PASS — resumed from Convex alone. STATE-1 satisfied by @mastra/convex."
  echo "      Next: supersede the 24-25 Aug STATE-1 entry in atelier-learnings,"
  echo "            naming the store, and close the bake-off in agent-prd Appendix C."
else
  echo "      FAIL — resume did not complete without local state."
  echo "      STATE-1 stands as written. Fall back to @convex-dev/agent."
fi
exit $RC
