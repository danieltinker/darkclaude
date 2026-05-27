# darkclaude

POC dashboard for a **funnel-first defensive malware-review pipeline**. Apps move through a Queue Lock → Static Funnel → Decision Gate, then either close early (with an honest "insufficient static rubric potential" reason) or escalate to dynamic evidence collection and a deep inspection report.

This is a **frontend-only POC with mock data**. No real device, no real APK, no Frida, no live dynamic analysis. The goal is to demonstrate the *architecture* and *evidence flow*, not to perform analysis.

## What it shows

- **Queue Lock** — leases an app from the queue, creates stable case identity.
- **Static Funnel** — first analysis worker. Verifies install, runs structured static slice, generates a scorecard with candidate IOCs **and** explicitly missing strong signals.
- **Decision Gate** — deterministic policy: threshold + gray band + force-dynamic rules. Routes to closure, dynamic, or human-static-gate review.
- **Static Closure Report** — for early-closed cases. Explains exactly which rubric signals were and were not found. Never calls an app "benign" — only "insufficient static rubric potential".
- **Dynamic Mission Package** — built only when the gate routes to dynamic. Hypothesis, VPN matrix, hooks, mocks, budget.
- **PixelBridge** — append-only typed transport. Every event has `message_id`, `case_identity`, `checksum`, and schema.
- **Consumer / Evidence Collector** — budgeted experiments, runtime evidence, dynamic IOC scoring.
- **Mission Control** — reconciles static + dynamic per IOC, drafts the human-reviewer-ready Deep Inspection Report.
- **Agents** are abstract — the infrastructure does not care whether a worker is an LLM, a script, or a human.

## Pipeline

```
QUEUE LOCK ──▶ STATIC FUNNEL ──▶ DECISION GATE ─┬─▶ STATIC CLOSURE REPORT
                                                │
                                                └─▶ DYNAMIC MISSION
                                                          │
                                                          ▼
                                                     PIXELBRIDGE
                                                          │
                                                          ▼
                                                     CONSUMER
                                                          │
                                                          ▼
                                             MISSION CONTROL → DEEP INSPECTION REPORT
```

## Golden cases

- **GRC-001 — Riskware: C2 URL → WebView.loadUrl.** Server returns a URL, app loads it in a hidden WebView. Scorecard = 10, gate triggers dynamic via score AND `remote_controlled_webview_candidate` force rule. Strong evidence after dynamic = network capture + WebView hook + screenshot. Final = 24.
- **GRC-002 — Riskware: Remote config flag enables hidden behavior.** Scorecard = 8 (at threshold). Server returns a feature flag; app changes behavior. Currently in `DYNAMIC_RUNNING` state.
- **CLOSURE-CASE — Lumen Notepad.** Static funnel finds only weak WebView usage for bundled help. Gate scores 2 → below auto-close threshold → emits Static Closure Report with explicit missing-strong-signals list.

## Scoring rubric

| Level  | Points |
|--------|-------:|
| weak   |      2 |
| medium |      4 |
| strong |      8 |

- **Static score** = Static Funnel's candidate evidence.
- **Dynamic score** = Consumer's runtime-validated evidence.
- **Final score** = `Σ strongest_level(static, dynamic)` per unique IOC.
- Never double-count the same IOC across evidence items.

## Gate policy (riskware)

| Outcome                          | Condition |
|----------------------------------|---|
| `DYNAMIC_ANALYSIS_REQUIRED`     | score ≥ 8, OR any force-rule fires |
| `HUMAN_REVIEW_STATIC_GATE`      | score in 4–7 |
| `CLOSE_EARLY_STATIC_INSUFFICIENT` | score < 4 and no force-rule |
| `INSTALL_FAILURE_RETRY/CLOSE`   | install verification failed |

Force-dynamic rules currently: `suspicious_native_file_high`, `known_bad_domain`, `developer_prior_flags`, `remote_controlled_webview_candidate`.

### Verdict thresholds

| Verdict       | Final score |
|---------------|------------:|
| benign        | < 4         |
| inconclusive  | 4 – 11      |
| riskware      | 12 – 23     |
| malicious     | ≥ 24        |

## Pages

| Route | What it shows |
|---|---|
| `/` | Overview, funnel-first pipeline, all cases with gate decisions, golden cases, gate policy, scoring rubric |
| `/producer` | Mission Command queue with funnel/gate columns + per-IOC top candidates |
| `/producer/case/[id]` | Case file: funnel chain visualization, queue lock, install verification, static scorecard, gate decision, then static triage / hooks / mission package (only if gate routed to dynamic) |
| `/producer/report/[id]` | Deep Inspection Report with verdict, why-dynamic-was-triggered audit, IOC reconciliation table, queue/install context, human-review checklist |
| `/producer/closure/[id]` | Static Closure Report with checked IOCs, weak signals found, strong signals missing, limitations |
| `/bridge` | PixelBridge append-only event log including funnel events (QueueLockClaimed, InstallVerification, StaticFunnelScorecard, GateDecision, StaticClosureReport, DeepInspectionReportDraft) |
| `/consumer` | Incoming missions inbox (only cases that passed the gate) |
| `/consumer/mission/[id]` | Mission workspace: budget, hypothesis, experiments, evidence board |
| `/agents` | Worker contract + verbatim role prompts for StaticFunnelWorker, StaticGateDecisionWorker, Producer, Consumer, MissionControlReportWorker |

## Stack

- Next.js 15 (App Router, RSC)
- React 19
- TypeScript
- Tailwind CSS

## Run locally

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

## Project layout

```
app/                      # Next.js App Router pages
  page.tsx                # Overview + funnel-first pipeline
  producer/
    page.tsx              # Mission Command queue
    case/[id]/page.tsx    # Case file with funnel chain
    report/[id]/page.tsx  # Deep Inspection Report
    closure/[id]/page.tsx # Static Closure Report
  consumer/               # Consumer evidence lab
  bridge/                 # PixelBridge event log
  agents/                 # Worker contract + 5 role prompts
components/               # Shared UI (Nav, StatusBadge, GateBadge, Panel, ScoreBar)
lib/
  types.ts                # Core contracts: CaseIdentity, QueueLock, InstallVerification,
                          # StaticSliceSummary, StaticFunnelScorecard, GatePolicy, GateDecision,
                          # StaticClosureReport, DeepInspectionReport, ReviewMissionPackage,
                          # DynamicEvidencePackage, BridgeEvent
  rubrics.ts              # Riskware IOC rubric + RISKWARE_GATE_POLICY
  mock-data.ts            # Golden case fixtures + closure case + bridge events
  prompts.ts              # 5 worker role prompts (Funnel, Gate, Producer, Consumer, MissionControl)
  scoring.ts              # Weak/medium/strong reconciliation
```

## Status

This is **MVP-1**: the protocol spine extended with the funnel-first architecture (queue lock → install verify → static slice → scorecard → gate → closure OR dynamic → mission control). All UI mocked from `lib/mock-data.ts`. No persistence, no real workers, no Pixel device.

Next: contracts → SQLite DB → state machine → worker runtime adapters → real tool integrations.
