// Core contract types for the Darkclaude malware-review POC.
// These types model the Producer ↔ PixelBridge ↔ Consumer pipeline.
// All "agents" are abstract black-box workers behind these contracts.

export type IocLevel = 'weak' | 'medium' | 'strong';

export const IOC_POINTS: Record<IocLevel, number> = {
  weak: 2,
  medium: 4,
  strong: 8,
};

export type CaseIdentity = {
  app_review_id: string;
  queue_item_id: string;
  package_name: string;
  app_name: string;
  version_name: string;
  version_code: number;
  category_id: string;
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

export type StaticTriage = {
  candidate_score: number;
  top_ioc_candidates: IocCandidateScore[];
  execution_hypothesis: {
    summary: string;
    suspected_flow: string[];
    function_call_trace: Array<{
      order: number;
      class: string;
      method: string;
      reason: string;
    }>;
  };
  suspicious_urls: Array<{ url: string; severity: 'low' | 'medium' | 'high'; reason: string }>;
  suspicious_native_files: Array<{ path: string; severity: 'low' | 'medium' | 'high'; reason: string }>;
  suggested_hooks: Array<{ target: string; goal: string }>;
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
    runtime_verdict_candidate: 'malicious' | 'riskware' | 'benign' | 'inconclusive';
    dynamic_score: number;
    confidence: number;
    summary: string;
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

// Producer / Mission Control state machine — funnel-first
export type ProducerStatus =
  | 'QUEUE_AVAILABLE'
  | 'QUEUE_LOCKED'
  | 'CASE_CREATED'
  | 'INSTALL_VERIFY_RUNNING'
  | 'INSTALL_VERIFY_FAILED'
  | 'STATIC_SLICE_RUNNING'
  | 'STATIC_SCORECARD_READY'
  | 'STATIC_INSUFFICIENT_CLOSED'
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
  | 'EVIDENCE_PACKAGE_SENT'
  | 'DONE';

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

// DeepInspectionReport replaces/extends the old SubmissionReport.
// It composes the entire funnel chain into a reviewer-ready document.
export type DeepInspectionReport = SubmissionReport & {
  report_type: 'DeepInspectionReport';
  queue_lock: QueueLock;
  install_verification: InstallVerification;
  static_slice_summary: StaticSliceSummary;
  scorecard: StaticFunnelScorecard;
  gate_decision: GateDecision;
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
  // Funnel layer
  queue_lock: QueueLock;
  install_verification?: InstallVerification;
  static_slice_summary?: StaticSliceSummary;
  scorecard?: StaticFunnelScorecard;
  gate_decision?: GateDecision;
  closure_report?: StaticClosureReport;
  // Deep analysis (only present if gate routed to dynamic)
  static_triage: StaticTriage;
  mission_package?: ReviewMissionPackage;
  evidence_package?: DynamicEvidencePackage;
  report?: DeepInspectionReport;
};

// PixelBridge append-only event log
export type BridgeEventType =
  | 'QueueLockClaimed'
  | 'InstallVerification'
  | 'StaticFunnelScorecard'
  | 'GateDecision'
  | 'StaticClosureReport'
  | 'ReviewMissionPackage'
  | 'MissionAck'
  | 'MissionRejected'
  | 'ConsumerProgressUpdate'
  | 'DynamicEvidencePackage'
  | 'DeepInspectionReportDraft';

export type BridgeEvent = {
  event_id: string;
  message_id: string;
  event_type: BridgeEventType;
  case_key: string;
  source: 'queue' | 'mission_control' | 'static_funnel' | 'producer' | 'consumer';
  target: 'queue' | 'mission_control' | 'static_funnel' | 'producer' | 'consumer';
  status: 'pending' | 'transferred' | 'processed' | 'error';
  created_at: string;
  checksum: string;
  size_bytes: number;
};
