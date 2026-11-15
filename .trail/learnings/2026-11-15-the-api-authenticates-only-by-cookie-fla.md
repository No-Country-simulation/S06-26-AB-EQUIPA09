---
title: "The API authenticates only by cookie, so the front must send credentials; guard hooks must be scoped, not local"
author: Flávio
date: 2026-11-15
branch: main
cost: { minutes: 32, tokens: 323956 }
id: l-5f3c6a4b
scope: repo
status: active
src: agent
touches:
  - backend/src/modules/agent/application/services/sql-safety.ts
  - backend/src/modules/agent/application/services/agent-sql-executor.ts
  - backend/src/modules/ingestion/application/services/cvss-ingestion.service.ts
  - backend/src/modules/coverage/infrastructure/persistence/region-coverage.repository.ts
  - backend/scripts/cleanup-coverage-periods.ts
  - backend/package.json
  - backend/src/modules/ingestion/__tests__/coverage-period.test.ts
  - backend/src/middlewares/auth.middleware.ts
  - web/src/hooks/useAuth.ts
---

## Decided
Guard hooks (user auth, staff auth, rate limit) use scoped, so they also protect the routes of the controller that uses them. The web client sends cookies on every request. The backend ignores the Authorization Bearer header.

## Tried and ruled out
Leaving the hooks as local: it looked fine because the dashboard worked, but only because /regions, /coverage and all /staff/* routes were open without login, and the rate limit never returned 429. Accepting Bearer in the backend was considered and not done, to keep one auth path.

## Watch out
Turning on real enforcement makes a client that does not send cookies fail with 401 and bounce to the login page. Auth rate limit is 5 attempts per 15 minutes per IP and is in memory, so repeated manual logins lock you out until the backend restarts. Login errors from the API are objects, never render them directly.

In the code:
- backend/src/middlewares/auth.middleware.ts, staff-auth.middleware.ts, rate-limit.middleware.ts: onBeforeHandle with as scoped
- web/src/hooks/useAuth.ts: axios instance and refresh call with withCredentials true
- web/src/lib/apiError.ts: getApiErrorMessage
- backend/src/middlewares/__tests__/auth-enforcement.test.ts: regression tests
