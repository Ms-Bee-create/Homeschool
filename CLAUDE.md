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

## 16. Never title an assignment the same as a fixed UI block or feature name

The app has a small set of fixed, always-present daily block/feature names — currently
**"Show & Teach"** (the end-of-day reflection block) and **"Morning Launch"** (the mood/goal block).
An assignment titled the same thing as one of these creates a confusing "which one is real"
duplicate on the Today view and the printed/planner grid, even though they're two unrelated things.

**Before titling any assignment, check it doesn't start with or exactly match a fixed block name.**
If a lesson is genuinely about teaching something back to a family member, name it something else
that means the same thing — `"Teach-Back: ..."` is the established pattern here — never `"Show &
Teach: ..."`. Same logic for any other fixed block name introduced later.

## 17. Any collapsible UI (`<details>`, accordions, expand/collapse sections) must persist its open/closed state

The bug that triggered this rule: expanding a category in the Library tab collapsed itself again on
the next reload — the app rebuilds that whole view from scratch on every render/sync, and plain
`<details>` state lives only in that render cycle, so it silently resets. This is a general-purpose
UI mistake, not a one-off: any future collapsible section (a `<details>`, a custom accordion, a
"show more" toggle) will have the exact same bug unless its open/closed state is explicitly saved
and restored across re-renders and full page reloads.

**Use the existing helpers** (`detailsOpenKey()`, `isDetailsOpen()`, `setDetailsOpen()` — see the
Library tab's `familyLibrarySectionCard()` for the pattern) rather than inventing a new mechanism:
build a stable key, check it before setting `.open`, and write to it on the `toggle` event. Don't
ship a new collapsible section without wiring this in — a section that silently forgets it was
opened is confusing regardless of what the UI element actually is.

## 18. Lesson titles must tell the kid what they will do, and make them want to click

Never ship a title that is only a skill code, a subject name, or "Review: <something>" (the old
"🔁 Review: anna-math-place-value" is the example of what not to do). A title names the real topic and
promises something fun or concrete: "Place Value Boss Battle 🏆", "Can You Beat Mom at Story Elements? 🎮",
"Build a Faster Virtual Phone". Keep it kid-readable, keep it short, and still obey rule 16.

## 19. Every lesson has real instructions. A review day is a game day.

No lesson may be just a title (or a title and one quiz question). Each one needs a `passage` with what to
gather, the idea, and numbered steps. A review or practice-only day must give the kid a real game to play
(a card or dice game, a hands-on challenge, or a verified online game with an exact link under rule 1),
with the quiz as the check at the end. Missed-question reviews are made by `queueSkillReview`, which
builds the title, the game, and the instructions; never create an assignment that skips them. Group all of
a lesson's missed questions into ONE review lesson, not one lesson per question.

## 20. Parent-approved video sources

Mom checks the videos herself. Any link she pastes, including lists she copies from Gemini, is approved for use as given
(she has watched them; she confirmed every Gemini video she sends has been opened, so only flag one if it cannot be found or does not fit the lesson, and do not ask her to re-check); still use the exact video (rule 1) and make sure it fits the lesson. Never use a link nobody has
approved, and never fill in a link from memory.

Approved channel for Anna, use it in her lessons whenever it fits: Jack Hartmann Kids Music Channel,
https://www.youtube.com/channel/UCVcQH8A634mauPrGbWs7QlQ (link the exact video, never the channel page).

Approved videos, with what they are for (video id after `watch?v=`):
- Wiggles/wake-up, Anna: XJg2kdBJC5w Start the Day Song; CuI_p7a9VGs family favorite (Anna did it daily in kindergarten);
  cRYQ1EyGBOQ Grandpa's wake-up song; Xb29Js0wehg Have a Good Morning Song; QdRA3nQnc_4 Good Morning Song | Spread a Little Sunshine.
- Brain breaks, Ryan: TP8r4mbqNWg Minecraft Brain Break Party (Coach Corey Martin); juIAfUHTxfY Mario Turbo Run (Coach Corey Martin);
  EPuLgbXDmkw 9-Minute Morning Workout (Little Sports); 9u-QDciRueQ Fantastic 4 Multiverse Race (Teacher Mister Alonso).
- Anna math/ELA songs, not yet attached to a lesson (use when a matching lesson exists): Zt78cFS5isQ The Place Value Song (already on
  place value teach lessons and review games); TD_x3AFDjG8 Count by 2's and Move; nC1qgxHcV8k All Mixed Up, Multiply by Music (multiply by 2);
  c3yJhw7R3fI Eight Parts of Speech Review; RVpcZ5obmsM Money Song, Show Me the Money; K9_O0L96L-g Skip Counting by 25 to 200.
- Anna time, shapes, measuring, estimating (not yet on a lesson unless noted): w9QK_4vrnJ0 The Telling Time Song (Scratch Garden);
  Xwazo-_ePoA Hip-Hop Around the Clock, :15 :30 :45 (Jack Hartmann); Ux_kLd7qAcY Shapes! Mini Math Movies (Scratch Garden);
  ZnZYK83utu0 3D Shapes Song (spheres, cylinders, pyramids, cones, cubes); zPZegz690Mg 3D Shapes Song (Jack Hartmann);
  xnUkIsdvfGY Estimating! Mini Math Movies (Scratch Garden); https://scratchgarden.com/videos/measuring/ Measuring (Scratch Garden;
  already on the Design Studio "Measure the Room" lesson).
- Ryan computer videos: hI83ip_NejY How Do Computers Work? Computer Science for Kids Part 2 (aimed at K-2, a bit young for Ryan, not on a lesson);
  x9MEIEDDDSs What's Inside a Computer? (on Tablet Autopsy 4); 8Bsxnt81rEY How Computers Work: Hardware, Software & You (on Virtual Phones Lab 2);
  N9NWJ0426mo What is a CPU? (on Virtual Phones Lab 1); ODixEnhxYQs The First Operating System and Its Evolution (on the JohnnyOS "What is an operating system?" lesson).
- Anna, more approved videos (id after `watch?v=`). Time: t7B5FTxXwN0 Let's Learn About the Clock (Jack Hartmann); 65_c1CpfTjU Hip-Hop Around the Clock, quarter-after/half-past/quarter-till (Jack Hartmann).
  Fractions: 362JVVvgYPE Fractions! Mini Math Movies (Scratch Garden). Addition: 8hz0fAQV0ac Addition with Regrouping Song (Numberock); AMLRFww0qJg Fact Families Song (Numberock; on the Math Book Unit 1 fact families lesson).
  Reading/phonics/grammar: NpWHZJZQDSE Plot Mountain, the plot diagram song (Scratch Garden; on the ELA Story Elements teaching lesson); 6TkCqtBMHR8 Vowel Teams Song, diphthongs (Scratch Garden);
  LdCOswMeXFQ Punctuation Explained (Scratch Garden); NK8_Tvu6bJk Digraphs (Jack Hartmann); aPeMKdEzGDs Noun Rap (Jack Hartmann). (The Scratch Garden Nouns Song link is dead, do not use.)
  Geography/social studies: _pOKoIAnybg The Geography Song, Globe vs Map (Scratch Garden; on SS Chapter 3 Our Earth); 6Due3L2QeQM The Directions Song (Scratch Garden; on SS Chapter 3 All About Maps);
  Jd4kD9TicbA Goods and Services for Kids (Homeschool Pop; on SS Chapter 2 Producing and Consuming Goods).
  Ryan math: T5Qf0qSSJFI Math Antics, Place Value (about 9 min; on Ryan's Place Value lessons).
  Ryan math: ZeW3n4A8U9I What is Place Value? Up to 1,000,000 (Math & Learning Videos 4 Kids, 4 min; on Place Value Up to One Million); yzhATFwpJx0 Reading and Writing Whole Numbers (Khan Academy, 5 min; on the Three Forms lesson);
  TOrcUx0wDDQ Comparing Whole Numbers (Math Antics Extras, on the Comparing Numbers lesson); xCdxURXMdFY Area (Math Antics, on the Perimeter and Area of a Wall lesson); fd-E18EqSVk Rounding (Math Antics, about 7 min, on the Rounding lesson).
  Ryan math: vbGwcvXgDlg Khan Academy, Multiplying 2-digit by 1-digit numbers within 100, area model (about 2 min; on the 2-digit x 1-digit lesson).
  Ryan US History (Mom approved from Gemini, all on the pack "Ryan: US History"): mXE1l_7ytG8 Causes of the Revolution (Homeschool Pop); V9SQ4HxnWnM Battles of the Revolution (Colonial Williamsburg); pHVksFyfBks Founding Fathers (Learn Bright); ciNVYRS6pfY Articles of Confederation (Bowtie Guy and Wife); 9ZJBCC_8aV4 Constitutional Convention (Clarendon Learning); TCCP4MCy0Ck Louisiana Purchase (FreeSchool); wrOUnI94hwE War of 1812 (Learn Bright); Qi339ZKbw1c Jackson, the Cherokee and the Trail of Tears (History for Little Humans); b3OehwRHIlo Harriet Tubman and the Underground Railroad (Homeschool Pop); trrd5nbbGb4 Women's Suffrage for Kids (FreeSchool); ILc0nfzePT4 Civil War facts (KidsKonnect); S4kafzDJDxU Course of the Civil War (Bill of Rights Institute); HqKGsm8ptHw Abraham Lincoln biography (Bowtie Guy and Wife; on the Appomattox lesson); 1TSYQk0gyMA Abraham Lincoln (Kids Academy; on the Reconstruction lesson for the 13th Amendment only, it does not cover Reconstruction).
  Ryan US History gap videos (Mom approved from Gemini, 21 Oct 2026, not yet on lessons): 9Su_GPNrk5k French and Indian War (Bowtie Guy and Wife); QZwbnr4bPEc Boston Massacre (Bowtie Guy and Wife); wI3xnFMV5C4 Boston Tea Party (Learn Bright); iae8vfPfLeE Paul Revere (Learn Bright); O0rz-WOjR1k Patrick Henry, Liberty or Death (Liberty's Kids); 4KABNNlGGJc Benedict Arnold (Liberty's Kids); h7PVkGY4hhQ Black Soldiers of the Revolutionary War (History Kiddos); KEcLitMbgms Sitting Bull (Learn Bright); jU4oEL5yo50 The Alamo and the Texas Revolution (History for Little Humans); FDupOzHHsYU California Gold Rush (Little Patriots); 823DIYXhRWk Uncle Tom's Cabin book summary (Schooling Online); 2frdi5zjmYY John Brown (History Kiddos); FtD787nRFn4 Sherman's March (Bowtie Guy and Wife); ipZEyCgXAWk Jefferson Davis (Learn Bright); xiOZEQHWvF4 Stonewall Jackson (History Kiddos); AlYUDy-hJ3g Lincoln's Ten Percent Plan (History Kiddos; it is about Reconstruction under Lincoln, NOT the effects of the Civil War, so use it only for the Reconstruction plan); aJomU_0-prc Sharecropping (AJHSD 102 Social Studies, a school class video); 2JG9O0gewCE Jim Crow Laws (Little Patriots).
  Ryan Tech Pioneers, Cyber Lab, and Energy (Mom approved from Gemini, 21 Oct 2026, all on the pack "Ryan: Tech Pioneers, Cyber Lab, and Energy & the Atom"): PM9O7rk69Cw What Is A Computer Virus (Dr Binocs); QUhcUVmUOts Antivirus (SciShow Kids); emOSK-UPep8 Morris Worm (a 1-minute short); x_1t3HC8Lmo ILOVEYOU (Neo, 10 min; Mom watched it all, Ryan watches the whole video); gYrRIcrr02k Types of Hackers, white hat and black hat (PowerToFly Kids Tech); 5R7yrmbMYXI Steve Wozniak Remembers Building the First Apple Computer (Computer History Museum); ciKUGv_UmO8 How Jobs and Wozniak Built Apple (not on a lesson); Wf7YpAVuPp0 Bill Gates story (Visionary Kids); ORerqRQK9K8 Who Was Alan Turing (PastPorts Kids); -XTVT3lE7b8 Grace Hopper for Kids (Bedtime History); cOCbJc4e1QE Sources of Electricity (Clarendon Learning); uvhi4vju1TY Nuclear Energy, A Kid's Guide (SolarSchoolhouse); QR_Jk9lM6QU Nuclear Energy, Science for Kids (Learn Bright).
  Internet Archive (archive.org) is approved by Mom (22 Oct 2026) as the ONLY source of ISO files for Ryan's VM projects, so he is not sent to Google. The kid helper may give him a search link of the form https://archive.org/search?query=windows+98+iso and walk him through picking the result and the ISO IMAGE download, with a grown-up present before anything downloads. In lessons, link exact item pages only after they are verified (rule 1); never guess an archive.org item URL. Cyber Lab safety still applies: no real malware, no cracks or keygens, VMs only.
  Mom said (21 Oct) Ryan may watch the WHOLE of any approved video; do not add start times or "stop after" limits to his lessons.
  Anna math from Gemini (Mom checked, 21 Oct 2026; IDs taken from the single link given for each topic; only attach where the lesson fits, some may be too advanced): KKg0eu9_fsM Count to 120 by 5s (Jack Hartmann); z93bv49yCPY Count by 100s to 1000 (sent by Mom); EaRwrUvJTMs Comparing Lengths (Homeschool Pop); bmY28wdGL9M Graphs for Kids (Homeschool Pop); NqFamf2Ep9Y Measuring Length: Inches (Numberock); hAM8LEidWo4 How To Measure in Centimeters (Scratch Garden); dOljvsYXICQ Telling Time to the Nearest 5 Minutes (Homeschool Pop); LJyuw2JMV2g AM and PM (Homeschool Pop); gx_o2_oWgD4 Money and Making Change (Rock N Learn); 69lfTURDles Polygon Song (Have Fun Teaching); OnOIJFGAft4 Comparing 3-Digit Numbers (Numberock); vQOE-e39iu0 Repeated Addition Arrays (Khan Academy Kids); HB4A7AS50dM Number Patterns and Rules (Homeschool Pop, grade 3, a stretch for Anna); VeaPMq2U-NQ 3-digit subtraction with a zero in the middle (Rock N Learn, too advanced for now). Exact pages: https://numberock.com/lessons/triple-digit-addition-regrouping/ and https://numberock.com/lessons/subtraction-with-regrouping/ (Numberock lesson pages). Resolved by Mom 21 Oct: 5ilMfDtEroE is the Numberock Even and Odd Numbers Song; the Numberock subtraction lesson page (link above) is the subtraction video (on Anna's Trade Back lesson); for Patterns use the exact Scratch Garden page https://scratchgarden.com/videos/patterns/ (Mom clicked the citations, two video IDs Js45cR_7wFE and hKozk7JMgLw were given and which is Patterns is not certain, so use the page). Coin counting: no link from Gemini, use the approved Money Song RVpcZ5obmsM or ask again.
  Ryan micro:bit (Mom approved 21 Oct 2026): cYiuqTReF2E ElecFreaks Micro:bit Starter Kit video (on micro:bit Lab 1). Exact guide pages used as materials links: learn-en.readthedocs.io/en/latest/microbitKit/Starter_Kit/starter_kit_case_01.html, starter_kit_case_02.html, starter_kit_case_09.html, and /microbitKit/Wonder_Building_Kit/Case_02.html (official ELECFREAKS mirror; found by search). Ryan has used only the Retro Arcade kit; the Starter Kit and Wonder Building Kit are new to him. Robot Arm (Wonder Case 08) needs a Joystick:bit, not confirmed owned.
  Anna drawing (Mom approved from Gemini, 21 Oct 2026, all on the pack "Anna: Draw-Along Week"): DJqlLeD0EGA flower, RwPJnYdm91s teddy bear, zVSDUXPfqdY unicorn (all Super Simple Draw!); 2bkwLTMVLww SpongeBob SquarePants (Art for Kids Hub).
  Science: tzN299RpJHA Living Things (Jack Hartmann; on Science Book Unit 6 What Animals Need); dPHX_5l0gLE Awesome Insects & Amazing Bugs, a 21-minute Scratch Garden compilation (not on a lesson).

## 21. Operations notes

Supabase usage, the Nov 2026 plan email, what was already done to cut egress and logs, and the to-do list for 2027 are in `OPS_NOTES.md`.
Read it before changing how often either app talks to Supabase, and update it when the numbers change.

## 22. Safety: use good judgment

Keep every activity safe for a 7- and a 10-year-old. Family baking, warm (not hot) water, kid-safe scissors, and in-game Minecraft items are all fine (Mom confirmed). Use judgment on anything else: no real weapons or toy weapons used against people, no unsupervised stove or oven work, no sharp knives for the kids, and a grown-up nearby for anything hot. Stories and history that mention fire or tools are fine to read.

## 23. Handoff

`HANDOFF.md` has the full state of the project (who the kids are, how Mom works, repos and live URLs, code map, workflow, open work). Read it at the start of every session and update it
whenever something important changes, so nothing is lost when a conversation is compacted.

## 24. Standard tags are verified, never guessed

Every `standard` tag must be confirmed twice before it ships: (1) the code exists in Georgia's standards, and (2) its meaning matches what the lesson actually teaches (for example S2P1 is matter, so it does not fit a lesson about motion).
Use WebSearch to confirm, then add the code to `STANDARD_STATUS` in index.html as "verified". If it cannot be confirmed, do not guess: use a code already marked verified that truly fits, or ask Mom to check her alignment table.
Never reuse a tag just because an older lesson used it. The Leader "Standards check" card lists tags still unverified. See OPS_NOTES.md "Standards verification".

## 25. Images and video need a clear right to use

Crediting a source is not permission. Do not copy pictures from other websites into lessons, videos, or this repo (it is public), even with a credit line.
Only use: public-domain images (for example Library of Congress items whose Rights line says no known restrictions, or Wikimedia Commons items marked public domain), images under a Creative Commons license whose terms we follow (credit and any conditions), pictures Mom or the kids made or took, or drawings and diagrams made here (SVG).
Linking out to a page is fine. When a lesson needs a picture from a page, link to the page or recreate the idea as a drawing. For AI video (HeyGen), give it only images that meet this rule. Mom's HeyGen credits are shared with her business: ask first and stay inside the monthly budget she sets (150 credits for school in Oct 2026).


## 26. Keep the mess small

Mom and Dad run this day to day, and a pile of supplies every day becomes a huge cleanup. A hands-on lesson needs at most 3 supplies beyond what is always out (paper, pencil, crayons, a ruler). Prefer things already in the house, recycled things, and things the kid can put away alone. Do not schedule messy lessons (clay, paint, glue, food coloring, sand, soil, many small parts) back to back: at most one per week, with a clean-up step written into the lesson. Reuse the same supplies across several lessons when possible (one bag of beads, one egg carton). Cut-out pieces go in one labeled bag. Before adding a hands-on lesson, ask if drawing it, acting it out, or a Minecraft build would teach the same thing with no mess.


## 27. Video scripts leave the kids' names out

Mom may one day share some lesson videos with other homeschool families (a YouTube channel is an idea saved in HANDOFF.md). So every NEW video script (HeyGen, Synthesia, or any recording) must not say Ryan's or Anna's name, or show their faces, voices, or details that identify them. Address the viewer as "you" or "friend" ("Hey friend! Let's crack the Times-10 Machine."), and keep family details out (no "tell Mom", "your brother", home or town names): say "show a grown-up" instead. Keep the script about the idea, not about our family, so the video works for anyone. The two videos already made say "Hey Ryan!" and "tell Mom" (place value, recipe): they are for Ryan's lessons only and are not for sharing as they are. Rule 25 still applies to pictures, and check HeyGen's terms for commercial use before posting anything publicly.
