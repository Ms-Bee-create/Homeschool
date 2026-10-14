---
name: verify-standard
description: Confirm a Georgia standard code before tagging a lesson (CLAUDE.md rule 24). Use whenever a lesson needs a standard tag, or the Leader Standards check card lists an unverified tag.
---
# Verify a standard tag

Never guess a code. Two checks, both required:
1. The code exists in Georgia's standards (WebSearch: GaDOE or a Georgia-aligned source).
2. Its meaning matches what the lesson actually teaches (for example S4P3 = forces and motion; 4.MDR.6.1 = four operations with measurements; 4.MDR.6.2 = answer questions from data and graphs; 4.MDR.6.3 = dot plots).
Then add the code to `STANDARD_STATUS` in index.html as "verified" (use "exists" only if the code is real but the fit is unconfirmed). For an existing lesson, also add `title: code` to `STANDARD_TAG_FIXES`.
If it cannot be confirmed, use a code already marked verified that truly fits, or ask Mom to check her alignment table. Sources can disagree on numbering (the 14 Oct 2026 search could not confirm what 4.GSR.8.3 means, and one source numbers area/perimeter 4.GSR.7), so say so instead of picking one silently.
Record anything new in OPS_NOTES.md "Standards verification".
