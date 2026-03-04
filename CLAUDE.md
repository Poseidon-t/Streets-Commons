# SafeStreets — Claude Agent Context

**Project:** SafeStreets by Streets & Commons — free neighborhood walkability tool.

---

## Before ANY task

Read `docs/claude/project-context.md` first. It has the current product state, accurate pricing, key files, and architecture. Ignore `LAUNCH_STATUS_FOR_CLAUDE.md` — it's outdated.

---

## Context by task type

**Doing UI / frontend work?**
→ Also read `docs/claude/design-rules.md`

**Writing or modifying code?**
→ Also read `docs/claude/coding-rules.md`

**Working on enterprise section (EnterpriseHome, Pricing, HowItWorks, ForRealEstate, ForGovernments, etc.)?**
→ Enterprise = custom dashboards and decisioning platform, NOT field audits or consulting. Read `docs/claude/coding-rules.md` for the enterprise constraint.

**Working on blog, ContentQueue, BlogManager, InfographicGenerator?**
→ Admin is gated by ADMIN_USER_ID env var. Blog images use a static bank (no UNSPLASH_ACCESS_KEY). Read `docs/claude/project-context.md` section on admin.

**Touching pricing anywhere (UI copy, FAQs, schema, llms.txt)?**
→ Core tool: free. Agent reports: $49 one-time (first 3 free). Enterprise: custom inquiry. No other pricing exists.

---

## After compaction / resuming a session

1. Re-read `docs/claude/project-context.md`
2. Re-read the file(s) you were last working on
3. Then continue — do not assume context from before compaction
