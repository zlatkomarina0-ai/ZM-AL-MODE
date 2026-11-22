# ZLATKO AI MODE — 12 roles / 3 teams

This module is the code representation of the agreed three-team design.

## Team 1 — Reconnaissance and investigation
Eagle, Falcon, Monkey, Rabbit, Fox, Wolf.

1. Eagle and Falcon scan a match and flag unusual signals.
2. Rabbit scouts first and collects potential evidence; Monkey performs the defined watch/distraction role.
3. If findings justify escalation, Fox and Wolf join. All six roles collaborate to cross-check evidence.
4. A suspicious signal is a lead, not proof of match-fixing.

## Team 2 — Information processing and polishing
Elephant, Bear, Turtle, Human, Computer.

- Elephant and Bear support high-volume work and back one another up if one stalls.
- Turtle represents slower, careful processing.
- Human is the human intelligence/judgment layer: sets goals, interprets context, supervises the AI agent, reviews evidence, and approves consequential decisions.
- Computer is the central AI agent layer, strengthened by a coordinated fleet of 100 AI agents using 30 models. The intended design distributes subtasks, runs parallel analysis, compares model outputs, consolidates findings, and returns a structured report to Human.
- `src/zlatko-computer-orchestrator.ts` provides the Computer-layer coordinator: 100 agent slots, 30 model slots, task fan-out, bounded parallel execution, capability matching, result aggregation, and per-call approval gating for external APIs. It executes only adapters that are explicitly registered.
- `src/zlatko-one-brain.ts` is the unified public facade. It connects case intake, the 12-role investigation workflow, evidence handoff, Computer orchestration, processing results, and reviewer-controlled finalization behind one `ZlatkoOneBrain` instance.
- Main entry points: `createZlatkoOneBrain()`, `startCase()`, `recordScoutFindings()`, `submitEvidence()`, `processEvidence()`, `finalizeCase()`, and `getSystemStatus()`.

## Team 3 — Continuous information intake
Leech maintains a persistent, permissioned information feed about the team and match and marks interruptions/data gaps.

## Implemented module
- `src/zlatko-animal-teams.ts` defines all 12 roles and the 3 teams.
- `startInvestigation` starts a case after scan signals.
- `escalateToJointInvestigation` brings Fox and Wolf in after scout findings.
- `submitForProcessing` hands evidence to Team 2.
- `finalizeInvestigation` requires evidence and a reviewer identity.

## Current limits
The 100 agents and 30 models are capacity slots, not 100 live processes or 30 connected providers. The One Brain facade currently stores case state in memory, so cases are lost on process restart. The coordinator has no provider adapters registered by default, makes no external API calls on its own, and does not collect live sports data. Real providers, authorized data feeds, persistent job storage, authentication, audit logging, and automated tests still need to be integrated. External calls must receive a separate one-time approval through the configured approval gate. Suspicious signals and model outputs are leads for human review, not proof or final decisions.
