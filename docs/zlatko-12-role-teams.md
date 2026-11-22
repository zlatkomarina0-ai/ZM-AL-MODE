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
- Human and Computer are included as distinct roles. Their precise permissions and concrete actions remain configurable rather than being guessed in code.

## Team 3 — Continuous information intake
Leech maintains a persistent, permissioned information feed about the team and match and marks interruptions/data gaps.

## Implemented module
- `src/zlatko-animal-teams.ts` defines all 12 roles and the 3 teams.
- `startInvestigation` starts a case after scan signals.
- `escalateToJointInvestigation` brings Fox and Wolf in after scout findings.
- `submitForProcessing` hands evidence to Team 2.
- `finalizeInvestigation` requires evidence and a reviewer identity.

## Current limits
This is a typed workflow/state-transition module, not a live autonomous agent fleet. It does not collect live sports data, connect to external AI providers, execute surveillance, or make a real-world accusation. Those capabilities require explicit authorized integrations, persistence, access control, and tests. No external provider is called by this module.
