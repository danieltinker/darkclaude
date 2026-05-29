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

// Static analysis may provide a decryptor for a node. When decryption is
// part of the call-trace, the node surfaces the decryptor + the recovered
// strings so reviewers see the cleartext that was hidden.
type Decryptor = {
  algorithm: 'base64' | 'xor' | 'aes' | 'rc4' | 'custom';
  key_source: string;                 // where the key/seed comes from
  decrypted_strings: { ciphertext: string; plaintext: string; note?: string }[];
};

// Native .so referenced by an obfuscated dispatch node. Tracked by name +
// a stable unique id; confirmed_active flips true when Vader proves the
// native path actually ran.
type NativeFile = {
  native_id: string;                  // stable unique id
  name: string;                       // e.g. libcloak.so
  sha256: string;
  exported_symbol?: string;           // JNI entry the dispatch calls
  confirmed_active: boolean;          // dynamic proved it executed
  activity_note: string;
};

type FlowNode = {
  node_id: string;
  stage: 1 | 2 | 3;
  label: string;
  kind: 'trigger' | 'dispatch' | 'http' | 'parse' | 'deobf' | 'sink';
  signature: NodeSignature;
  frida_hook: string;       // exact hook target Vader will set
  static_confirmed: boolean;// Yoda located it in decompiled code
  produces_url?: boolean;   // the node whose output is the affiliate URL (drives known-URL lookup)
  decryptor?: Decryptor;    // present on deobf/decrypt nodes
  native_file?: NativeFile; // present on native dispatch nodes
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

// Extracted payload — if Vader finds a dropper/packer at runtime it pulls
// it off the device into storage and returns a downloadable handle.
type ExtractedPayload = {
  payload_id: string;
  type: 'dropper' | 'packer' | 'dex' | 'so' | 'apk';
  source_path_on_device: string;
  storage_path: string;               // under bridge/artifacts/<mission_id>/payloads/
  sha256: string;
  size_bytes: number;
  found_at_node?: string;             // which graph node surfaced it
  description: string;
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
  native_files: NativeFile[];           // with confirmed_active set by Vader
  extracted_payloads: ExtractedPayload[];// droppers/packers found (may be empty)
  found_urls: string[];                 // affiliate URLs observed at runtime
  iterations: number;                   // experiment iterations Vader ran
  dynamic_confirmed: boolean;           // all required_nodes confirmed
  dynamic_score: number;                // 8 if confirmed, else partial/0
  verdict: 'confirmed_tp' | 'failed_fp' | 'partial';
  created_at: string;
  checksum: string;
};

// ---- Human-in-the-loop (Yoda reconcile) ----------------------------
// The reviewer confirms the trace and may flip the verdict; the score
// auto-updates from the flip.
type HumanReview = {
  reviewer: string;
  trace_confirmed: boolean;             // human agrees the static↔dynamic chain holds
  node_confirmations: Record<string, 'confirmed' | 'rejected'>; // per-node human call
  verdict_override?: 'confirmed_tp' | 'failed_fp' | 'partial';
  score_after_override?: number;        // auto-derived: 8 for confirmed_tp, 0 for failed_fp, partial computed
  reason?: string;
  at: string;
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

## 4a. Known-riskware-URL DB (O(1) lookup + TP write-back)

A self-maintaining cache on Yoda. The node that `produces_url` yields the
affiliate URL; check it against the DB for an **O(1)** hit, and on a
`confirmed_tp` verdict **write the found URLs back** so the corpus grows.

```ts
type KnownRiskwareUrl = {
  url: string;            // normalized
  domain: string;
  first_seen_mission_id: string;
  package_name: string;
  added_at: string;
  hits: number;           // times re-observed
};

// lib/known-urls.ts — Map keyed by normalized url AND domain → O(1) lookup.
lookupUrl(url): { known: boolean; entry?: KnownRiskwareUrl };   // O(1)
lookupDomain(domain): { known: boolean; entries: KnownRiskwareUrl[] };
recordTp(url, domain, mission_id, package_name): void;          // write-back on TP
```

Rules:
- On evidence return, for each `found_urls` entry run `lookupUrl` (O(1)). A
  hit is **prior corroboration** — surface a `KNOWN RISKWARE URL` badge on
  the URL node and bump `hits`.
- When the case reaches `confirmed_tp` (agent score **or** human flip),
  call `recordTp` for every found URL → the DB self-maintains. New URLs
  become future O(1) hits.
- MVP backing store: an in-memory `Map` seeded from `lib/mock.ts` (a real
  build swaps the same interface for Redis/KV — O(1) preserved).

## 5. The mission card GUI (custom for this rubric)

One screen, the proof is the hero. **Premium cyber-research aesthetic for a $1B company**: dark, high-contrast, restrained, fast, legible; monospace for code/signatures; generous spacing; confident status chips; no clutter.

**Header:** package · version · developer · top countries · QueueLockID · mission status · IOC chip (`MMP CLOAKING · STRONG 8`).

**The call graph (the centerpiece):** the 3 stages as labeled bands; sub-step nodes nested in order within each band; edges drawn between nodes with relation labels. Each **node card** shows two columns:

- **LEFT — Static signature (Yoda):** `class.method` · `file_path:line` · the decompiled snippet · a **STATIC CONFIRMED / UNCONFIRMED** chip.
  - On a **decryptor node**: also render the decryptor (`algorithm` · `key_source`) and a **decrypted-strings table** (ciphertext → plaintext) so the recovered cleartext shows inline in the trace.
  - On a **native dispatch node**: render the `NativeFile` (`name` · `native_id` · `sha256` · exported symbol) with a **NATIVE ACTIVE / INERT** chip driven by `confirmed_active`.
  - On the **`produces_url` node**: if the affiliate URL is a hit in the known-riskware-URL DB, show a **KNOWN RISKWARE URL** badge (with prior `hits` + first-seen mission).
- **RIGHT — Dynamic evidence (Vader):** the `frida_hook` target · attached artifacts rendered well — **Frida log** lines, **HTTP** request/response (the tracker GET + the `dl` field), **screenshot** thumbnail of the rendered affiliate page · a **CONFIRMED / FAILED / PENDING** chip · the one-line observation.

**Human-in-the-loop (on the reconciled card):**
- Each node has a **confirm / reject** control (the human verifies the static↔dynamic chain node by node).
- A **flip-verdict** control (`→ CONFIRMED TP` / `→ FAILED FP` / `→ PARTIAL`) with a reason. Flipping **auto-updates the score** (8 for confirmed_tp, 0 for failed_fp, recomputed for partial) and stamps a `HumanReview`. A rejected required node breaks the chain and offers the flip.
- A failed/pending node leaves room for the human to attach evidence or re-run (a labeled affordance is enough for the MVP).

**Extracted-payload card:** if `extracted_payloads` is non-empty (Vader found a dropper/packer), render a prominent **payload card** per item — `type` · `sha256` · size · `found_at_node` · description · a **Download** affordance (POC: links to the stored artifact; production: an authenticated `/api/payloads/:id`). This is the "nice flow" when dynamic surfaces a dropper/packer.

**Footer — scoring:** required boundary nodes confirmed `x/3`; verdict (`CONFIRMED TP` / `PARTIAL` / `FAILED FP`), showing **agent verdict → human verdict** when overridden; **strong 8** awarded only when all required nodes are `confirmed`. On `confirmed_tp`, a small **"DB updated · +N URLs"** note from the write-back.

**Two perspectives of the same card:**
- `/yoda` — fills the LEFT (static) side, sets `static_confirmed`, attaches decryptors + decrypted strings, "Send mission" → writes MissionContext to bridge.
- `/vader` — receives MissionContext, fills the RIGHT (dynamic) side with artifacts, flips native `confirmed_active`, attaches any extracted payloads + found URLs, "Send evidence" → writes EvidenceReturn.
- A combined read view (`/yoda` after evidence returns) renders both halves reconciled, runs the O(1) URL lookup, and exposes the human-in-the-loop confirm/flip controls + score auto-update.

---

## 6. Storage / device evidence interface

Darth Vader captures artifacts during experiments and **pushes them to the storage system** under `bridge/artifacts/<mission_id>/`. Each `Artifact` carries `{ kind, path, sha256, label }`. The GUI renders from those paths (mock: committed placeholder files under `public/`). Per stage, Vader marks the node `confirmed` or `failed` and records iteration count. The device may disconnect after sync — the card still renders from the stored artifacts.

---

## 7. Scoring

- `mmp_cloaking` confirmed end-to-end (all `required_nodes` `dynamic_status === 'confirmed'`) → **strong, 8 points**, `verdict = confirmed_tp`.
- Some but not all required nodes confirmed → `partial`, score < 8.
- Boundary disproved at runtime → `failed_fp`, score 0.
- A point is **never** awarded for a node without attached dynamic evidence.
- **Human override auto-updates the score**: a `HumanReview.verdict_override` recomputes `score_after_override` (8 / 0 / partial) and that becomes the effective score. Both agent and human verdicts are kept (audit trail).
- A **known-riskware-URL hit** is corroborating context shown on the card; it does not by itself award points (dynamic confirmation still gates the 8). On `confirmed_tp`, the found URLs are written back to the DB.

---

## 8. Tech stack + structure

- Next.js 15 (App Router, RSC) · React 19 · TypeScript · Tailwind. No DB.

```
app/
  page.tsx                 # landing: the one case + "open in Yoda / Vader"
  yoda/page.tsx            # static side: confirm graph + send mission
  vader/page.tsx           # dynamic side: receive + attach evidence + send back
components/
  MissionCard.tsx          # the unified card chrome (header + footer/scoring + human controls)
  CallGraph.tsx            # the 3-stage node graph w/ edges + sub-step nesting
  NodeCard.tsx             # one node: static signature ↔ dynamic evidence + status
                           #   (decryptor strings, native-file activity, known-URL badge)
  EvidenceViewer.tsx       # frida log / http / screenshot renderers
  PayloadCard.tsx          # extracted dropper/packer + download affordance
  HumanReview.tsx          # per-node confirm/reject + flip-verdict (auto-updates score)
  StatusChip.tsx
lib/
  contract.ts              # all schemas in §4 (the contract)
  flow.ts                  # the mmp_cloaking FlowGraph (nodes/edges/signatures + decryptor + native_file)
  bridge.ts                # simulated PixelBridge (write/read MissionContext + EvidenceReturn)
  known-urls.ts            # O(1) known-riskware-URL DB (lookup + recordTp write-back)
  mock.ts                  # one golden case: identity, static confirmations, node evidence,
                           #   decrypted strings, native file, found URLs, optional payload
  score.ts                 # strong-8 rule + human-override recompute
public/screenshots/        # placeholder affiliate-page + offer shots
public/payloads/           # placeholder extracted dropper (downloadable)
```

---

## 9. Build phases (minimal, ordered)

1. **Contract + flow** — `lib/contract.ts` (§4 schemas incl. Decryptor, NativeFile, ExtractedPayload, HumanReview, KnownRiskwareUrl), `lib/flow.ts` (the `mmp_cloaking` graph with real signatures + a decryptor on the deobf node + a native_file on the native dispatch node), `lib/known-urls.ts` (O(1) lookup + recordTp), `lib/score.ts` (strong-8 + override recompute). Compiles, no UI.
2. **Mock golden case** — `lib/mock.ts`: one `CaseIdentity` + `QueueLock`, Yoda's `static_confirmed` flags + decrypted strings, and Vader's `NodeEvidence` (frida/http/screenshot, all required nodes confirmed → strong 8), `native_files` (confirmed_active), `found_urls`, and one `ExtractedPayload` (dropper). Placeholder artifacts + payload in `public/`. Seed the known-URL DB.
3. **Mission card** — `CallGraph` + `NodeCard` + `EvidenceViewer`: reconciled graph (static ↔ dynamic per node, sub-steps nested, edges, decryptor strings, native activity, known-URL badge, scoring footer). The hero — make it premium.
4. **Yoda view** — static confirm + "Send mission" (writes MissionContext via `lib/bridge.ts`).
5. **Vader view** — receive MissionContext + attach evidence (incl. native confirm, payload, found URLs) + "Send evidence" (writes EvidenceReturn).
6. **Human-in-the-loop + DB write-back** — `HumanReview` confirm/flip with score auto-update; on confirmed_tp call `recordTp`; show "DB updated" note + `PayloadCard`.
7. **Reconcile + polish** — Yoda renders returned evidence → strong 8; premium pass.

Commit + push after each phase.

---

## 10. Definition of done

- One MMP case flows **Yoda → PixelBridge → Vader → PixelBridge → Yoda**.
- The call graph shows **all 3 stages + their sub-steps** as one connected graph; every node has a **static signature** and **dynamic evidence** (Frida log + HTTP + screenshot where applicable) and a **confirmed/failed** status.
- The URL-build chain (HTTP → parse → deobfuscate) and the cloaked-load chain (coroutine and/or native → `loadUrl`) are both shown connected, not just endpoints.
- All required boundary nodes confirmed → **strong, 8 points**, `confirmed_tp`.
- The contract messages (`MissionContext`, `EvidenceReturn`) and statuses are the only things crossing the machine boundary.
- **Decryptor + recovered strings** show inline on the deobf node; the **native file** (name + unique id) shows with a confirmed-active chip.
- The **known-riskware-URL DB** does an O(1) lookup on the found URL (badge on hit) and **writes back** on `confirmed_tp`.
- **Human-in-the-loop**: per-node confirm/reject + verdict flip that **auto-updates the score**, with both agent and human verdicts retained.
- If a dropper/packer was found, an **extracted-payload card with a download** is shown.
- Renders in a premium, legible, $1B-grade cyber-research GUI.

---

## 11. Notes for the building agent

- Keep **one level of abstraction**: a node has a static signature and dynamic evidence — that's it. No worker adapters, no policy engines, no extra rubrics.
- The **contract in §4 is law**. Don't add fields the two machines don't both need.
- Sub-steps matter: prove the **whole** URL-build and load chains, including the obfuscation hops, connected into one call graph.
- Mock realistically (real-looking decompiled snippets, a real-looking tracker GET + `dl` response, a labeled affiliate screenshot), but **no real device/Frida**.
- Premium GUI = restraint + legibility + the graph as the hero. Not busy.
