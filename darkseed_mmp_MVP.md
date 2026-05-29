# darkseed — MMP Uncloaking MVP

> Build spec for a **fresh agent**. Lean by design: **one IOC, one technique flow, end-to-end, across two machines.** One level of abstraction. Do not port the breadth of `darkclaude` — keep only what proves the single attack chain below.

---

## 0. Mission (one paragraph)

Prove a single riskware technique — **MMP cloaking** — end to end across two machines. **Yoda** (static / mission control) statically confirms a 3-stage attack chain and ships a mission to **Darth Vader** (dynamic lab) over **PixelBridge**. Vader re-confirms statically, runs the app, attaches Frida logs / HTTP logs / screenshots per node, and ships the evidence back. The UI renders **one confirmed call graph** where every node carries a **static signature + dynamic evidence + status**. A fully-confirmed chain scores **strong = 8 points**.

The whole point is the **seamless transfer contract** between the two systems and the **premium per-node proof GUI**.

---

## 1. Scope

**In (build this):**
- Exactly **one IOC**: `mmp_cloaking` (strong = 8 pts).
- Exactly **one flow**: `onConversionDataSuccess` → parse URL out of a web request → load URL in a WebView.
- **Two machine views**: Yoda (static) and Darth Vader (dynamic).
- **PixelBridge**: a simulated append-only transfer of two typed messages + artifacts.
- **One custom mission card** for this rubric (static half + dynamic half over one call graph).
- **One golden case** with full mock data, flowing Yoda → Vader → Yoda.
- Premium cyber-research aesthetic.

**Out (do NOT build):**
- Other categories/rubrics, multi-rubric, gate-policy engine, worker-adapter abstraction, metadata gate, queue management, agents/prompt pages, analytics dashboards, auth, real Frida/devices/ADB.
- No database. Mock data in a `lib/` module is the source of truth.

---

## 2. The two machines + PixelBridge

```
┌──────────────────────────┐        PixelBridge         ┌──────────────────────────┐
│ YODA  (static / control) │  ── MissionContext ─────▶  │ DARTH VADER (dynamic lab)│
│  - lock + identity       │                            │  - re-confirm static     │
│  - confirm 3 static      │  ◀──── EvidenceReturn ───  │  - run + attach evidence │
│    stages (call graph)   │     (+ artifacts in        │    (frida/http/shots)    │
│  - send mission          │      storage)              │  - send evidence back    │
│  - reconcile → 8 pts      │                            │                          │
└──────────────────────────┘                            └──────────────────────────┘
```

- **Yoda** owns identity, the static call graph, and final scoring.
- **Darth Vader** owns runtime confirmation and evidence capture.
- **PixelBridge** = append-only typed files on shared storage. Neither machine reads the other's internals; they exchange only the two contract messages below + artifacts.

For the MVP this is **one Next.js app with two routes** (`/yoda`, `/vader`) and a **simulated bridge** in `lib/bridge.ts`. The contract is real even if the transport is mocked.

---

## 3. The one IOC: `mmp_cloaking` (strong = 8)

The true affiliate URL never appears in static strings. It is built at runtime from a tracker response and loaded into a WebView through obfuscated indirection.

**3 stages, broken into sub-steps (one call graph):**

| Stage | Node | kind | what it does |
|---|---|---|---|
| **1 · Trigger** | `n1_callback` | trigger | `AttribListener.onConversionDataSuccess(Map)` fires; reads attribution token |
| **2 · URL build** | `n2_invoke` | dispatch | `a.invoke(data)` orchestrates the build |
| | `n2_http` | http | `a.g(token)` issues GET to tracker endpoint |
| | `n2_parse` | parse | `JSONObject(resp).optString("dl")` pulls the URL field |
| | `n2_deobf` | deobf | `B64.dec(...)` / XOR unwrap → the cleartext affiliate URL |
| **3 · Sink** | `n3_o` | dispatch | `MainActivity.o(url)` hands URL into a cloak object |
| | `n3_coro` | dispatch | `Cloak$block$1.invokeSuspend` coroutine indirection (Java-mechanic obfuscation) |
| | `n3_native` | dispatch | *(optional path)* `libcloak.so` JNI dispatch (native obfuscation) |
| | `n3_load` | sink | `WebView.loadUrl(url)` — the real sink renders the affiliate page |

**Edges** form one graph: `n1→n2_invoke (calls)`, `n2_invoke→n2_http (calls)`, `n2_http→n2_parse (returns)`, `n2_parse→n2_deobf (data_to)`, `n2_deobf→n2_invoke (returns url)`, `n2_invoke→n3_o (data_to)`, `n3_o→n3_coro (calls)`, `n3_coro→n3_native (calls, optional)`, `n3_coro/n3_native→n3_load (triggers)`.

**Required for strong-8:** the 3 stage-boundary nodes must be dynamically confirmed — `n1_callback`, `n2_parse` (URL actually built from the response), `n3_load` (URL actually loaded). Sub-steps enrich the proof; the boundaries gate the score.

> Emphasis: stage 2 (URL build) and stage 3 (load) are **deliberately multi-step** — the URL may pass through several calls + a deobfuscation, and the load may be hidden behind a coroutine and/or a native `.so`. The UI must show **the entire chain** connected, not just the endpoints.

---

## 4. Cross-machine contract (THE central interface)

Two message types travel over PixelBridge. Keep them minimal and stable — this is the seam both agents agree on.

```ts
// ---- Shared identity (minimal) -------------------------------------
type CaseIdentity = {
  case_id: string;          // stable per investigation
  package_name: string;     // primary real-world identity
  version_code: number;
  version_name: string;
  developer: string;
  top_countries: string[];  // geo-targeting hint
};

type QueueLock = {
  lock_id: string;          // QueueLockID
  case_id: string;
  locked_by: 'yoda';
  locked_at: string;        // ISO
  expires_at: string;       // lease, not permanent
};

// ---- The static call graph (authored by Yoda) ----------------------
type NodeSignature = {
  class_name: string;       // fully-qualified
  method: string;           // e.g. g(java.lang.String)
  file_path: string;        // exact decompiled path (no cross-machine gaps)
  line: number;
  snippet: string;          // focal decompiled lines
};

type FlowNode = {
  node_id: string;
  stage: 1 | 2 | 3;
  label: string;
  kind: 'trigger' | 'dispatch' | 'http' | 'parse' | 'deobf' | 'sink';
  signature: NodeSignature;
  frida_hook: string;       // exact hook target Vader will set
  static_confirmed: boolean;// Yoda located it in decompiled code
};

type FlowEdge = { from: string; to: string; relation: 'calls' | 'returns' | 'data_to' | 'triggers' };

type FlowGraph = {
  entry: string;            // node_id
  nodes: FlowNode[];
  edges: FlowEdge[];
  required_nodes: string[]; // boundary nodes that gate the strong-8 score
};

// ---- MESSAGE A→B : Yoda hands the mission to Vader -----------------
type MissionContext = {
  schema_version: '1.0.0';
  type: 'MissionContext';
  mission_id: string;
  sent_by: 'yoda';
  sent_to: 'darth_vader';
  case_identity: CaseIdentity;
  queue_lock: QueueLock;
  ioc: { ioc_id: 'mmp_cloaking'; name: string; points_if_strong: 8 };
  flow: FlowGraph;          // with Yoda's static_confirmed flags set
  status: MissionStatus;
  created_at: string;
  checksum: string;         // sha256 of payload
};

// ---- Dynamic evidence Vader attaches per node ----------------------
type Artifact = { kind: 'frida' | 'http' | 'screenshot'; path: string; sha256: string; label: string };

type NodeEvidence = {
  node_id: string;
  reconfirmed_static: boolean;          // Vader re-located the signature locally
  dynamic_status: 'confirmed' | 'failed' | 'pending';
  artifacts: Artifact[];                // frida logs / http logs / screenshots
  observation: string;                  // one-line what-we-saw
};

// ---- MESSAGE B→A : Vader returns the evidence ----------------------
type EvidenceReturn = {
  schema_version: '1.0.0';
  type: 'EvidenceReturn';
  mission_id: string;
  sent_by: 'darth_vader';
  sent_to: 'yoda';
  case_id: string;
  node_evidence: NodeEvidence[];
  iterations: number;                   // experiment iterations Vader ran
  dynamic_confirmed: boolean;           // all required_nodes confirmed
  dynamic_score: number;                // 8 if confirmed, else partial/0
  verdict: 'confirmed_tp' | 'failed_fp' | 'partial';
  created_at: string;
  checksum: string;
};
```

### Statuses (lean lifecycle)

```ts
type MissionStatus =
  | 'LOCKED'            // Yoda: locked from queue, identity created
  | 'STATIC_CONFIRMED' // Yoda: all 3 static stages located
  | 'MISSION_SENT'     // pushed to PixelBridge (A→B)
  | 'RECEIVED'         // Vader imported MissionContext
  | 'DYNAMIC_RUNNING'  // Vader running experiments
  | 'EVIDENCE_SENT'    // Vader pushed EvidenceReturn (B→A)
  | 'SCORED';          // Yoda reconciled → strong 8 (or partial/fail)
```

Per-node status is two booleans/enums: `static_confirmed` (Yoda) and `dynamic_status` (Vader). That is the whole state model.

### PixelBridge layout (simulated)

```
bridge/
  yoda_outbox/   <mission_id>.MissionContext.json     # A→B
  vader_inbox/   (mirror of yoda_outbox)
  vader_outbox/  <mission_id>.EvidenceReturn.json     # B→A
  yoda_inbox/    (mirror of vader_outbox)
  artifacts/<mission_id>/frida/*.log  http/*.har  screenshots/*.png
```

Rules: append-only, write `.tmp` then atomic rename, `checksum` on every message, idempotent by `mission_id`. For the MVP `lib/bridge.ts` simulates this in-memory (or a single mock object) — but the **shapes and statuses above are the contract** a real two-machine build would honor unchanged.

---

## 5. The mission card GUI (custom for this rubric)

One screen, the proof is the hero. **Premium cyber-research aesthetic for a $1B company**: dark, high-contrast, restrained, fast, legible; monospace for code/signatures; generous spacing; confident status chips; no clutter.

**Header:** package · version · developer · top countries · QueueLockID · mission status · IOC chip (`MMP CLOAKING · STRONG 8`).

**The call graph (the centerpiece):** the 3 stages as labeled bands; sub-step nodes nested in order within each band; edges drawn between nodes with relation labels. Each **node card** shows two columns:

- **LEFT — Static signature (Yoda):** `class.method` · `file_path:line` · the decompiled snippet · a **STATIC CONFIRMED / UNCONFIRMED** chip.
- **RIGHT — Dynamic evidence (Vader):** the `frida_hook` target · attached artifacts rendered well — **Frida log** lines, **HTTP** request/response (the tracker GET + the `dl` field), **screenshot** thumbnail of the rendered affiliate page · a **CONFIRMED / FAILED / PENDING** chip · the one-line observation.

A node where Vader **failed** to confirm shows the failed chip and leaves room for a human note (don't over-engineer — a disabled "attach / re-run" affordance is enough for the MVP).

**Footer — scoring:** required boundary nodes confirmed `x/3`; verdict (`CONFIRMED TP` / `PARTIAL` / `FAILED FP`); **strong 8** awarded only when all required nodes are `confirmed`.

**Two perspectives of the same card:**
- `/yoda` — fills the LEFT (static) side, sets `static_confirmed`, "Send mission" → writes MissionContext to bridge.
- `/vader` — receives MissionContext, fills the RIGHT (dynamic) side with artifacts, "Send evidence" → writes EvidenceReturn.
- A combined read view (`/yoda` after evidence returns) renders both halves reconciled.

---

## 6. Storage / device evidence interface

Darth Vader captures artifacts during experiments and **pushes them to the storage system** under `bridge/artifacts/<mission_id>/`. Each `Artifact` carries `{ kind, path, sha256, label }`. The GUI renders from those paths (mock: committed placeholder files under `public/`). Per stage, Vader marks the node `confirmed` or `failed` and records iteration count. The device may disconnect after sync — the card still renders from the stored artifacts.

---

## 7. Scoring

- `mmp_cloaking` confirmed end-to-end (all `required_nodes` `dynamic_status === 'confirmed'`) → **strong, 8 points**, `verdict = confirmed_tp`.
- Some but not all required nodes confirmed → `partial`, score < 8.
- Boundary disproved at runtime → `failed_fp`, score 0.
- A point is **never** awarded for a node without attached dynamic evidence.

---

## 8. Tech stack + structure

- Next.js 15 (App Router, RSC) · React 19 · TypeScript · Tailwind. No DB.

```
app/
  page.tsx                 # landing: the one case + "open in Yoda / Vader"
  yoda/page.tsx            # static side: confirm graph + send mission
  vader/page.tsx           # dynamic side: receive + attach evidence + send back
components/
  MissionCard.tsx          # the unified card chrome (header + footer/scoring)
  CallGraph.tsx            # the 3-stage node graph w/ edges + sub-step nesting
  NodeCard.tsx             # one node: static signature ↔ dynamic evidence + status
  EvidenceViewer.tsx       # frida log / http / screenshot renderers
  StatusChip.tsx
lib/
  contract.ts              # all schemas in §4 (the contract)
  flow.ts                  # the mmp_cloaking FlowGraph (nodes/edges/signatures)
  bridge.ts                # simulated PixelBridge (write/read MissionContext + EvidenceReturn)
  mock.ts                  # one golden case: identity + static confirmations + node evidence
  score.ts                 # strong-8 rule
public/screenshots/        # placeholder affiliate-page + offer shots
```

---

## 9. Build phases (minimal, ordered)

1. **Contract + flow** — `lib/contract.ts` (§4 schemas), `lib/flow.ts` (the `mmp_cloaking` graph with real signatures), `lib/score.ts`. Compiles, no UI.
2. **Mock golden case** — `lib/mock.ts`: one `CaseIdentity` + `QueueLock`, Yoda's `static_confirmed` flags, and Vader's `NodeEvidence` (frida/http/screenshot artifacts, all required nodes confirmed → strong 8). Placeholder artifacts in `public/`.
3. **Mission card** — `CallGraph` + `NodeCard` + `EvidenceViewer`: render the reconciled graph (static ↔ dynamic per node, sub-steps nested, edges, scoring footer). This is the hero — make it premium.
4. **Yoda view** — static confirm + "Send mission" (writes MissionContext via `lib/bridge.ts`).
5. **Vader view** — receive MissionContext + attach evidence + "Send evidence" (writes EvidenceReturn).
6. **Reconcile + polish** — Yoda renders returned evidence → strong 8; premium pass.

Commit + push after each phase.

---

## 10. Definition of done

- One MMP case flows **Yoda → PixelBridge → Vader → PixelBridge → Yoda**.
- The call graph shows **all 3 stages + their sub-steps** as one connected graph; every node has a **static signature** and **dynamic evidence** (Frida log + HTTP + screenshot where applicable) and a **confirmed/failed** status.
- The URL-build chain (HTTP → parse → deobfuscate) and the cloaked-load chain (coroutine and/or native → `loadUrl`) are both shown connected, not just endpoints.
- All required boundary nodes confirmed → **strong, 8 points**, `confirmed_tp`.
- The contract messages (`MissionContext`, `EvidenceReturn`) and statuses are the only things crossing the machine boundary.
- Renders in a premium, legible, $1B-grade cyber-research GUI.

---

## 11. Notes for the building agent

- Keep **one level of abstraction**: a node has a static signature and dynamic evidence — that's it. No worker adapters, no policy engines, no extra rubrics.
- The **contract in §4 is law**. Don't add fields the two machines don't both need.
- Sub-steps matter: prove the **whole** URL-build and load chains, including the obfuscation hops, connected into one call graph.
- Mock realistically (real-looking decompiled snippets, a real-looking tracker GET + `dl` response, a labeled affiliate screenshot), but **no real device/Frida**.
- Premium GUI = restraint + legibility + the graph as the hero. Not busy.
