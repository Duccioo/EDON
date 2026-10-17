# Skill locali di EDON

Le skill sono installate in `.agents/skills`, nel solo progetto. Saranno disponibili dal prossimo turno di Codex. I file upstream sono conservati senza modifiche, inclusi i file di supporto. Non sono stati attivati hook o installati plugin globali.

## Fonti e versioni

- [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail) — commit `742e0abae1501e12d1254a81d05f16bba10d08c1`; 6 skill.
- [anthropics/skills](https://github.com/anthropics/skills) — commit `dbd4588f9e1033efb41dad4bef2f7947c8993d44`; 1 skill.
- [mattpocock/skills](https://github.com/mattpocock/skills) — commit `49dd158d1076134a641b33efb035946536778336`; 38 skill.

Versioni e SHA-256 dei singoli file: [skills-lock.json](../.agents/skills-lock.json). Licenze: [.agents/skill-licenses](../.agents/skill-licenses).

## Uso nel progetto

Usare `ponytail` per mantenere il codice semplice e riusare soluzioni esistenti; `frontend-design` per la direzione visiva; `codebase-design`, `domain-modeling` e `improve-codebase-architecture` quando serve progettare moduli e confini. Le altre skill si applicano alle rispettive attività.

L’installazione non esegue i workflow delle skill: configurazione dei tracker, hook Git, migrazioni e altre utility richiedono un’attività pertinente.

La priorità di EDON resta il desktop interattivo, personalizzabile e persistente, verificato visivamente usando `docs/visual-references`. Obsidian e MCP vengono dopo questo traguardo.

## Inventario

| Skill | Fonte | Categoria upstream |
| --- | --- | --- |
| [ponytail-audit](../.agents/skills/ponytail-audit/SKILL.md) | DietrichGebert/ponytail | ponytail |
| [ponytail-debt](../.agents/skills/ponytail-debt/SKILL.md) | DietrichGebert/ponytail | ponytail |
| [ponytail-gain](../.agents/skills/ponytail-gain/SKILL.md) | DietrichGebert/ponytail | ponytail |
| [ponytail-help](../.agents/skills/ponytail-help/SKILL.md) | DietrichGebert/ponytail | ponytail |
| [ponytail-review](../.agents/skills/ponytail-review/SKILL.md) | DietrichGebert/ponytail | ponytail |
| [ponytail](../.agents/skills/ponytail/SKILL.md) | DietrichGebert/ponytail | ponytail |
| [frontend-design](../.agents/skills/frontend-design/SKILL.md) | anthropics/skills | design |
| [ask-matt](../.agents/skills/ask-matt/SKILL.md) | mattpocock/skills | engineering |
| [code-review](../.agents/skills/code-review/SKILL.md) | mattpocock/skills | engineering |
| [codebase-design](../.agents/skills/codebase-design/SKILL.md) | mattpocock/skills | engineering |
| [diagnosing-bugs](../.agents/skills/diagnosing-bugs/SKILL.md) | mattpocock/skills | engineering |
| [domain-modeling](../.agents/skills/domain-modeling/SKILL.md) | mattpocock/skills | engineering |
| [grill-with-docs](../.agents/skills/grill-with-docs/SKILL.md) | mattpocock/skills | engineering |
| [implement-spec](../.agents/skills/implement-spec/SKILL.md) | mattpocock/skills | engineering |
| [implement](../.agents/skills/implement/SKILL.md) | mattpocock/skills | engineering |
| [improve-codebase-architecture](../.agents/skills/improve-codebase-architecture/SKILL.md) | mattpocock/skills | engineering |
| [pr](../.agents/skills/pr/SKILL.md) | mattpocock/skills | engineering |
| [prototype](../.agents/skills/prototype/SKILL.md) | mattpocock/skills | engineering |
| [research](../.agents/skills/research/SKILL.md) | mattpocock/skills | engineering |
| [retro](../.agents/skills/retro/SKILL.md) | mattpocock/skills | engineering |
| [setup-matt-pocock-skills](../.agents/skills/setup-matt-pocock-skills/SKILL.md) | mattpocock/skills | engineering |
| [tdd](../.agents/skills/tdd/SKILL.md) | mattpocock/skills | engineering |
| [to-spec](../.agents/skills/to-spec/SKILL.md) | mattpocock/skills | engineering |
| [to-tickets](../.agents/skills/to-tickets/SKILL.md) | mattpocock/skills | engineering |
| [triage](../.agents/skills/triage/SKILL.md) | mattpocock/skills | engineering |
| [wayfinder](../.agents/skills/wayfinder/SKILL.md) | mattpocock/skills | engineering |
| [wizard](../.agents/skills/wizard/SKILL.md) | mattpocock/skills | engineering |
| [chief-of-staff](../.agents/skills/chief-of-staff/SKILL.md) | mattpocock/skills | in-progress |
| [claude-handoff](../.agents/skills/claude-handoff/SKILL.md) | mattpocock/skills | in-progress |
| [loop-me](../.agents/skills/loop-me/SKILL.md) | mattpocock/skills | in-progress |
| [setup-ts-deep-modules](../.agents/skills/setup-ts-deep-modules/SKILL.md) | mattpocock/skills | in-progress |
| [writing-beats](../.agents/skills/writing-beats/SKILL.md) | mattpocock/skills | in-progress |
| [writing-fragments](../.agents/skills/writing-fragments/SKILL.md) | mattpocock/skills | in-progress |
| [writing-shape](../.agents/skills/writing-shape/SKILL.md) | mattpocock/skills | in-progress |
| [git-guardrails-claude-code](../.agents/skills/git-guardrails-claude-code/SKILL.md) | mattpocock/skills | misc |
| [migrate-to-shoehorn](../.agents/skills/migrate-to-shoehorn/SKILL.md) | mattpocock/skills | misc |
| [scaffold-exercises](../.agents/skills/scaffold-exercises/SKILL.md) | mattpocock/skills | misc |
| [setup-pre-commit](../.agents/skills/setup-pre-commit/SKILL.md) | mattpocock/skills | misc |
| [grill-me](../.agents/skills/grill-me/SKILL.md) | mattpocock/skills | productivity |
| [grilling](../.agents/skills/grilling/SKILL.md) | mattpocock/skills | productivity |
| [handoff](../.agents/skills/handoff/SKILL.md) | mattpocock/skills | productivity |
| [teach](../.agents/skills/teach/SKILL.md) | mattpocock/skills | productivity |
| [to-questionnaire](../.agents/skills/to-questionnaire/SKILL.md) | mattpocock/skills | productivity |
| [wait-what](../.agents/skills/wait-what/SKILL.md) | mattpocock/skills | productivity |
| [writing-for-agents](../.agents/skills/writing-for-agents/SKILL.md) | mattpocock/skills | productivity |
