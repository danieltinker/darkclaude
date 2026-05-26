# darkclaude

POC dashboard for a **defensive malware-review pipeline** with two abstract sides — Producer and Consumer — communicating through an append-only file protocol (PixelBridge).

This is a **frontend-only POC with mock data**. No real device, no real APK, no Frida, no live dynamic analysis. The goal is to demonstrate the *architecture* and *evidence flow*, not to perform analysis.

## What it shows

- **Producer** owns the queue, metadata intelligence, static triage, IOC candidate scoring, mission packaging, score reconciliation, and submission reports.
- **PixelBridge** is append-only typed transport. Every event has a `message_id`, `case_identity`, `checksum`, and schema. Files are never edited after creation.
- **Consumer** owns mission import, budgeted experiments, runtime evidence capture, dynamic IOC scoring, and evidence package export.
- **Agents** are abstract — the infrastructure does not care whether a worker is an LLM, a script, or a human. They plug into a stable `WorkerTask` → `WorkerResult` contract.

## Pipeline

```
PRODUCER ──ReviewMissionPackage──▶ PIXELBRIDGE ──┐
                                                 │
   ◀────────DynamicEvidencePackage──── CONSUMER ◀┘
```

## Golden cases

- **GRC-001 — Riskware: C2 URL → WebView.loadUrl.** Server returns a URL, app loads it in a hidden WebView. Strong evidence = network capture + WebView hook + screenshot.
- **GRC-002 — Riskware: Remote config flag enables hidden behavior.** Server returns a feature flag; app changes behavior. Strong evidence = config capture + behavior delta across geos.

## Scoring rubric

| Level  | Points |
|--------|-------:|
| weak   |      2 |
| medium |      4 |
| strong |      8 |

- **Static score** = Producer's candidate evidence.
- **Dynamic score** = Consumer's runtime-validated evidence.
- **Final score** = `Σ strongest_level(static, dynamic)` per unique IOC.
- Never double-count the same IOC across evidence items.

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
| `/` | Overview, pipeline flow, all cases, rubric, thresholds, golden cases |
| `/producer` | Queue table |
| `/producer/case/[id]` | Case file: identity, metadata intelligence, static triage, IOC candidates, hooks, mission package |
| `/producer/report/[id]` | Final submission report with reconciled IOC table |
| `/bridge` | PixelBridge append-only event log, stream view, per-case timeline |
| `/consumer` | Incoming missions inbox |
| `/consumer/mission/[id]` | Mission workspace: budget, hypothesis, experiments, evidence board, runtime trace |
| `/agents` | Worker contract + verbatim role prompts for Producer and Consumer |

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
  page.tsx                # Overview
  producer/               # Producer side
  consumer/               # Consumer side
  bridge/                 # PixelBridge event log
  agents/                 # Worker contract + role prompts
components/               # Shared UI primitives (Nav, StatusBadge, Panel, ScoreBar)
lib/
  types.ts                # Core contracts (case identity, mission, evidence, report)
  rubrics.ts              # Riskware IOC rubric
  mock-data.ts            # Golden case fixtures + bridge events
  prompts.ts              # Producer + Consumer role prompts
  scoring.ts              # Weak/medium/strong reconciliation
```

## Status

This is **MVP-0**: the protocol spine and UI for one complete golden case (GRC-001) plus a few in-flight cases. No persistence, no real workers, no Pixel device — everything is in-memory mock data sourced from `lib/mock-data.ts`.

The real follow-on work is in the original architecture brief: schemas → DB → state machines → worker runtime adapters → tool integrations.
