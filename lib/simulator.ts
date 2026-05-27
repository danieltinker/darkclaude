// Scenario definitions for the live pipeline simulator.
// Each scenario is an ordered list of stages. Each stage owns a persona,
// an active-voice label, the artifact produced (with full structured
// payload), and a base duration. The runner multiplies durations by
// the user's speed.

import {
  DynamicEvidencePackage,
  GateDecision,
  InstallVerification,
  MetadataClosureReport,
  MetadataGateDecision,
  MetadataScorecard,
  QueueLock,
  ReviewMissionPackage,
  StaticClosureReport,
  StaticFunnelScorecard,
  StaticSliceSummary,
  SubmissionReport,
} from './types';
import { getCaseByReviewId } from './mock-data';

export type SimPersonaId = 'queue' | 'scout' | 'triager' | 'gatekeeper' | 'planner' | 'investigator' | 'reporter';

export type SimArtifact = {
  type: string;
  summary: string;
  details: Array<{ k: string; v: string }>;
  // Full structured payload (the actual contract shape).
  full_payload: unknown;
};

export type SimStage = {
  id: string;
  persona: SimPersonaId;
  label: string;        // active-voice ("Verifying install…")
  sub: string;          // result line shown when done ("install succeeded")
  duration_ms: number;
  artifact: SimArtifact | null;
  flavor?: 'metadata_gate' | 'gate_decision' | 'verdict' | 'exploratory';
};

export type Scenario = {
  id: string;
  title: string;
  subtitle: string;
  case_id: string;
  outcome: 'metadata_closure' | 'static_closure' | 'malicious' | 'false_positive' | 'exploratory_finding';
  final_link: string;
  final_link_label: string;
  outcome_label: string;
  outcome_tone: 'muted' | 'red' | 'blue' | 'violet';
  stages: SimStage[];
};

function n(k: string, v: string | number | boolean) {
  return { k, v: String(v) };
}

function lockArtifact(lock: QueueLock, appName: string, pkg: string, versionCode: number, category: string): SimArtifact {
  return {
    type: 'QueueLock',
    summary: `${lock.locked_by} owns this app for the next 30 min`,
    details: [
      n('app', appName),
      n('package', pkg),
      n('version_code', versionCode),
      n('category', category),
      n('lock_expires_at', lock.lock_expires_at),
    ],
    full_payload: lock,
  };
}

function metadataScorecardArtifact(sc: MetadataScorecard): SimArtifact {
  return {
    type: 'MetadataScorecard',
    summary: `signal_score ${sc.signal_score} / ${sc.threshold_for_static_analysis} ${sc.requires_static_analysis ? '→ proceed to static' : '→ insufficient'}`,
    details: [
      n('developer_reputation', sc.signals.developer_reputation),
      n('country_risk', sc.signals.developer_country_risk),
      n('account_age_days', sc.signals.account_age_days),
      n('prior_flags', sc.signals.prior_flags_count),
      n('monetization_signals', sc.signals.monetization_signals_count),
      n('target_markets', sc.signals.target_markets_count),
    ],
    full_payload: sc,
  };
}

function metadataGateArtifact(g: MetadataGateDecision): SimArtifact {
  return {
    type: 'MetadataGateDecision',
    summary: g.status === 'PROCEED_TO_STATIC_FUNNEL' ? 'PROCEED TO STATIC FUNNEL' : 'CLOSE AT METADATA GATE',
    details: [
      n('signal_score', g.signal_score),
      n('threshold', g.policy_applied.signal_score_threshold),
      n('force_rules', g.triggered_force_rules.join(', ') || 'none'),
      n('next_step', g.next_step),
    ],
    full_payload: g,
  };
}

function installArtifact(iv: InstallVerification): SimArtifact {
  return {
    type: 'InstallVerification',
    summary: iv.status,
    details: [
      n('install_method', iv.install_method),
      n('package_detected', iv.package_detected),
      n('version_code_matches', iv.version_code_matches),
      n('first_launch_success', iv.first_launch_success),
    ],
    full_payload: iv,
  };
}

function sliceArtifact(s: StaticSliceSummary): SimArtifact {
  return {
    type: 'StaticSliceSummary',
    summary: `${s.candidate_flows.length} candidate flow(s) · ${s.webview_usage_detected ? 'WebView' : ''} ${s.native_files_detected ? '+ native' : ''}`,
    details: [
      n('webview_usage_detected', s.webview_usage_detected),
      n('native_files_detected', s.native_files_detected),
      n('network_strings_detected', s.network_strings_detected),
      n('candidate_flows', s.candidate_flows.length),
    ],
    full_payload: s,
  };
}

function scorecardArtifact(sc: StaticFunnelScorecard): SimArtifact {
  return {
    type: 'StaticFunnelScorecard',
    summary: `score ${sc.rubric_potential.candidate_score} / ${sc.rubric_potential.threshold_for_dynamic_analysis} ${sc.rubric_potential.requires_dynamic_analysis ? '→ dynamic required' : '→ below threshold'}`,
    details: [
      n('candidate_iocs_count', sc.candidate_iocs.length),
      n('missing_signals_count', sc.missing_rubric_signals.length),
      ...sc.candidate_iocs.slice(0, 3).map(i => n(i.ioc_id, `${i.level.toUpperCase()} · conf ${i.confidence.toFixed(2)}`)),
    ],
    full_payload: sc,
  };
}

function gateArtifact(g: GateDecision): SimArtifact {
  return {
    type: 'GateDecision',
    summary: g.status.replace(/_/g, ' '),
    details: [
      n('candidate_score', g.candidate_score),
      n('threshold', g.policy_applied.dynamic_analysis_threshold),
      n('force_rules', g.triggered_force_rules.join(', ') || 'none'),
      n('next_step', g.next_step),
    ],
    full_payload: g,
  };
}

function missionArtifact(m: ReviewMissionPackage): SimArtifact {
  return {
    type: 'ReviewMissionPackage',
    summary: `${m.hypotheses.length} hypothesis · ${m.geo_execution_plan.recommended_vpn_countries.length} VPN countries · ${m.consumer_budget.max_total_minutes}m budget`,
    details: [
      n('message_id', m.message_id),
      n('rubric_hash', m.rubric_reference.rubric_hash.slice(0, 24) + '…'),
      n('top_hypothesis', m.hypotheses[0]?.title ?? '—'),
      n('baseline_country', m.geo_execution_plan.baseline_country.country),
      n('budget_minutes', m.consumer_budget.max_total_minutes),
      n('suggested_hooks', m.static_triage.suggested_hooks.length),
      n('checksum', m.checksum.slice(0, 24) + '…'),
    ],
    full_payload: m,
  };
}

function evidenceArtifact(e: DynamicEvidencePackage): SimArtifact {
  return {
    type: 'DynamicEvidencePackage',
    summary: `verdict: ${e.execution_summary.runtime_verdict_candidate.replace(/_/g, ' ')} · score ${e.execution_summary.dynamic_score} · confidence ${e.execution_summary.confidence.toFixed(2)}`,
    details: [
      n('experiments', e.experiments.length),
      n('evidence_items', e.evidence_items.length),
      n('budget_used_minutes', e.budget_usage.actual_total_minutes),
      n('stop_reason', e.budget_usage.stop_reason),
    ],
    full_payload: e,
  };
}

function deepReportArtifact(r: SubmissionReport & { report_type: string; why_dynamic_was_triggered: string; human_review_checklist: Array<{ item: string; required: boolean }>; queue_lock: QueueLock; install_verification: InstallVerification; static_slice_summary: StaticSliceSummary; scorecard: StaticFunnelScorecard; gate_decision: GateDecision; }): SimArtifact {
  return {
    type: 'DeepInspectionReport',
    summary: `verdict: ${r.verdict_candidate} · final score ${r.final_score} · awaiting human review`,
    details: [
      n('static_score', r.static_score),
      n('dynamic_score', r.dynamic_score),
      n('final_score', r.final_score),
      n('verdict_candidate', r.verdict_candidate),
      n('confidence', r.confidence.toFixed(2)),
      n('checklist_required_items', r.human_review_checklist.filter(i => i.required).length),
    ],
    full_payload: r,
  };
}

function metadataClosureArtifact(r: MetadataClosureReport): SimArtifact {
  return {
    type: 'MetadataClosureReport',
    summary: 'closed at metadata gate · no install needed',
    details: [
      n('signal_score', r.scorecard.signal_score),
      n('threshold', r.scorecard.threshold_for_static_analysis),
      n('final_status', r.final_status),
    ],
    full_payload: r,
  };
}

function staticClosureArtifact(r: StaticClosureReport): SimArtifact {
  return {
    type: 'StaticClosureReport',
    summary: 'closed: insufficient static rubric potential',
    details: [
      n('checked_iocs', r.checked_iocs.length),
      n('weak_signals_found', r.found_weak_signals.length),
      n('strong_signals_missing', r.missing_strong_signals.length),
      n('final_status', r.final_status),
    ],
    full_payload: r,
  };
}

// =====================================================================
// SCENARIO 1: METADATA-GATE CLOSURE — closes BEFORE install
// =====================================================================

function buildMetadataClosureScenario(): Scenario {
  const c = getCaseByReviewId('review_2026_000301')!;
  return {
    id: 'metadata_closure_clearnote',
    title: '1. Not enough metadata to investigate',
    subtitle: 'ClearNote Calendar: high-rep publisher, no monetization, no flags. Closes at metadata gate — no install required.',
    case_id: c.case_identity.app_review_id,
    outcome: 'metadata_closure',
    final_link: `/producer/case/${c.case_identity.app_review_id}`,
    final_link_label: 'Open the case file',
    outcome_label: 'METADATA INSUFFICIENT · NO STATIC WORK NEEDED',
    outcome_tone: 'muted',
    stages: [
      {
        id: 'lock',
        persona: 'queue',
        label: 'Locking the app from the queue',
        sub: 'lease acquired',
        duration_ms: 600,
        artifact: lockArtifact(c.queue_lock, c.case_identity.app_name, c.case_identity.package_name, c.case_identity.version_code, c.case_identity.category_name),
      },
      {
        id: 'metadata_scorecard',
        persona: 'scout',
        label: 'Scoring the app from metadata alone',
        sub: 'signal_score 0 — completely clean publisher',
        duration_ms: 800,
        artifact: metadataScorecardArtifact(c.metadata_scorecard!),
      },
      {
        id: 'metadata_gate',
        persona: 'gatekeeper',
        label: 'Applying metadata-gate policy',
        sub: 'score below threshold AND no force-rule triggered',
        duration_ms: 900,
        flavor: 'metadata_gate',
        artifact: metadataGateArtifact(c.metadata_gate!),
      },
      {
        id: 'closure',
        persona: 'reporter',
        label: 'Drafting metadata closure report',
        sub: 'closed at metadata gate · no install needed',
        duration_ms: 1100,
        flavor: 'verdict',
        artifact: metadataClosureArtifact(c.metadata_closure_report!),
      },
    ],
  };
}

// =====================================================================
// SCENARIO 2: STATIC-FUNNEL CLOSURE — Lumen Notepad
// =====================================================================

function buildStaticClosureScenario(): Scenario {
  const c = getCaseByReviewId('review_2026_000245')!;
  return {
    id: 'static_closure_lumen',
    title: '2. Not enough rubric for deep investigation',
    subtitle: 'Lumen Notepad: passes metadata gate, but static slice finds only weak WebView use for bundled help.',
    case_id: c.case_identity.app_review_id,
    outcome: 'static_closure',
    final_link: `/producer/closure/${c.case_identity.app_review_id}`,
    final_link_label: 'Open the static closure report',
    outcome_label: 'CLOSED EARLY · INSUFFICIENT STATIC RUBRIC POTENTIAL',
    outcome_tone: 'muted',
    stages: [
      { id: 'lock', persona: 'queue', label: 'Locking the app from the queue', sub: 'lease acquired', duration_ms: 600, artifact: lockArtifact(c.queue_lock, c.case_identity.app_name, c.case_identity.package_name, c.case_identity.version_code, c.case_identity.category_name) },
      { id: 'metadata_scorecard', persona: 'scout', label: 'Scoring the app from metadata alone', sub: `signal_score ${c.metadata_scorecard!.signal_score} → above threshold`, duration_ms: 800, artifact: metadataScorecardArtifact(c.metadata_scorecard!) },
      { id: 'metadata_gate', persona: 'gatekeeper', label: 'Applying metadata-gate policy', sub: 'proceed to static funnel', duration_ms: 900, flavor: 'metadata_gate', artifact: metadataGateArtifact(c.metadata_gate!) },
      { id: 'install', persona: 'triager', label: 'Installing and verifying the app runs', sub: 'install ok', duration_ms: 1000, artifact: installArtifact(c.install_verification!) },
      { id: 'slice', persona: 'triager', label: 'Slicing the code for indicators', sub: 'WebView found but only loads bundled help', duration_ms: 1200, artifact: sliceArtifact(c.static_slice_summary!) },
      { id: 'scorecard', persona: 'triager', label: 'Mapping findings to the riskware rubric', sub: 'candidate score 2 · key signals missing', duration_ms: 1300, artifact: scorecardArtifact(c.scorecard!) },
      { id: 'gate', persona: 'gatekeeper', label: 'Applying static-gate policy', sub: 'score below auto-close threshold AND no force-rule triggered', duration_ms: 1300, flavor: 'gate_decision', artifact: gateArtifact(c.gate_decision!) },
      { id: 'closure', persona: 'reporter', label: 'Drafting static closure report', sub: '"insufficient static rubric potential" — not "benign"', duration_ms: 1200, flavor: 'verdict', artifact: staticClosureArtifact(c.closure_report!) },
    ],
  };
}

// =====================================================================
// SCENARIO 3.1: MALICIOUS — Daily Offers Hub
// =====================================================================

function buildMaliciousScenario(): Scenario {
  const c = getCaseByReviewId('review_2026_000143')!;
  return {
    id: 'malicious_daily_offers',
    title: '3.1. Dynamic confirms — MALICIOUS',
    subtitle: 'Daily Offers Hub: C2 returns URL, app loads it in a hidden WebView. Strong evidence captured at runtime.',
    case_id: c.case_identity.app_review_id,
    outcome: 'malicious',
    final_link: `/producer/report/${c.case_identity.app_review_id}`,
    final_link_label: 'Open the deep inspection report',
    outcome_label: 'MALICIOUS · AWAITING HUMAN REVIEW',
    outcome_tone: 'red',
    stages: [
      { id: 'lock', persona: 'queue', label: 'Locking the app from the queue', sub: 'lease acquired', duration_ms: 600, artifact: lockArtifact(c.queue_lock, c.case_identity.app_name, c.case_identity.package_name, c.case_identity.version_code, c.case_identity.category_name) },
      { id: 'metadata_scorecard', persona: 'scout', label: 'Scoring the app from metadata alone', sub: 'multiple signals — proceed to static', duration_ms: 700, artifact: metadataScorecardArtifact(c.metadata_scorecard!) },
      { id: 'metadata_gate', persona: 'gatekeeper', label: 'Applying metadata-gate policy', sub: 'proceed to static funnel', duration_ms: 700, flavor: 'metadata_gate', artifact: metadataGateArtifact(c.metadata_gate!) },
      { id: 'install', persona: 'triager', label: 'Installing and verifying the app runs', sub: 'install ok', duration_ms: 900, artifact: installArtifact(c.install_verification!) },
      { id: 'slice', persona: 'triager', label: 'Slicing the code for fast structured indicators', sub: 'WebView + endpoint + flow → loadUrl', duration_ms: 1100, artifact: sliceArtifact(c.static_slice_summary!) },
      { id: 'scorecard', persona: 'triager', label: 'Mapping findings to the riskware rubric', sub: 'candidate score 10 · 3 IOCs medium', duration_ms: 1200, artifact: scorecardArtifact(c.scorecard!) },
      { id: 'gate', persona: 'gatekeeper', label: 'Applying static-gate policy', sub: 'score ≥ threshold AND force-rule triggered', duration_ms: 1300, flavor: 'gate_decision', artifact: gateArtifact(c.gate_decision!) },
      { id: 'mission', persona: 'planner', label: 'Building the dynamic mission package', sub: '1 hypothesis · 2 VPN countries · 45m budget · 3 hooks', duration_ms: 1300, artifact: missionArtifact(c.mission_package!) },
      { id: 'evidence', persona: 'investigator', label: 'Running experiments and capturing evidence', sub: 'C2 + WebView + screenshot captured', duration_ms: 1500, artifact: evidenceArtifact(c.evidence_package!) },
      { id: 'report', persona: 'reporter', label: 'Reconciling and drafting deep inspection report', sub: 'final score 24 · MALICIOUS · awaiting human review', duration_ms: 1300, flavor: 'verdict', artifact: deepReportArtifact(c.report!) },
    ],
  };
}

// =====================================================================
// SCENARIO 3.2: FALSE POSITIVE — Mira Music Player
// =====================================================================

function buildFalsePositiveScenario(): Scenario {
  const c = getCaseByReviewId('review_2026_000312')!;
  return {
    id: 'false_positive_mira',
    title: '3.2. Dynamic disproves — FALSE POSITIVE',
    subtitle: 'Mira Music Player: static suspected remote-controlled WebView, but runtime shows only bundled tutorials.',
    case_id: c.case_identity.app_review_id,
    outcome: 'false_positive',
    final_link: `/producer/case/${c.case_identity.app_review_id}`,
    final_link_label: 'Open the case file',
    outcome_label: 'FALSE POSITIVE · STATIC SUSPICION NOT CONFIRMED',
    outcome_tone: 'blue',
    stages: [
      { id: 'lock', persona: 'queue', label: 'Locking the app from the queue', sub: 'lease acquired', duration_ms: 600, artifact: lockArtifact(c.queue_lock, c.case_identity.app_name, c.case_identity.package_name, c.case_identity.version_code, c.case_identity.category_name) },
      { id: 'metadata_scorecard', persona: 'scout', label: 'Scoring the app from metadata alone', sub: 'mid-range metadata signals — proceed', duration_ms: 700, artifact: metadataScorecardArtifact(c.metadata_scorecard!) },
      { id: 'metadata_gate', persona: 'gatekeeper', label: 'Applying metadata-gate policy', sub: 'proceed to static funnel', duration_ms: 700, flavor: 'metadata_gate', artifact: metadataGateArtifact(c.metadata_gate!) },
      { id: 'install', persona: 'triager', label: 'Installing and verifying the app runs', sub: 'install ok', duration_ms: 900, artifact: installArtifact(c.install_verification!) },
      { id: 'slice', persona: 'triager', label: 'Slicing the code for indicators', sub: 'WebView + network code present, flow ambiguous', duration_ms: 1100, artifact: sliceArtifact(c.static_slice_summary!) },
      { id: 'scorecard', persona: 'triager', label: 'Mapping findings to the rubric', sub: 'candidate score 6 (gray band) — but force-rule applies', duration_ms: 1200, artifact: scorecardArtifact(c.scorecard!) },
      { id: 'gate', persona: 'gatekeeper', label: 'Applying static-gate policy', sub: 'force-rule "remote_controlled_webview_candidate" — escalate', duration_ms: 1300, flavor: 'gate_decision', artifact: gateArtifact(c.gate_decision!) },
      { id: 'mission', persona: 'planner', label: 'Building the dynamic mission package', sub: '1 hypothesis · 30m budget', duration_ms: 1100, artifact: missionArtifact(c.mission_package!) },
      { id: 'evidence', persona: 'investigator', label: 'Running experiments to confirm or disprove', sub: 'WebView only loaded bundled tutorials · no remote control', duration_ms: 1500, artifact: evidenceArtifact(c.evidence_package!) },
      { id: 'fp_close', persona: 'reporter', label: 'Closing the case as false positive', sub: 'static suspicion not confirmed at runtime', duration_ms: 1200, flavor: 'verdict', artifact: {
        type: 'CaseClosure',
        summary: 'false_positive · evidence summary returned',
        details: [
          n('verdict', 'false_positive'),
          n('dynamic_score', 0),
          n('confidence', '0.86'),
          n('recommended_next_action', 'close_as_false_positive'),
        ],
        full_payload: {
          report_type: 'FalsePositiveClosure',
          case_identity: c.case_identity,
          evidence_summary: c.evidence_package!.execution_summary,
          limitations: c.evidence_package!.limitations,
        },
      } },
    ],
  };
}

// =====================================================================
// SCENARIO 3.3: EXPLORATORY FINDING — SnapRead OCR Scanner
// =====================================================================

function buildExploratoryScenario(): Scenario {
  const c = getCaseByReviewId('review_2026_000333')!;
  return {
    id: 'exploratory_snapread',
    title: '3.3. Exploratory — UNANTICIPATED IOC found',
    subtitle: 'SnapRead OCR: static predicted WebView risk; runtime discovered an SMS premium-subscription trap in the budget breathing room.',
    case_id: c.case_identity.app_review_id,
    outcome: 'exploratory_finding',
    final_link: `/producer/case/${c.case_identity.app_review_id}`,
    final_link_label: 'Open the case file',
    outcome_label: 'EXPLORATORY FINDING · NEW IOC CAPTURED',
    outcome_tone: 'violet',
    stages: [
      { id: 'lock', persona: 'queue', label: 'Locking the app from the queue', sub: 'lease acquired', duration_ms: 600, artifact: lockArtifact(c.queue_lock, c.case_identity.app_name, c.case_identity.package_name, c.case_identity.version_code, c.case_identity.category_name) },
      { id: 'metadata_scorecard', persona: 'scout', label: 'Scoring the app from metadata alone', sub: 'low rep + new account + monetization — proceed', duration_ms: 700, artifact: metadataScorecardArtifact(c.metadata_scorecard!) },
      { id: 'metadata_gate', persona: 'gatekeeper', label: 'Applying metadata-gate policy', sub: 'proceed to static funnel', duration_ms: 700, flavor: 'metadata_gate', artifact: metadataGateArtifact(c.metadata_gate!) },
      { id: 'install', persona: 'triager', label: 'Installing and verifying the app runs', sub: 'install ok', duration_ms: 900, artifact: installArtifact(c.install_verification!) },
      { id: 'slice', persona: 'triager', label: 'Slicing the code for indicators', sub: 'reward-claim WebView found', duration_ms: 1100, artifact: sliceArtifact(c.static_slice_summary!) },
      { id: 'scorecard', persona: 'triager', label: 'Mapping findings to the rubric', sub: 'candidate score 9 → dynamic required', duration_ms: 1200, artifact: scorecardArtifact(c.scorecard!) },
      { id: 'gate', persona: 'gatekeeper', label: 'Applying static-gate policy', sub: 'score ≥ threshold AND force-rule fired', duration_ms: 1100, flavor: 'gate_decision', artifact: gateArtifact(c.gate_decision!) },
      { id: 'mission', persona: 'planner', label: 'Building the dynamic mission package', sub: '1 hypothesis · 45m budget · breathing room enabled', duration_ms: 1100, artifact: missionArtifact(c.mission_package!) },
      { id: 'evidence', persona: 'investigator', label: 'Investigator chases unanticipated SMS path with breathing-room budget', sub: 'SMS_SEND intent + consent overlay captured · NEW IOC', duration_ms: 1900, flavor: 'exploratory', artifact: evidenceArtifact(c.evidence_package!) },
      { id: 'finding', persona: 'reporter', label: 'Surfacing exploratory finding to human review + rubric team', sub: 'recommendation: submit + request rubric update', duration_ms: 1200, flavor: 'verdict', artifact: {
        type: 'ExploratoryFinding',
        summary: c.exploratory_finding!.unanticipated_ioc_name,
        details: [
          n('level', c.exploratory_finding!.level),
          n('confidence', c.exploratory_finding!.confidence.toFixed(2)),
          n('breathing_room_used_minutes', c.exploratory_finding!.budget_breathing_room_used_minutes),
          n('evidence_count', c.exploratory_finding!.evidence_artifacts.length),
        ],
        full_payload: c.exploratory_finding,
      } },
    ],
  };
}

export const SCENARIOS: Scenario[] = [
  buildMetadataClosureScenario(),
  buildStaticClosureScenario(),
  buildMaliciousScenario(),
  buildFalsePositiveScenario(),
  buildExploratoryScenario(),
];

export const PERSONA_META: Record<SimPersonaId, { monogram: string; name: string; color: 'green' | 'blue' | 'amber' | 'violet' }> = {
  queue: { monogram: 'QL', name: 'Queue Lock', color: 'green' },
  scout: { monogram: 'SC', name: 'The Scout', color: 'green' },
  triager: { monogram: 'TR', name: 'The Triager', color: 'blue' },
  gatekeeper: { monogram: 'GK', name: 'The Gatekeeper', color: 'amber' },
  planner: { monogram: 'MP', name: 'The Mission Planner', color: 'violet' },
  investigator: { monogram: 'IN', name: 'The Investigator', color: 'green' },
  reporter: { monogram: 'RP', name: 'The Reporter', color: 'green' },
};
