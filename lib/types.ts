// Core contract types for the Darkclaude malware-review POC.
// These types model the Producer ↔ PixelBridge ↔ Consumer pipeline.
// All "agents" are abstract black-box workers behind these contracts.

export type IocLevel = 'weak' | 'medium' | 'strong';

export const IOC_POINTS: Record<IocLevel, number> = {
  weak: 2,
  medium: 4,
  strong: 8,
};

// The five malware categories an app can be reviewed under. The category
// is an INPUT chosen up-front (not a verdict) — it scopes which rubric +
// flow graphs apply.
export type MalwareCategory = 'riskware' | 'toll_fraud' | 'phishing' | 'backdoor' | 'trojan';

export const MALWARE_CATEGORY_LABEL: Record<MalwareCategory, string> = {
  riskware: 'Riskware',
  toll_fraud: 'Toll Fraud',
  phishing: 'Phishing',
  backdoor: 'Backdoor',
  trojan: 'Trojan',
};

export type CaseIdentity = {
  app_review_id: string;
  queue_item_id: string;
  // mission_id is generated per investigation. Same package+version can
  // be investigated multiple times → multiple missions. Optional in the
  // POC literals; production generates one per investigation. Use
  // getMissionId() for a stable fallback.
  mission_id?: string;
  // package_name is the durable real-world identity; version_code
  // distinguishes builds (one can be malicious, another benign).
  package_name: string;
  app_name: string;
  version_name: string;
  version_code: number;
  category_id: MalwareCategory;
  category_name: string;
};

export type ArtifactRef = {
  artifact_id: string;
  artifact_type: 'screenshot' | 'hook_log' | 'network_capture' | 'logcat' | 'static_report' | 'apk' | 'geo_matrix' | 'runtime_trace';
  path: string;
  sha256: string;
  mime_type?: string;
  size_bytes?: number;
};

export type IocDefinition = {
  ioc_id: string;
  name: string;
  levels: Record<IocLevel, { points: number; definition: string }>;
};

export type IocRubric = {
  rubric_id: string;
  rubric_version: string;
  rubric_hash: string;
  category_id: string;
  category_name: string;
  iocs: IocDefinition[];
};

export type IocCandidateScore = {
  ioc_id: string;
  level: IocLevel;
  confidence: number;
  reason: string;
  evidence_refs?: string[];
};

export type EvidenceItem = {
  evidence_id: string;
  ioc_ids: string[];
  type: ArtifactRef['artifact_type'];
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  confidence: number;
  artifact: ArtifactRef;
};

export type GeoCountry = {
  country: string;
  role: 'baseline' | 'suspected_trigger' | 'secondary_suspected_trigger';
  priority: number;
  reason: string;
};

export type FunctionCallTraceStep = {
  order: number;
  class: string;
  method: string;
  reason: string;
  // (step, evidence) tuple — each trace step can link to evidence
  // items that confirm what actually happened at that step.
  evidence_refs?: string[];
  // Which rubric IOCs this step is relevant to.
  related_ioc_ids?: string[];
};

export type SuggestedHook = {
  target: string;
  goal: string;
  // When a hook is clicked, point to evidence it actually produced
  // and/or to the related rubric IOC(s) it informs.
  evidence_refs?: string[];
  related_ioc_ids?: string[];
};

export type StaticTriage = {
  candidate_score: number;
  top_ioc_candidates: IocCandidateScore[];
  execution_hypothesis: {
    summary: string;
    suspected_flow: string[];
    function_call_trace: FunctionCallTraceStep[];
  };
  suspicious_urls: Array<{ url: string; severity: 'low' | 'medium' | 'high'; reason: string }>;
  suspicious_native_files: Array<{ path: string; severity: 'low' | 'medium' | 'high'; reason: string }>;
  suggested_hooks: SuggestedHook[];
};

export type ProducerMetadata = {
  developer_country: string;
  developer_reputation: 'low' | 'medium' | 'high' | 'unknown';
  developer_account_age_days: number;
  related_packages: string[];
  prior_flags: string[];
  target_markets: string[];
  monetization_signals: string[];
};

export type ReviewMissionPackage = {
  schema_version: '1.0.0';
  event_type: 'ReviewMissionPackage';
  message_id: string;
  created_at: string;
  source_agent: 'ProducerStaticTriageAgent';
  target_agent: 'ConsumerDynamicEvidenceAgent';
  case_identity: CaseIdentity;
  rubric_reference: {
    rubric_id: string;
    rubric_version: string;
    rubric_hash: string;
  };
  producer_metadata: ProducerMetadata;
  static_triage: StaticTriage;
  hypotheses: Array<{
    hypothesis_id: string;
    title: string;
    related_iocs: string[];
    static_basis: string[];
    validation_steps: string[];
    strong_evidence_definition: string[];
    stop_condition: string;
  }>;
  geo_execution_plan: {
    baseline_country: GeoCountry;
    recommended_vpn_countries: GeoCountry[];
  };
  consumer_budget: {
    max_total_minutes: number;
    max_iterations: number;
    max_vpn_countries: number;
    max_hook_revisions: number;
    early_stop_on_strong_evidence: boolean;
  };
  artifacts: ArtifactRef[];
  checksum: string;
};

export type Experiment = {
  iteration: number;
  goal: string;
  country: string;
  tools_used: string[];
  hooks_enabled: string[];
  result: string;
  artifacts: string[];
  next_decision: string;
};

export type DynamicEvidencePackage = {
  schema_version: '1.0.0';
  event_type: 'DynamicEvidencePackage';
  message_id: string;
  created_at: string;
  source_agent: 'ConsumerDynamicEvidenceAgent';
  target_agent: 'ProducerStaticTriageAgent';
  case_identity: CaseIdentity;
  execution_summary: {
    status: 'completed' | 'partial' | 'blocked' | 'failed';
    runtime_verdict_candidate:
      | 'malicious'
      | 'riskware'
      | 'benign'
      | 'inconclusive'
      | 'false_positive'           // static suspicion not confirmed at runtime
      | 'exploratory_finding';     // unanticipated IOC captured
    dynamic_score: number;
    confidence: number;
    summary: string;
    exploratory_finding?: ExploratoryFinding;
  };
  budget_usage: {
    actual_total_minutes: number;
    actual_iterations: number;
    vpn_countries_tested: string[];
    stop_reason: string;
  };
  ioc_scores: IocCandidateScore[];
  experiments: Experiment[];
  evidence_items: EvidenceItem[];
  runtime_trace: Array<{ step: number; event: string; artifact_ref?: string }>;
  limitations: string[];
  recommended_next_action: string;
  checksum: string;
};

export type ReconciledIocScore = {
  ioc_id: string;
  ioc_name: string;
  static_level: IocLevel | null;
  dynamic_level: IocLevel | null;
  final_level: IocLevel;
  final_points: number;
  evidence_ids: string[];
  // Audit trail per IOC — reviewers can see WHY each level was assigned
  // and which worker scored it.
  static_reason?: string;
  static_confidence?: number;
  static_scored_by?: string;
  dynamic_reason?: string;
  dynamic_confidence?: number;
  dynamic_scored_by?: string;
};

export type SubmissionReport = {
  report_id: string;
  case_identity: CaseIdentity;
  verdict_candidate: 'malicious' | 'riskware' | 'benign' | 'inconclusive';
  confidence: number;
  static_score: number;
  dynamic_score: number;
  final_score: number;
  reconciled_scores: ReconciledIocScore[];
  metadata: ProducerMetadata;
  static_summary: string;
  dynamic_summary: string;
  execution_flow: string[];
  limitations: string[];
  recommendation: string;
  created_at: string;
};

// Producer / Mission Control state machine — funnel-first with two gates
export type ProducerStatus =
  | 'QUEUE_AVAILABLE'
  | 'QUEUE_LOCKED'
  | 'CASE_CREATED'
  | 'METADATA_SCORING'
  | 'METADATA_INSUFFICIENT_CLOSED'   // closed at metadata gate — no static work needed
  | 'INSTALL_VERIFY_RUNNING'
  | 'INSTALL_VERIFY_FAILED'
  | 'STATIC_SLICE_RUNNING'
  | 'STATIC_SCORECARD_READY'
  | 'STATIC_INSUFFICIENT_CLOSED'     // closed at static gate
  | 'HUMAN_REVIEW_STATIC_GATE'
  | 'DYNAMIC_ANALYSIS_REQUIRED'
  | 'DYNAMIC_MISSION_READY'
  | 'DYNAMIC_MISSION_SENT'
  | 'CONSUMER_ACKED'
  | 'CONSUMER_RUNNING'
  | 'EVIDENCE_RECEIVED'
  | 'SCORES_RECONCILED'
  | 'DEEP_REPORT_READY'
  | 'HUMAN_REVIEW_READY'
  | 'FALSE_POSITIVE_CLOSED'          // dynamic disproved static suspicion
  | 'EXPLORATORY_FINDING_READY'      // dynamic found unanticipated IOC
  | 'SUBMITTED'
  | 'CLOSED';

// Consumer mission state machine
export type ConsumerStatus =
  | 'MISSION_RECEIVED'
  | 'MISSION_VALIDATED'
  | 'DYNAMIC_PLAN_READY'
  | 'BASELINE_RUNNING'
  | 'DYNAMIC_RUNNING'
  | 'EVIDENCE_COLLECTED'
  | 'DYNAMIC_SCORE_READY'
  | 'EVIDENCE_PACKAGE_READY'
  | 'EVIDENCE_RETURNED'
  | 'DONE';

// =====================================================================
// METADATA LAYER (runs BEFORE the static funnel)
// Cheapest filter — uses data we already have, no install, no decompile.
// =====================================================================

export type MetadataSignals = {
  developer_reputation: 'low' | 'medium' | 'high' | 'unknown';
  developer_country_risk: 'low' | 'medium' | 'high';
  account_age_days: number;
  related_packages_count: number;
  prior_flags_count: number;
  target_markets_count: number;
  monetization_signals_count: number;
};

export type MetadataScorecard = {
  schema_version: '1.0.0';
  event_type: 'MetadataScorecard';
  message_id: string;
  created_at: string;
  source_agent: 'MetadataScoutWorker';
  case_identity: CaseIdentity;
  signals: MetadataSignals;
  signal_score: number;
  threshold_for_static_analysis: number;
  requires_static_analysis: boolean;
  reasoning: string[];
  checksum: string;
};

export type MetadataGatePolicy = {
  category_id: string;
  signal_score_threshold: number;  // ≥ this → proceed to static
  auto_close_below_score: number;  // < this → close at metadata gate
  force_static_if: string[];       // rules that always escalate to static
};

export type MetadataGateStatus =
  | 'PROCEED_TO_STATIC_FUNNEL'
  | 'CLOSE_EARLY_METADATA_INSUFFICIENT'
  | 'HUMAN_REVIEW_METADATA_GATE';

export type MetadataGateDecision = {
  case_identity: CaseIdentity;
  policy_applied: MetadataGatePolicy;
  signal_score: number;
  triggered_force_rules: string[];
  status: MetadataGateStatus;
  next_step: 'PROCEED_TO_STATIC_FUNNEL' | 'GENERATE_METADATA_CLOSURE_REPORT' | 'ROUTE_TO_HUMAN_METADATA_GATE';
  explanation: string;
  decided_at: string;
};

export type MetadataClosureReport = {
  report_id: string;
  report_type: 'MetadataClosureReport';
  case_identity: CaseIdentity;
  scorecard: MetadataScorecard;
  decision_reason: string;
  limitations: string[];
  final_status: string;
  created_at: string;
};

// =====================================================================
// EXPLORATORY FINDING — runtime captured an IOC the static phase
// did NOT predict. Investigator has budget breathing room for this.
// =====================================================================

export type ExploratoryFinding = {
  finding_id: string;
  case_identity: CaseIdentity;
  unanticipated_ioc_id: string;
  unanticipated_ioc_name: string;
  level: IocLevel;
  confidence: number;
  description: string;
  evidence_artifacts: string[];
  budget_breathing_room_used_minutes: number;
  why_static_missed_it: string;
};

// =====================================================================
// FUNNEL LAYER: queue lock → install → static slice → scorecard → gate
// =====================================================================

export type QueueLock = {
  lock_id: string;
  queue_item_id: string;
  app_review_id: string;
  locked_by: string;
  locked_at: string;
  lock_expires_at: string;
  status: 'QUEUE_AVAILABLE' | 'QUEUE_LOCKED' | 'LEASE_EXPIRED' | 'RELEASED';
};

export type InstallVerification = {
  status: 'success' | 'failed';
  install_method: 'adb_install' | 'play_protect_install' | 'manual';
  package_detected: boolean;
  version_code_matches: boolean;
  launchable_activity_found: boolean;
  first_launch_success: boolean;
  error_code?: string;
  recoverable?: boolean;
  recommended_action?: string;
  notes: string;
  artifact_refs: string[];
};

export type StaticSliceSummary = {
  status: 'completed' | 'partial' | 'failed';
  decompile_status: 'success' | 'partial' | 'failed';
  manifest_parsed: boolean;
  native_files_detected: boolean;
  network_strings_detected: boolean;
  webview_usage_detected: boolean;
  candidate_flows: Array<{
    flow_id: string;
    summary: string;
    source: string;
    transform?: string;
    sink: string;
    confidence: number;
  }>;
};

// Slice verification — gate before scoring. Confirms decompile produced
// usable output so the scorecard is grounded in real evidence.
export type SliceVerification = {
  status: 'success' | 'partial' | 'failed';
  decompiler: 'jadx' | 'apktool' | 'ghidra' | 'multi';
  classes_decompiled: number;
  classes_failed: number;
  manifest_parsed: boolean;
  resources_parsed: boolean;
  obfuscation_detected: boolean;
  obfuscation_notes?: string;
  errors: string[];
  artifact_refs: string[];
};

// Per-task analytics emitted by every worker run.
export type WorkerAnalytics = {
  task_id: string;
  task_type: string;
  agent_id: string;
  case_key: string;
  status: 'completed' | 'partial' | 'blocked' | 'failed';
  started_at: string;
  completed_at: string;
  duration_ms: number;
  tokens_in: number;
  tokens_out: number;
  total_cost_usd?: number;
  notes?: string;
};

// Extracted payload — when dynamic captures a dropper / decrypted DEX /
// any artifact off the device that the human reviewer may want to
// download for offline forensics.
export type ExtractedPayload = {
  payload_id: string;
  case_identity: CaseIdentity;
  artifact_type: 'dex' | 'so' | 'apk' | 'jar' | 'binary' | 'config' | 'other';
  source_path_on_device: string;
  bridge_artifact_path: string;
  sha256: string;
  size_bytes: number;
  description: string;
  extracted_during_experiment_id?: number;
  related_ioc_ids: string[];
};

export type StaticFunnelScorecard = {
  schema_version: '1.0.0';
  event_type: 'StaticFunnelScorecard';
  message_id: string;
  created_at: string;
  source_agent: 'StaticFunnelWorker';
  case_identity: CaseIdentity;
  install_verification: InstallVerification;
  static_slice: StaticSliceSummary;
  rubric_potential: {
    candidate_score: number;
    threshold_for_dynamic_analysis: number;
    requires_dynamic_analysis: boolean;
    reason: string;
  };
  candidate_iocs: IocCandidateScore[];
  missing_rubric_signals: Array<{ ioc_id: string; ioc_name: string; reason: string }>;
  checksum: string;
};

export type GatePolicy = {
  category_id: string;
  dynamic_analysis_threshold: number;
  auto_close_below_score: number;
  human_review_band: { min: number; max: number };
  force_dynamic_if: string[];
};

export type GateDecisionStatus =
  | 'DYNAMIC_ANALYSIS_REQUIRED'
  | 'CLOSE_EARLY_STATIC_INSUFFICIENT'
  | 'HUMAN_REVIEW_STATIC_GATE'
  | 'INSTALL_FAILURE_RETRY'
  | 'INSTALL_FAILURE_CLOSE';

export type GateDecision = {
  case_identity: CaseIdentity;
  policy_applied: GatePolicy;
  candidate_score: number;
  triggered_force_rules: string[];
  status: GateDecisionStatus;
  next_step:
    | 'BUILD_DYNAMIC_MISSION_PACKAGE'
    | 'GENERATE_STATIC_CLOSURE_REPORT'
    | 'ROUTE_TO_HUMAN_STATIC_GATE'
    | 'RETRY_INSTALL'
    | 'CLOSE_WITH_TECHNICAL_FAILURE';
  explanation: string;
  decided_at: string;
};

export type StaticClosureReport = {
  report_id: string;
  report_type: 'StaticClosureReport';
  case_identity: CaseIdentity;
  install_verification: InstallVerification;
  rubric_potential: StaticFunnelScorecard['rubric_potential'];
  checked_iocs: Array<{ ioc_id: string; ioc_name: string; outcome: 'matched' | 'not_matched' }>;
  found_weak_signals: IocCandidateScore[];
  missing_strong_signals: Array<{ ioc_id: string; ioc_name: string; reason: string }>;
  decision_reason: string;
  limitations: string[];
  final_status: string;
  created_at: string;
};

// =====================================================================
// RUBRIC FLOW GRAPH — generic, graph-shaped proof config
// =====================================================================
// Every rubric/IOC communicates HOW to reach a TP verdict as a graph:
// nodes (path-pinned static signatures) + edges (chain relations).
// This config is generic — not specific to any one app. A case fills it
// with evidence (see IocProofInstance below).

export type DynamicProofMethod = 'frida' | 'http_toolkit' | 'logcat' | 'screenshot';

// A node IS a static signature — pins an exact code location so the
// Producer and Consumer machines verify with zero context gaps.
export type StaticSignature = {
  signature_id: string;
  class_name: string;        // fully-qualified, e.g. com.x.MainActivity
  method: string;            // e.g. o(java.lang.String)
  file_path: string;         // exact decompiled path, e.g. sources/com/x/MainActivity.java
  line: number;              // focal line number
  context_before: string[];  // lines above the focal line
  focal_line: string;        // the exact line of interest (highlighted in UI)
  context_after: string[];   // lines below
  smali_path?: string;       // optional, for hook precision
};

export type VerificationSpec = {
  methods: DynamicProofMethod[];
  hook_target: string;       // exact Frida target derived from the signature
  expectation: string;       // what a successful proof must show
};

export type FlowNodeKind = 'trigger' | 'transform' | 'network' | 'sink' | 'guard';

export type FlowNode = {
  node_id: string;
  label: string;
  kind: FlowNodeKind;
  what_it_does: string;
  signature: StaticSignature;
  verification: VerificationSpec;
  required_for_tp: boolean;
};

export type FlowEdgeRelation = 'calls' | 'returns_to' | 'data_flows_to' | 'triggers' | 'guards';

export type FlowEdge = {
  from: string; // node_id
  to: string;   // node_id
  relation: FlowEdgeRelation;
  label?: string;
};

export type RubricFlowGraph = {
  flow_id: string;
  category_id: MalwareCategory;
  ioc_id: string;
  ioc_name: string;
  summary: string;
  entry_node: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  scoring: {
    tp_requires: string[]; // node_ids that must be proven for TP
    note: string;
  };
};

// =====================================================================
// PER-CASE PROOF INSTANCE — attaches evidence to each graph node
// =====================================================================

export type NodeProofStatus = 'proven' | 'failed_to_prove' | 'pending' | 'needs_human';

export type NodeProof = {
  node_id: string; // references FlowNode.node_id
  status: NodeProofStatus;
  confidence: number;
  resolved_snippet?: string; // the actual decompiled code found in THIS app
  evidence: Array<{
    method: DynamicProofMethod;
    captured: boolean;
    observation: string;
    artifact_ref?: string;
  }>;
  human_note?: string;
  // Human review can reject a node it doesn't find convincing.
  human_rejected?: boolean;
};

export type IocProofInstance = {
  ioc_id: string;
  flow_id: string;
  case_key: string;
  node_proofs: Record<string, NodeProof>;
  awarded_points: number;
  all_required_proven: boolean;
};

// =====================================================================
// SCORING VERDICT (TP / FP from the dynamic score)
// =====================================================================

export type DynamicVerdict = 'strong_tp' | 'tp' | 'inconclusive' | 'strong_fp';

export const DYNAMIC_VERDICT_LABEL: Record<DynamicVerdict, string> = {
  strong_tp: 'Strong True Positive',
  tp: 'True Positive',
  inconclusive: 'Inconclusive (lean FP)',
  strong_fp: 'Strong False Positive',
};

// =====================================================================
// HUMAN-IN-THE-LOOP OVERRIDES (two distinct points)
// =====================================================================

// 1) Gate reopen — a human reopens a closed app and sends it onward.
export type GateReopenOverride = {
  reviewer: string;
  note: string;
  action: 'reopen_to_static' | 'reopen_to_dynamic' | 'uphold_closure';
  at: string;
};

// 2) Verdict flip — a human rejects the agent's proof at the evidence
// board and overrides the computed TP/FP verdict.
export type VerdictOverride = {
  reviewer: string;
  computed_verdict: DynamicVerdict;
  final_verdict: DynamicVerdict;
  reason: string;
  rejected_node_ids?: string[];
  at: string;
};

// =====================================================================
// MISSION TYPES (typed experiment bodies)
// =====================================================================

export type MissionKind = 'geo_screenshot_sweep' | 'ioc_proof_chain';

export type GeoScreenshotSweepMission = {
  kind: 'geo_screenshot_sweep';
  target: string;                 // e.g. "MainActivity.onResume"
  capture: DynamicProofMethod[];
  baseline_country: string;
  countries: string[];
  per_country_budget_seconds: number;
};

export type GeoSweepCell = {
  country: string;
  status: 'pending' | 'running' | 'captured' | 'failed' | 'needs_human';
  screenshot_ref?: string;
  differs_from_baseline?: boolean;
  note?: string;
};

// =====================================================================
// PACKAGE HISTORY CACHE + DEVICE SYNC + TRANSFER LIFECYCLE
// =====================================================================

export type PackageVersionHistory = {
  package_name: string;
  versions: Array<{
    version_code: number;
    version_name: string;
    mission_id: string;
    app_review_id: string;
    category_id: MalwareCategory;
    verdict: DynamicVerdict | 'pending';
    final_score: number;
    reviewed_at: string;
    notable_iocs: string[];
  }>;
};

export type DeviceSyncState = {
  device_id: string;
  connected: boolean;
  last_synced_at: string;
  cached_artifacts: number;
  note: string;
};

export type TransferStatus =
  | 'not_started'
  | 'installing'
  | 'install_failed'
  | 'installed'
  | 'waiting_transfer'
  | 'transferred'
  | 'on_device'
  | 'waiting_return'
  | 'returned';

// =====================================================================
// MULTI-RUBRIC SUPPORT (additive — backward compatible)
// =====================================================================
// A case can be under review for multiple categories simultaneously
// (e.g. an app suspected of BOTH riskware AND spyware). Each rubric
// gets its own hypotheses, scorecard subset, threshold, and IOC scoring
// — but they share the same identity, install, slice, and lock.

export type RubricRunState = {
  rubric: IocRubric;
  // Static-side state, scoped to this rubric.
  candidate_score: number;
  candidate_iocs: IocCandidateScore[];
  missing_signals: Array<{ ioc_id: string; ioc_name: string; reason: string }>;
  // Gate decision is per-rubric: one rubric can escalate while another closes.
  gate_status: GateDecisionStatus;
  // Reconciled scores after dynamic returns, scoped to this rubric.
  reconciled?: ReconciledIocScore[];
};

// DeepInspectionReport replaces/extends the old SubmissionReport.
// It composes the entire funnel chain into a reviewer-ready document.
export type DeepInspectionReport = SubmissionReport & {
  report_type: 'DeepInspectionReport';
  queue_lock: QueueLock;
  metadata_scorecard?: MetadataScorecard;
  metadata_gate?: MetadataGateDecision;
  install_verification: InstallVerification;
  slice_verification?: SliceVerification;
  static_slice_summary: StaticSliceSummary;
  scorecard: StaticFunnelScorecard;
  gate_decision: GateDecision;
  // The full evidence package the Investigator returned. Embedding it
  // here lets the report mount TraceWithEvidence + EvidenceBoard on
  // the same page so #evidence-<id> anchors actually resolve.
  evidence_package?: DynamicEvidencePackage;
  function_call_trace?: FunctionCallTraceStep[];
  rubric?: IocRubric;
  why_dynamic_was_triggered: string;
  human_review_checklist: Array<{ item: string; required: boolean }>;
};

export type QueueCase = {
  case_identity: CaseIdentity;
  producer_status: ProducerStatus;
  consumer_status: ConsumerStatus | null;
  priority: 'low' | 'medium' | 'high' | 'critical';
  static_score: number;
  dynamic_score: number;
  final_score: number;
  metadata: ProducerMetadata;
  rubric: IocRubric;
  // Queue lock
  queue_lock: QueueLock;
  // Metadata gate (runs first, before any install)
  metadata_scorecard?: MetadataScorecard;
  metadata_gate?: MetadataGateDecision;
  metadata_closure_report?: MetadataClosureReport;
  // Static funnel (only present if metadata gate routed to static)
  install_verification?: InstallVerification;
  slice_verification?: SliceVerification;
  static_slice_summary?: StaticSliceSummary;
  scorecard?: StaticFunnelScorecard;
  gate_decision?: GateDecision;
  closure_report?: StaticClosureReport;
  // Deep analysis (only present if static gate routed to dynamic)
  static_triage: StaticTriage;
  mission_package?: ReviewMissionPackage;
  evidence_package?: DynamicEvidencePackage;
  exploratory_finding?: ExploratoryFinding;
  extracted_payloads?: ExtractedPayload[];
  report?: DeepInspectionReport;
  worker_analytics?: WorkerAnalytics[];
  // Optional multi-rubric breakdown. When set, the case is under review
  // for 2+ categories — UI surfaces per-rubric tabs/sections. When
  // omitted, the case uses single-rubric mode (the existing `rubric` field).
  rubrics?: RubricRunState[];
  // ---- Phase: flow-graph proof + mission types + human overrides ----
  mission_kind?: MissionKind;
  geo_sweep?: GeoScreenshotSweepMission;
  geo_sweep_cells?: GeoSweepCell[];
  // Per-IOC proof instances keyed by ioc_id, each filling a RubricFlowGraph.
  ioc_proofs?: IocProofInstance[];
  // Human overrides.
  gate_reopen?: GateReopenOverride;
  verdict_override?: VerdictOverride;
  // Transport + device.
  transfer_status?: TransferStatus;
  device_sync?: DeviceSyncState;
};

// PixelBridge append-only event log
export type BridgeEventType =
  | 'QueueLockClaimed'
  | 'MetadataScorecard'
  | 'MetadataGateDecision'
  | 'MetadataClosureReport'
  | 'InstallVerification'
  | 'StaticFunnelScorecard'
  | 'GateDecision'
  | 'StaticClosureReport'
  | 'ReviewMissionPackage'
  | 'MissionAck'
  | 'MissionRejected'
  | 'ConsumerProgressUpdate'
  | 'DynamicEvidencePackage'
  | 'ExploratoryFinding'
  | 'DeepInspectionReportDraft';

export type BridgeEvent = {
  event_id: string;
  message_id: string;
  event_type: BridgeEventType;
  case_key: string;
  source: 'queue' | 'metadata_scout' | 'mission_control' | 'static_funnel' | 'producer' | 'consumer';
  target: 'queue' | 'metadata_scout' | 'mission_control' | 'static_funnel' | 'producer' | 'consumer';
  status: 'pending' | 'transferred' | 'processed' | 'error';
  created_at: string;
  checksum: string;
  size_bytes: number;
};
