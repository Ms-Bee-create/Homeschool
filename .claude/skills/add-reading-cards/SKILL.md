---
name: add-reading-cards
description: Turn a long reading page into 4-6 picture cards with a listen button in Forge Academy. Use when Mom sends a long reading (history, science) a kid skips or struggles with.
---
# Add reading cards

1. Get the page text from Mom (the sandbox often cannot fetch sites). Do not invent facts; use only what the page says.
2. Write 4-6 cards, one idea each: a short heading, 1-3 short lines, and a `say` string that reads the card aloud (plain words, numbers spelled so speech reads them well).
3. Use only text and simple shapes (the `.xc-row`, `.xc-b`, `.xc-big`, `.xc-bar` classes). No copied images (CLAUDE.md rule 25).
4. Add an entry to `EXPLAINER_CARDS` in index.html (above `speakerBtnHtml`): `{match:"start of the lesson title", cards:[{say, html}, ...]}`. Match uses `indexOf(...)===0` on the title.
5. Syntax-check every `<script>` with node, then follow the `ship-academy-change` skill.
6. Tell Mom which lesson now shows "Too many words? See it in N quick cards".
No SQL, no credits, no uploads. See HANDOFF.md "Picture cards".
