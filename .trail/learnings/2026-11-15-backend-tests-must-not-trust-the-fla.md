---
title: "Backend tests must not trust the ambient environment: the local env file hides what CI really sets"
author: Flávio
date: 2026-11-15
branch: feat/security-agent-public-data-tests
cost: { minutes: 1, tokens: 12850 }
id: l-60d653ba
scope: repo
status: active
src: agent
touches:
  - ".github/workflows/ci.yml"
  - backend/vitest.setup.ts
  - backend/scripts/load-public-data.ts
  - backend/src/modules/ingestion/__tests__/public-data.test.ts
  - backend/src/modules/ingestion/application/services/public-data.ts
  - backend/src/shared/crypto/encryption.service.ts
  - backend/src/modules/agent/__tests__/agent-sql-executor.test.ts
---

## Decided
The test setup fills in safe defaults for every required variable and also replaces the encryption key when it is not 64 hex characters, so a bad value from the environment cannot break test loading. The CI workflow now uses a valid 32 byte hex key.

## Tried and ruled out
Only filling variables that are missing: it looked enough, but CI already defined the key with the wrong shape (32 decimal digits), so the default never applied and the invalid value won.

## Watch out
Tests passed locally because the developer env file has a valid key, and CI failed only once a test imported the crypto module for the first time. To reproduce a CI failure run the tests with a clean environment (env -i plus the variables from the workflow), not in a shell that has the env file loaded.
The five tests that run SQL inside a read only transaction need Postgres and are skipped in CI, so the safety layer they cover is not exercised there until a postgres service is added to the workflow.

In the code:
- backend/vitest.setup.ts: defaults and the encryption key check
- .github/workflows/ci.yml: ENCRYPTION_KEY and the web job running npm test
- backend/src/shared/crypto/encryption.service.ts: requires 32 bytes in hex
- backend/src/modules/agent/__tests__/agent-sql-executor.test.ts: skipped without a database
