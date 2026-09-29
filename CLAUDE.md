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
