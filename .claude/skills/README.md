# Moldlane team skills

Internal Claude Code skills for the Moldlane team's own sales and
operations workflow. **These are not part of the Moldlane product** —
they never ship to the app, and customers never see them.

## How the team accesses these

Skills are just files in this repository. Anyone who can clone the repo
can use them:

1. Clone/open this repo in **Claude Code** (CLI, desktop app,
   claude.ai/code, or the IDE extensions).
2. Claude automatically discovers the skills in `.claude/skills/`.
3. Invoke by name — e.g. type `/qualify-service-business` — or just ask
   naturally ("qualify this garage for me") and Claude applies the
   matching skill.

Access control is **GitHub repo access**, nothing else. There is no
@moldlane.com email gate and no admin dashboard involved — if a
teammate can see the code, they can use the skills. To restrict them,
restrict repo access.

## The skills

| Skill | Use it when |
|---|---|
| `qualify-service-business` | Deciding whether a trade business is worth a sales visit — scores against the ICP in `docs/STRATEGIC_AUDIT.md` §4, returns QUALIFY / NURTURE / PASS with pitch math. |
| `pre-visit-brief` | Before a sales visit/call — public-sources research brief with talking points and recovered-revenue math. |
| `playbook-message` | Writing customer-facing WhatsApp template copy for the reactivation / service-due / review playbooks — Meta-compliant, opt-out baked in, in the business's voice. |
