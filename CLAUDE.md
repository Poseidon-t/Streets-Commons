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

## Build & Test
- Install: `npm install`
- Dev: `npm run dev` (concurrent API + Vite)
- Build: `npm run build` (tsc + vite build)
- Lint: `eslint .`
- Test: `vitest`
- Server only: `node api/server.js`

## Safety Rails
### NEVER
- Modify `.env`, `railway.toml`, or CI secrets without explicit approval
- Re-introduce removed features (email capture, Reddit monitor, custom analytics, $19/$99 tiers, AI chatbot, advocacy letters)
- Commit without running `npm run build` and `eslint .`
- Mix Consumer and Enterprise design modes
- Change pricing from: Free core / $49 Agent Reports / Custom Enterprise

### ALWAYS
- Show diff before committing
- Run `npx tsc --noEmit` after TypeScript changes
- Verify score display uses 0–10 (internal 0–100 ÷ 10)

## Verification
For backend changes (`api/server.js`):
- `node -c api/server.js` (syntax check)
- Test health endpoint responds

For frontend changes:
- `npx tsc --noEmit` passes
- `eslint .` passes
- `npm run build` succeeds

Definition of done:
- All above checks pass
- No removed features re-introduced
- No TODO left behind unless explicitly tracked

## Compact Instructions
When compressing, preserve in priority order:
1. Architecture decisions (NEVER summarize away)
2. Modified files and their key changes
3. Current verification status (pass/fail)
4. Open TODOs and rollback notes
5. Tool outputs (can drop, keep pass/fail only)

## Session Handoff
Before ending a long session, write a `HANDOFF.md` in the project root:
- What was attempted, what worked, what didn't
- Files modified and their current state
- Open issues or next steps
- Any rollback instructions if changes are incomplete

The next session should start by reading `HANDOFF.md` instead of relying on compression.

## Plan Mode
Use Plan Mode (double-tap Shift+Tab) before:
- Refactors that touch multiple modules
- Cross-cutting changes (e.g., updating score calculation across components)
- Any change where a wrong assumption baked into execution would be expensive to undo

Stay read-only during planning. Confirm the plan before executing.

## After compaction / resuming a session

1. Check for `HANDOFF.md` — if it exists, read it first
2. Re-read `docs/claude/project-context.md`
3. Re-read the file(s) you were last working on
4. Then continue — do not assume context from before compaction
