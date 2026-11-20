# ZLATKO AI MODE — First Brain

## Purpose

The First Brain is the provider-neutral coordination layer for the model council. It accepts one task, calls every configured agent independently, keeps successful replies when another agent fails, and can pass successful replies to a synthesis function.

## Current status

- The orchestration contract is implemented in `src/brain/first-brain.ts`.
- This is the coordination core only. GPT, Claude, and DeepSeek are **not automatically connected** by this file.
- Real provider adapters and server-side credentials are required before external model calls work.
- The current web/mobile UI is intentionally not changed by this first step.

## Design rules

1. **One task format:** every agent receives the same task and context.
2. **Independent opinions:** agents answer independently before synthesis.
3. **Partial success:** one failed provider does not discard other replies.
4. **Traceability:** every reply includes the agent/provider label and completion time.
5. **Honest status:** missing adapters and failed calls are reported rather than simulated.
6. **Secrets stay server-side:** never place provider API keys in browser code, the Android package, or public repository files.
7. **Cost control:** the server integration should support model selection, timeouts, rate limits, and a configurable agent list.

## Integration sequence

1. Implement one server-side provider adapter and verify a real response.
2. Add Claude and DeepSeek adapters only when credentials and API access are configured.
3. Add a synthesis adapter that compares claims, disagreements, and evidence without erasing the original replies.
4. Add request limits, timeouts, safe error logging, and usage/cost tracking.
5. Connect the UI to the server endpoint after the API contract and error states are tested.

## Suggested task flow

`Task -> First Brain -> parallel agents -> preserved replies/failures -> synthesis -> report`

The brain should not claim that it has consulted a provider unless that provider adapter actually ran successfully.
