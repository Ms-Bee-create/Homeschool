# Forge Academy — Content Authoring Rules

This file is loaded automatically at the start of every session on this repo. The rules below are
not optional style preferences — they were established after real mistakes shipped to real kids
(Anna, 7, and Ryan, 9-10) and are backed by the learning-science research logged in the
[Forge Academy Roadmap](https://claude.ai/artifact/BcVFhRpTiJ7n49PrRcsDRp) artifact's Research tab.
Follow them on every `materials`, `video`, `passage`, and `quiz` field added to any assignment, for
either kid, no exceptions.

## 1. Every link must go to the exact thing, never a homepage or a "browse and pick" page

The mistake that triggered this file: two links for Anna pointed at bare site homepages
(`georgiaencyclopedia.org`, `toytheater.com`) instead of the specific article/tool the lesson
described, and two more pointed at "browse our whole catalog and figure out which one" listing
pages (`mathlearningcenter.org/apps`, `storylineonline.net`). A young kid cannot self-navigate a
site to find "the right one" — that's an adult skill, not a 2nd/4th-grade one.

**Before adding any `materials` or `video` URL:**
- The URL must land directly on the specific article, video, or tool the lesson names — not the
  site's root domain, not a category/listing page, not a search-results page the kid has to filter.
- If you can't find the exact page, say so and ask, or pick something else you *can* verify exactly
  — never ship a "close enough, she can browse from there" link.
- Verify every URL with WebSearch before using it. Never guess or reuse a URL from memory without
  re-checking it's the exact page, even if you've used that domain before. Fabricated or unverified
  URLs are the single worst failure mode in this app's history — see the "Gemini-fabricated URLs"
  disaster referenced in earlier session logs.
- When a lesson's passage text references "the link above," name the specific thing the link goes
  to as well ("watch Clark the Shark, read by Chris Pine" — not just "click the link above").

## 2. Explicit instruction and a worked example before independent practice — always

Never write a lesson that hands a kid an unguided task on a brand-new skill with no worked example
first. Cognitive load research is unambiguous here: novices who attempt problems cold, without
seeing one fully solved first, overload working memory and often practice the wrong approach.

Every new skill's first lesson (`stage:"teach"`) must include a passage that either:
- Shows one fully worked example (a problem solved step-by-step), or
- Is a clear, concrete explanation of the idea in the kid's own frame of reference (like the
  buttons-into-tens example for place value).

Practice/apply days can be more open-ended — but the *first* exposure to a new skill never is.

## 3. Pair a concrete/hands-on element with every new math or science skill

Both kids are at ages where abstractions land better with something to touch, draw, count, or
measure attached (Anna is concrete-operational; Ryan's executive function is still maturing).
Every new Skill Block's apply stage should have a physical or drawable task — not just another
tap-to-answer quiz. Pure quiz-only "apply" stages are a sign the lesson wasn't finished.

## 4. Never fabricate a URL, a fact, a quote, or a standard code

Applies to everything: tutorial links, GA Standards of Excellence codes, historical facts inside
quiz questions or passages, YouTube video URLs. If you're not certain, verify with WebSearch before
shipping. A wrong link or a made-up fact is worse than no content at all — it teaches wrong things
or breaks a kid's trust in the app.

## 5. Explain *why* on every missed quiz question

Every quiz question should carry an `explain` field — one sentence on why the correct answer is
correct, shown immediately when a kid misses it (via the Mastery Loop's explain-on-miss feature).
A miss with no explanation, just a reworded retry, is a missed teaching moment.

## 6. Standard tags are mandatory, not optional, on every assignment

Every assignment needs a `standard` field pulled from the relevant kid's real GA Standards of
Excellence alignment table (in their curriculum docs). Missing standards silently break the
Annual Progress Report and the year-end CSV export — this already happened once (24 of Ryan's 100
Retro OS Museum assignments were missing tags) and should never happen again on new content.

## 7. Age-appropriate pacing: prefer spaced/interleaved practice over long single-topic blocks

Per the Mastery Loop research (see roadmap Research tab, sections R1 and R4): don't plan a full
month of new content on one single standard. A tighter ~2-week concentrated arc (teach → practice
→ mixed/interleaved → apply), followed by moving to the next standard, works better than prolonged
single-skill drilling — the spaced review queue (`queueSkillReview`) keeps older skills alive
afterward, so nothing needs re-teaching from scratch, just periodic resurfacing.

## 8. Before shipping any batch of new content, do a self-check pass

After writing a batch of lessons (a Skill Block, a new World, a month of curriculum), before
committing: re-read every `materials`/`video` URL in the batch and ask "if this kid clicked this
link with zero other context, would they land exactly where the lesson says they will?" If the
answer is "probably, but they'd have to look around a bit" — that's a fail. Fix it before shipping,
not after a kid reports it broken.

## 9. There's no such thing as "a visual kid" or "an auditory kid" — don't design around it

Learning styles (visual/auditory/kinesthetic) are a well-debunked myth — matching instruction to a
kid's supposed style produces zero measurable benefit. Never justify a content decision with "she's
more of a visual learner" or similar. The real question is always "what method fits *this content*,"
not "what fits this kid's style" — and per Rule 10, the answer for anything explainable is usually
both words and a picture, for both kids, always.

## 10. Pair words with a picture, video, or diagram — for everyone, always

Dual coding (visual + verbal together) beats either alone for every learner, not just one kid or
the other. A listen button is not a style accommodation for Anna specifically — audio + text/visual
together is simply better for any lesson where it's feasible. Don't frame it as "Anna's thing."

## 11. No failing state, ever — low-stakes and retryable beats anything that feels like a graded test

High-stakes testing measurably raises anxiety in elementary kids; low-stakes/gamified quizzing
lowers it while performance holds or improves. Every quiz needs a retry path and never blocks
progress on a wrong answer. Don't add a "real grade," a pass/fail gate, or a visible score/ranking
against other kids to any assessment — that undoes a foundational, evidence-backed design choice.

## 12. Interleave practice — mix problem types, don't block them

A practice set that's all one problem type in a row is weaker than a mixed set — interleaving forces
a kid to choose the right strategy instead of just repeating the last one. Once a Mixed/Review stage
pulls in more than one skill (see `queueSkillReview`), actually mix the question order — don't group
all of skill A's questions before all of skill B's.

## 13. Hands-on only counts if the object actually represents the concept

A manipulative that doesn't clearly map to the idea can actively confuse a kid, not help one — this
isn't "any craft satisfies Rule 3." Before adding a hands-on apply-stage task, check that the
physical thing (buttons for place value, a drawn map for geography, base-ten blocks) is a direct,
legible stand-in for the concept, not just an activity that happens to be hands-on.

## 14. Projects reinforce — they don't replace teaching the underlying skill

Project-based learning has real but genuinely mixed evidence for core academic gains specifically
(strong for motivation and applied skill, weaker than its reputation for teaching new facts/skills
from scratch). Never let a project (Bug Hotel, a Minecraft build, a capstone) stand in for a `teach`
stage — the skill still needs direct instruction first; the project is the `apply` stage after.

## 15. A quiz isn't the only way to check understanding — and doesn't need to be the default

Real, evidence-backed alternatives: teach-back ("explain it to Mom/Alexa"), a portfolio artifact
(photo of the build, a journal entry), a short project demo, or an elaborative-interrogation prompt
("why do you think that happened?" — works best once there's some background knowledge, so lean on
it more for Ryan than for Anna's brand-new topics). Default every `apply`/`mixed` stage toward a
"Show What You Know" menu of options like this rather than only ever generating another quiz.
