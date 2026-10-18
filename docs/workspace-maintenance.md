# Workspace and one-off workflow maintenance

The one-off `privacy-history.yml` workflow now has only a manual
`workflow_dispatch` trigger. Editing or merging that file no longer triggers the
history-rewrite script automatically. This maintenance release does not run a
history purge. The existing script is unchanged.

The October 18, 2026 local workspace maintenance expands origin fetching to
`+refs/heads/*:refs/remotes/origin/*`, establishes local `main` tracking
`origin/main`, and points `origin/HEAD` to `origin/main`.

Clean worktrees are eligible for retirement only after their current HEAD is
confirmed as an ancestor of the fetched `origin/main`. Recheck status immediately
before removal, retain non-regenerable ignored files, use ordinary
`git worktree remove`, and delete a branch with `git branch -d` only after its
worktree is removed. Dependency directories, build output and Python bytecode
caches are reproducible. Dirty and unmerged worktrees stay in place. Commit IDs
that differ because of connector-created commits are not assumed merged merely
because their trees match.

The performed cleanup retired 14 clean, confirmed-merged worktrees and their
local branches. Changed tracked and untracked files in both older dirty
worktrees were fingerprinted before and after and remained byte-for-byte
unchanged. All unmerged branches/worktrees were retained. Remote branches were
not deleted; fetching prunes only stale remote-tracking references.

These operations reduce workspace clutter and repair tracking. They are not
evidence of a cause or a repair for ChatGPT streaming interruptions.
