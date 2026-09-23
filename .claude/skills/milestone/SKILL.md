---
name: milestone
description: Run one task from docs/TASKS.md (or a whole roadmap milestone) end to end — plan, branch, implement, review, and open a PR.
disable-model-invocation: true
argument-hint: <T0..T5 | M1..M6>
---

Run $ARGUMENTS end to end. A task ID (`T<N>`) refers to a section of
docs/TASKS.md; a milestone ID (`M<N>`) refers to a section of
docs/ROADMAP.md.

1. Read the `$ARGUMENTS` section of docs/TASKS.md (or docs/ROADMAP.md
   for a milestone) and list its acceptance criteria back to the user.
2. Write an implementation plan (plan mode) and get it approved before
   editing anything.
3. Use the branch named in docs/TASKS.md. If it does not exist yet,
   create it from `main` (`git switch -c <type>/m<N>-<slug>`); if it
   does, switch to it. Tasks of the same feature share one branch.
4. Implement in small steps, verifying each one (typecheck/lint/test/
   boundaries) before moving to the next.
5. Once every check passes, launch the `spec-reviewer` subagent against
   the branch diff.
6. Fix only what `spec-reviewer` flags as affecting correctness or a
   requirement — not style preferences.
7. Update the task's status in docs/TASKS.md. Tick a milestone's
   checkboxes in docs/ROADMAP.md only when this is the last task of that
   milestone (that is also when the branch's PR is opened). If any new decision was made along the way, add or update
   the matching ADR in docs/DECISIONS.md.
8. Commit (Conventional Commits). Run `gh pr create` only when the
   last task on the branch is done. The PR
   description must address each acceptance criterion individually and
   include the test evidence (command output) proving it.
