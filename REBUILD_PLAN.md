# Forge Academy family rebuild plan

Planning draft, 6 November 2026. This document records decisions; it does not deploy changes or replace the current app. Older handoff documents describe the existing system and may conflict with these newer family decisions.

## Purpose and boundaries

Help Anna and Ryan learn with less continuous adult supervision, clear demonstrations, supported mistakes, and meaningful evidence of effort. Protect Mom's 10–11 work hour. Independence is a skill to teach and trial, not a guaranteed outcome from software.

Preserve curriculum, learning profiles, records, money balances, holidays, Ryan's weekly project picker, and both Forge Worlds. Reorganize delivery before rewriting lessons. Keep a plain My Day view available alongside the world. Merge kid-facing school and Momma Money/Home Quest experiences; the banker belongs in the separate parent profile, with no parent-area tile on child home screens.

## Daily rhythm

| Time | Purpose |
| --- | --- |
| 9–9:15 | Launch, inspect today's quests, prepare materials and ask questions |
| 9:15–9:50 | Adult-supported instruction on new or difficult skills |
| 9:50–10 | Movement and prepare the independent block |
| 10–11 | Protected independent block: short visual demonstrations, familiar practice, prepared project steps, movement breaks, and a help ladder |
| 11–11:15 | Parent review window one; address questions and adjust remaining work |
| 11:15–12 | Continue learning and project work |
| 12–12:30 | Proposed lunch and movement slot |
| 12:30–1:25 | Application, remaining essential work, and Home Quest |
| 1:25–1:40 | Parent review window two |
| 1:40–1:45 | Reset materials and preview tomorrow |
| 1:45–2:45 | Outside time |
| 2:45–3 | Snack and transition |
| 3–4 | Forge World reward/free play after the agreed responsibilities and checks |
| Before 7 | Dinner and evening Home Quest |
| 7–8:30 | Regular evening screen allowance after responsibilities |

Lunch and individual learning-block lengths are proposed defaults. Existing family commitments and holidays remain intact. The 10–11 block is not an hour of passive video: use short lessons and visible practice. Prepare tasks before 10; avoid introducing unsupported new skills then. Pilot the block and build independence gradually. Genuine difficulty or an unresolved parent review must not become a punishment.

Anna: short concrete tasks, read-aloud support, manipulatives, clear pictures, and teacher/stuffie activities. Ryan: longer project focus, clear stopping points, visible requirements, and his weekly project choice. Both need movement and a clear next action.

## Learning and completion

- Each lesson offers See It, Try With Me, and Your Turn. Demonstrate the exact skill with animation, a worked example, or a verified direct video link. Start with a long-division widget prototype for Ryan and an appropriate concrete math example for Anna.
- Show one instruction at a time, necessary materials, an expected result, and the smallest useful hint. Offer a worked example, a simpler attempt, and an Ask for Help queue.
- Distinguish draft, submitted, needs help, needs another attempt, and reviewed work. Checking a box cannot approve work, issue duplicate rewards, or unlock unrestricted play.
- Completion means the required attempt and evidence are present; it does not require perfect answers. Feedback explains a next step and treats mistakes as information.
- Use deterministic checks for structured answers; AI assists with open responses. Sample automated decisions during parent reviews. Unclear images/audio go to a parent, with the original evidence available.
- Transcribe audio once per changed recording and reuse the transcript. Test both children's voices and real device recordings before relying on transcription. Keep retries bounded.
- Parent reviews present one combined queue across children, with the question, evidence, checker reasoning, and a simple next action. Do not require continuous monitoring between windows.

## Weekly planning

Use reusable weekday rhythms and estimated duration rather than filling a lesson-count quota. Preserve prerequisite order, essential math/reading goals, spaced review, breaks, and holiday exceptions. Integrate project-linked subjects into a single work block where appropriate without losing their learning-goal tags. Ryan's picker schedules only his selected project's tasks.

Generate a proposed week from the existing lesson backlog and goals. Flag missing instruction, broken resources, unavailable materials, and overloaded days before publishing. Carry unfinished work deliberately; do not endlessly push every item into tomorrow. Keep parent override and a clear reason for schedule changes.

## Home Quest and Forge World

Read the actual live Home Quest list before mapping chores into the day. Preserve job history, balances, and approval settings. Morning, school-day reset, and evening quests appear where the kids already work. Move any 7:30 preparation chores before the evening screen window. Do not invent a replacement chore list.

Preserve the existing world's appearance, builds, inventory, and learning games. During school, the world guides learning quests. Free play follows scheduled breaks and the agreed afternoon/evening windows. Reward eligibility must use trusted submission/review and responsibility records, not a child-controlled done flag. Learning checks can earn acknowledgment for effort without opening unrestricted play. Resolve unspent previously purchased screen minutes with the parent before changing that ledger; do not erase them.

## Shared live visibility and deployment

Keep GitHub as the shared source of code and Supabase as the current backend. A database migration is not required for live access. Separate the production site from an isolated preview using synthetic data initially. Keep the live family data out of public previews and repositories.

Build a small authenticated, household-scoped inspection interface, with client-specific credentials and read-only access by default. It should expose deployed build identity, effective schedules including project choices and overrides, Home Quest configuration, and necessary work/review state. Sensitive media access must be short-lived and limited to the review task. Mutations and deployments are separate capabilities with an audit trail. Never expose a service-role key to the browser or assistant chat.

Test access from the actual ChatGPT and Claude Code clients before declaring this solved. Hosting does not automatically connect either assistant. If a client's tool/auth support blocks the preferred interface, document the limitation and choose a supported adapter before committing to a platform.

## Recovery and costs

Before migration: take a fresh verified data/media backup, include Home Quest tables and related Momma Money records, and capture device-local world data. Rehearse restoration in isolation, including schema and policies. A Git rollback alone cannot restore database changes or device-local builds. Keep additive migrations and a release rollback procedure; preserve the old app until the pilot succeeds.

Keep the existing Supabase plan initially. The supplied usage snapshot shows 1.06/5 GB egress, 35/500 MB database, and 0.01/1 GB storage; usage resets on the 15th. These figures are a snapshot, not a forecast. Avoid whole-database polling, duplicate media downloads/uploads, and repeated AI reviews.

Initial target: $5/month for added API costs, not an authorization to buy subscriptions or provision paid infrastructure. Google AI Plus is the current subscription; do not count on Pro-only Cloud credits. Track transcription and AI-checking costs together. Use an app-side monthly allowance, recording limits, cached results, bounded retries, and alerts before the target. Cloud billing alerts alone are not spending caps; account for delayed reporting and concurrent requests. When the allowance is reached, retain submissions and queue parent review rather than block school or lose work. Show Supabase usage separately.

## Implementation order and acceptance

1. **Recovery inventory and shared visibility.** Verify backups cover all three domains (school, money/quests, worlds); prove isolated restore. Both assistants must identify the deployed build and retrieve the same effective daily schedule as the parent sees. No public family data.
2. **Daily-flow prototype.** Use synthetic Anna/Ryan accounts to demonstrate a full day, Home Quest, project choice, help queue, two parent reviews, and time-limited world access. Preserve existing content. Validate on the children's device types.
3. **Evidence and visual teaching.** Add structured work states, reliable saving, transcript support, image review fallback, and initial visual widgets. Test offline/retry behavior, duplicate requests, self-check unlock attempts, and uncertain AI decisions.
4. **Reusable weekly planning.** Add duration/prerequisite-aware scheduling and goal coverage without re-authoring the curriculum. Preview a normal week and holiday week; ensure only the chosen project is scheduled.
5. **Family pilot and staged release.** Trial a day with each child; measure help requests, unclear instructions, workload, save reliability, and API consumption. Adjust before a full week. Confirm recovery and preserve the current app until the replacement is proven.

First implementation deliverable is the recovery/visibility proof and a reviewable preview, not a wholesale production replacement. Existing safe-saving work is a parked draft to assess and integrate after these decisions; it has not been deployed.
