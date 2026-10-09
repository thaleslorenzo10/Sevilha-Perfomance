# Consulting Integrations Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development, with independent parallel ownership. Only the coordinator commits.

**Goal:** Connect the three consulting forms to existing CRM, Meta CAPI, Sheets and dashboard; qualify only companies above 10 employees.

**Architecture:** Reuse existing bank-first submission and durable integration receipts. Keep Lead for every valid submission and LeadQualificado only above 10, with browser/server deduplication. Preserve unrelated Clube rules and routes.

**Tech Stack:** Static HTML/JS, Node Vercel functions, Supabase, RD CRM, Google Sheets, Meta CAPI.

**Spec:** User request of 2026-10-09 and existing formulario-consultoria design; new explicit qualification overrides former 10+ cutoff for consulting only.

## Constraints

- All three consulting paths: /mentoria, /mentoria-2, /formulario-consultoria.
- New bands 5 to 10 and 11 to 19 make strictly above 10 observable.
- Historical 10 to 19 is ambiguous and must not be represented as proven above 10.
- No cargo restriction for consulting qualification; no campaign edits.
- No secret output, cross-client credential substitution, unsolicited email or WhatsApp.
- Use existing production authorization; test events must not enter production conversions.

## Review Focus

- Exactly 10 versus 11 and ambiguous historical ranges.
- Missing/invalid credentials versus verified external delivery.
- Same event ID browser/server and retries without duplicate external POSTs.
- Bank persistence and integration failure do not block enrollment.
- Dashboard numerator/denominator and three-page attribution remain consistent.

## Task 1: Precise Qualification

**Files:** lib/porte.js, api/leads.js, lib/consultoria-leads.js, assets/tracking.js, three form HTML files and focused form/CAPI tests.
**Owner:** qualification specialist.

- [ ] Add tests for 10 false, 11 true, new bands, operational cargo and historical ambiguous range.
- [ ] Add consulting-specific predicate preserving legacy Clube classifier.
- [ ] Align form validation, submit event and browser/server event IDs.
- [ ] Run focused offline form/CAPI tests.

## Task 2: Runtime Integrations

**Files:** scripts/check-consultoria-integracoes.js; temporary isolated production probe, removed before final deployment.
**Owner:** integration specialist; coordinator publishes and inspects readback.

- [ ] Verify exact Supabase, CRM stage, Sheets target/edit permission, Meta dataset credentials.
- [ ] Fix stale preflight messages without touching business adapters unless a reproduced failure requires it.
- [ ] Verify production runtime using sanitized authenticated probe; never expose credentials or retrieve user rows.
- [ ] For Meta, only explicitly test-marked synthetic events; do not switch production traffic to test mode.
- [ ] Remove temporary endpoint and token before final production verification.

## Task 3: Dashboard

**Files:** lib/sessao-estrategica.js, lib/leads-unificados.js, api/stats.js, assets/js/dash and focused tests.
**Owner:** dashboard specialist; consumes consulting-specific predicate from Task 1.

- [ ] Assert all three pages contribute correct leads/visitors and preserve UTMs.
- [ ] Align consulting qualified metrics with above-10 predicate, preserve unrelated metrics.
- [ ] Run dashboard/SE/unified lead tests and read-only schema checks.

## Task 4: Review and Delivery

**Owner:** coordinator and independent reviewer after integration.

- [ ] Independent correctness/security review.
- [ ] Lint, Biome, focused tests, Next build, then Next typecheck.
- [ ] agent-browser local and public production: both viewports, new bands and Pixel/CAPI IDs with intercepted submissions.
- [ ] Publish clean task-only code, read deployment READY, verify public assets/API.
- [ ] Commit task files only and record precise real versus mocked evidence and any blocker.

Plan self-approved under the user's existing autonomous execution preference.
