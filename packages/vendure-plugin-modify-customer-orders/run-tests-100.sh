#!/usr/bin/env bash
# Run `yarn test` 100 times, log each run, and summarize pass/fail.
# Usage: ./run-tests-100.sh [num_runs]
#   num_runs defaults to 100

set -u

RUNS="${1:-100}"
LOG_DIR="test-runs-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$LOG_DIR"

pass=0
fail=0
failed_runs=()

echo "Running 'yarn test' $RUNS times. Logs -> $LOG_DIR/"
echo

start_time=$(date +%s)

for i in $(seq 1 "$RUNS"); do
  printf "Run %3d/%d ... " "$i" "$RUNS"
  log_file="$LOG_DIR/run-$(printf '%03d' "$i").log"

  if yarn test >"$log_file" 2>&1; then
    pass=$((pass + 1))
    echo "PASS"
  else
    fail=$((fail + 1))
    failed_runs+=("$i")
    echo "FAIL  (see $log_file)"
  fi
done

end_time=$(date +%s)
elapsed=$((end_time - start_time))

echo
echo "===================================="
echo "Total runs : $RUNS"
echo "Passed     : $pass"
echo "Failed     : $fail"
echo "Elapsed    : ${elapsed}s"
if [ "$fail" -gt 0 ]; then
  echo "Failed runs: ${failed_runs[*]}"
fi
echo "Logs in    : $LOG_DIR/"
echo "===================================="

# Exit non-zero if anything failed, useful for CI
[ "$fail" -eq 0 ]
