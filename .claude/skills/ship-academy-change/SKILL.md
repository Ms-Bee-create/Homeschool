---
name: ship-academy-change
description: The steps to edit, check, and merge a change to Forge Academy (index.html) on its working branch. Use for every code or content change to this repo.
---
# Ship a change

1. Read HANDOFF.md and CLAUDE.md first (rules 1-25).
2. `git fetch origin main && git checkout -B claude/academy-log-games-review-d51b0s origin/main` (recreate each time; an earlier squash-merge makes the old branch stale).
3. Edit index.html with a Python script that asserts each target string occurs exactly once before replacing.
4. Syntax check: extract every inline `<script>` and run `node --check` on each.
5. Update HANDOFF.md if something important changed.
6. Commit with the trailers `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` and the `Claude-Session:` line. `git push --force-with-lease -u origin claude/academy-log-games-review-d51b0s`.
7. Create the PR with the github MCP (title, short body, session link) and squash-merge it. If GitHub reports a conflict, reset the branch to origin/main and cherry-pick the new commit.
8. Tell Mom: Pages deploys in 1-2 minutes, then hard refresh (Ctrl+Shift+R) or reload the app. Say what you could not test (the sandbox cannot reach the live app or Supabase).
If a change needs SQL or an Edge Function redeploy, give Mom the exact steps; never paste service_role keys.
