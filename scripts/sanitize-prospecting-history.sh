#!/usr/bin/env bash
set -euo pipefail
# Authorized by the October 9 suite update plan. Preserve all other history.
test -z "$(git status --porcelain)"
python3 - <<'PY'
from pathlib import Path
for name in ['prospecting-command-center.html', 'chambers-wealth-hq.html']:
    if Path(name).read_bytes().count(b'linkedin.com/in/') > 10:
        raise SystemExit('Refusing to preserve a page containing contact records')
PY
task_privacy_copy=$(mktemp -d)
cp prospecting-command-center.html chambers-wealth-hq.html "$task_privacy_copy/"
git checkout --detach
git fetch origin '+refs/heads/*:refs/heads/*' '+refs/tags/*:refs/tags/*'
git for-each-ref --format='%(refname) %(objectname)' refs/heads refs/tags > "$task_privacy_copy/leases"
FILTER_BRANCH_SQUELCH_WARNING=1 git filter-branch --force --prune-empty --index-filter 'git rm -q --cached --ignore-unmatch prospecting-command-center.html chambers-hq.html chambers-wealth-hq.html' --tag-name-filter cat -- --all
git checkout main
cp "$task_privacy_copy/prospecting-command-center.html" "$task_privacy_copy/chambers-wealth-hq.html" .
git add prospecting-command-center.html chambers-wealth-hq.html
git -c user.name='Atlas maintenance' -c user.email='atlas-maintenance@users.noreply.github.com' commit -m 'Restore safe dashboard shells after prospecting history removal'
task_privacy_args=()
while read -r task_privacy_ref task_privacy_old; do
  task_privacy_args+=("--force-with-lease=$task_privacy_ref:$task_privacy_old" "$task_privacy_ref:$task_privacy_ref")
done < "$task_privacy_copy/leases"
git push --atomic origin "${task_privacy_args[@]}"
echo 'Affected prospecting paths removed from branch and tag history; safe current shells restored.'
# GitHub-controlled PR refs and caches require GitHub Support to purge.
