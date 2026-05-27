// Scenario definitions for the live pipeline simulator.
// Each scenario is an ordered list of stages. Each stage knows its
// owning persona, the action label, the artifact produced, and a base
// duration (ms). The runner multiplies durations by the user's speed.

import { QUEUE_CASES, getCaseByReviewId } from './mock-data';

export type SimPersonaId = 'queue' | 'triager' | 'gatekeeper' | 'planner' | 'investigator' | 'reporter';

export type SimArtifact = {
  type: string;
  summary: string;
  details: Array<{ k: string; v: string }>;
};

export type SimStage = {
  id: string;
  persona: SimPersonaId;
  label: string;        // active-voice ("Verifying install…")
  sub: string;          // result line shown when done ("install succeeded")
  duration_ms: number;
  artifact: SimArtifact | null;
  // For special UI treatment of the gate's decision moment
  flavor?: 'gate_decision' | 'verdict';
};

export type Scenario = {
  id: string;
  title: string;
  subtitle: string;
  case_id: string;
  outcome: 'closure' | 'dynamic_to_report';
  final_link: string;
  final_link_label: string;
  stages: SimStage[];
};

function n(k: string, v: string | number | boolean) {
  return { k, v: String(v) };
}

// =====================================================================
// Scenario 1: Riskware — full funnel + dynamic + deep report
// =====================================================================

function buildRiskwareScenario(): Scenario {
  const c = getCaseByReviewId('review_2026_000143')!;
  return {
    id: 'riskware_c2_webview',
    title: 'Server tells the app where to load',
    subtitle: 'Riskware: C2 endpoint returns a URL → app loads it in hidden WebView.',
    case_id: c.case_identity.app_review_id,
    outcome: 'dynamic_to_report',
    final_link: `/producer/report/${c.case_identity.app_review_id}`,
    final_link_label: 'Open the deep inspection report',
    stages: [
      {
        id: 'lock',
        persona: 'queue',
        label: 'Locking the app from the queue',
        sub: 'lease acquired, case identity created',
        duration_ms: 700,
        artifact: {
          type: 'QueueLock',
          summary: `${c.queue_lock.locked_by} owns this app for the next 30 min`,
          details: [
            n('app', c.case_identity.app_name),
            n('package', c.case_identity.package_name),
            n('version_code', c.case_identity.version_code),
            n('category', c.case_identity.category_name),
            n('lock_expires_at', c.queue_lock.lock_expires_at),
          ],
        },
      },
      {
        id: 'install',
        persona: 'triager',
        label: 'Installing and verifying the app runs',
        sub: 'install ok · package detected · launchable activity found',
        duration_ms: 1100,
        artifact: {
          type: 'InstallVerification',
          summary: 'success',
          details: [
            n('install_method', c.install_verification!.install_method),
            n('package_detected', c.install_verification!.package_detected),
            n('version_code_matches', c.install_verification!.version_code_matches),
            n('first_launch_success', c.install_verification!.first_launch_success),
          ],
        },
      },
      {
        id: 'slice',
        persona: 'triager',
        label: 'Slicing the code for fast structured indicators',
        sub: 'WebView detected · network strings detected · 1 candidate flow',
        duration_ms: 1300,
        artifact: {
          type: 'StaticSliceSummary',
          summary: 'WebView + remote endpoint + flow C2 → parser → WebView.loadUrl',
          details: [
            n('webview_usage_detected', true),
            n('network_strings_detected', true),
            n('native_files_detected', false),
            n('candidate_flow', `${c.static_slice_summary!.candidate_flows[0].source} → ${c.static_slice_summary!.candidate_flows[0].sink}`),
          ],
        },
      },
      {
        id: 'scorecard',
        persona: 'triager',
        label: 'Mapping slice findings to the riskware rubric',
        sub: `candidate score ${c.scorecard!.rubric_potential.candidate_score} (3 IOCs matched · 1 missing)`,
        duration_ms: 1500,
        artifact: {
          type: 'StaticFunnelScorecard',
          summary: `score ${c.scorecard!.rubric_potential.candidate_score} / ${c.scorecard!.rubric_potential.threshold_for_dynamic_analysis} → dynamic required`,
          details: c.scorecard!.candidate_iocs.map(i => ({
            k: i.ioc_id,
            v: `${i.level.toUpperCase()} · conf ${i.confidence.toFixed(2)}`,
          })),
        },
      },
      {
        id: 'gate',
        persona: 'gatekeeper',
        label: 'Applying gate policy',
        sub: 'score ≥ threshold AND force-rule triggered',
        duration_ms: 1500,
        flavor: 'gate_decision',
        artifact: {
          type: 'GateDecision',
          summary: 'DYNAMIC ANALYSIS REQUIRED',
          details: [
            n('candidate_score', c.gate_decision!.candidate_score),
            n('threshold', c.gate_decision!.policy_applied.dynamic_analysis_threshold),
            n('force_rules', c.gate_decision!.triggered_force_rules.join(', ') || 'none'),
            n('next_step', c.gate_decision!.next_step),
          ],
        },
      },
      {
        id: 'mission',
        persona: 'planner',
        label: 'Building the dynamic mission',
        sub: 'hypothesis · VPN matrix · hooks · 45m budget',
        duration_ms: 1300,
        artifact: {
          type: 'ReviewMissionPackage',
          summary: 'one hypothesis · two VPN countries (US baseline, BR trigger) · three hooks',
          details: [
            n('hypothesis', c.mission_package!.hypotheses[0].title),
            n('baseline_country', c.mission_package!.geo_execution_plan.baseline_country.country),
            n('vpn_country', c.mission_package!.geo_execution_plan.recommended_vpn_countries[0].country),
            n('budget_minutes', c.mission_package!.consumer_budget.max_total_minutes),
            n('hooks_suggested', c.mission_package!.static_triage.suggested_hooks.length),
          ],
        },
      },
      {
        id: 'exp1',
        persona: 'investigator',
        label: 'Experiment 1: baseline US run',
        sub: 'C2 contacted · no WebView load observed',
        duration_ms: 1100,
        artifact: {
          type: 'ExperimentRun',
          summary: 'baseline established',
          details: [
            n('country', 'US'),
            n('tools', 'logcat · http_toolkit'),
            n('result', 'C2 returned empty offer set'),
          ],
        },
      },
      {
        id: 'exp2',
        persona: 'investigator',
        label: 'Experiment 2: BR VPN run with hooks',
        sub: 'C2 returned offer_url · WebView.loadUrl captured same URL',
        duration_ms: 1300,
        artifact: {
          type: 'ExperimentRun',
          summary: 'geo-gated behavior triggered',
          details: [
            n('country', 'BR'),
            n('tools', 'frida · http_toolkit · logcat'),
            n('hook_captured', 'WebView.loadUrl(https://promo.luckydeals.br/offer/9921)'),
            n('c2_response', 'offer_url field returned by /o/v3'),
          ],
        },
      },
      {
        id: 'exp3',
        persona: 'investigator',
        label: 'Experiment 3: capture visual evidence',
        sub: 'screenshot taken · WebView rendered offer page in hidden container',
        duration_ms: 1100,
        artifact: {
          type: 'ExperimentRun',
          summary: 'visual evidence captured',
          details: [
            n('country', 'BR'),
            n('tools', 'screenshot_capture · overlay_recorder'),
            n('artifact', 'screenshots/webview_payload.png'),
          ],
        },
      },
      {
        id: 'evidence',
        persona: 'investigator',
        label: 'Scoring evidence and packaging for return',
        sub: 'dynamic score 24 · 3 IOCs strong · stop early (strong evidence found)',
        duration_ms: 1100,
        artifact: {
          type: 'DynamicEvidencePackage',
          summary: 'runtime verdict candidate: riskware · confidence 0.91',
          details: [
            n('dynamic_score', 24),
            n('iocs_strong', 3),
            n('experiments', 3),
            n('budget_used_minutes', 38),
            n('stop_reason', 'strong_runtime_evidence_found'),
          ],
        },
      },
      {
        id: 'report',
        persona: 'reporter',
        label: 'Reconciling and drafting deep inspection report',
        sub: 'final score 24 → MALICIOUS · human review checklist generated',
        duration_ms: 1300,
        flavor: 'verdict',
        artifact: {
          type: 'DeepInspectionReport',
          summary: 'verdict candidate: malicious · awaiting human review',
          details: [
            n('static_score', c.report!.static_score),
            n('dynamic_score', c.report!.dynamic_score),
            n('final_score', c.report!.final_score),
            n('verdict_candidate', c.report!.verdict_candidate),
            n('recommendation', c.report!.recommendation),
          ],
        },
      },
    ],
  };
}

// =====================================================================
// Scenario 2: Closure — funnel insufficient, gate closes early
// =====================================================================

function buildClosureScenario(): Scenario {
  const c = getCaseByReviewId('review_2026_000245')!;
  return {
    id: 'closure_lumen_notepad',
    title: 'Not enough rubric to investigate',
    subtitle: 'Lumen Notepad: a clean notepad with only weak WebView usage for bundled help.',
    case_id: c.case_identity.app_review_id,
    outcome: 'closure',
    final_link: `/producer/closure/${c.case_identity.app_review_id}`,
    final_link_label: 'Open the static closure report',
    stages: [
      {
        id: 'lock',
        persona: 'queue',
        label: 'Locking the app from the queue',
        sub: 'lease acquired',
        duration_ms: 700,
        artifact: {
          type: 'QueueLock',
          summary: `${c.queue_lock.locked_by} owns this app`,
          details: [
            n('app', c.case_identity.app_name),
            n('package', c.case_identity.package_name),
            n('category', c.case_identity.category_name),
          ],
        },
      },
      {
        id: 'install',
        persona: 'triager',
        label: 'Installing and verifying the app runs',
        sub: 'install ok · benign-looking notepad',
        duration_ms: 1000,
        artifact: {
          type: 'InstallVerification',
          summary: 'success',
          details: [
            n('install_method', 'adb_install'),
            n('first_launch_success', true),
          ],
        },
      },
      {
        id: 'slice',
        persona: 'triager',
        label: 'Slicing the code for indicators',
        sub: 'WebView found but only loads bundled help · no remote URL influence',
        duration_ms: 1300,
        artifact: {
          type: 'StaticSliceSummary',
          summary: 'WebView loads bundled assets only · no C2 · no config endpoint',
          details: [
            n('webview_usage_detected', true),
            n('network_strings_detected', true),
            n('candidate_flow', 'AssetLoader.loadHelpHtml → HelpWebView'),
            n('webview_loads_remote_url', false),
          ],
        },
      },
      {
        id: 'scorecard',
        persona: 'triager',
        label: 'Mapping findings to the rubric',
        sub: `candidate score ${c.scorecard!.rubric_potential.candidate_score} · ${c.scorecard!.missing_rubric_signals.length} strong signals missing`,
        duration_ms: 1500,
        artifact: {
          type: 'StaticFunnelScorecard',
          summary: `score ${c.scorecard!.rubric_potential.candidate_score} / ${c.scorecard!.rubric_potential.threshold_for_dynamic_analysis} · 1 weak match · key signals missing`,
          details: [
            n('weak_signals_found', c.scorecard!.candidate_iocs.length),
            n('strong_signals_missing', c.scorecard!.missing_rubric_signals.length),
            ...c.scorecard!.missing_rubric_signals.slice(0, 2).map(m => n(`missing:${m.ioc_id}`, m.reason)),
          ],
        },
      },
      {
        id: 'gate',
        persona: 'gatekeeper',
        label: 'Applying gate policy',
        sub: 'score below auto-close threshold AND no force-rule triggered',
        duration_ms: 1500,
        flavor: 'gate_decision',
        artifact: {
          type: 'GateDecision',
          summary: 'CLOSE EARLY · STATIC INSUFFICIENT',
          details: [
            n('candidate_score', c.gate_decision!.candidate_score),
            n('threshold', c.gate_decision!.policy_applied.dynamic_analysis_threshold),
            n('auto_close_below', c.gate_decision!.policy_applied.auto_close_below_score),
            n('force_rules', 'none'),
            n('next_step', c.gate_decision!.next_step),
          ],
        },
      },
      {
        id: 'closure',
        persona: 'reporter',
        label: 'Drafting static closure report',
        sub: '"insufficient static rubric potential" — not "benign"',
        duration_ms: 1300,
        flavor: 'verdict',
        artifact: {
          type: 'StaticClosureReport',
          summary: 'closed: insufficient static rubric potential',
          details: [
            n('final_status', c.closure_report!.final_status),
            n('checked_iocs', c.closure_report!.checked_iocs.length),
            n('found_weak_signals', c.closure_report!.found_weak_signals.length),
            n('missing_strong_signals', c.closure_report!.missing_strong_signals.length),
          ],
        },
      },
    ],
  };
}

export const SCENARIOS: Scenario[] = [buildRiskwareScenario(), buildClosureScenario()];

export const PERSONA_META: Record<SimPersonaId, { monogram: string; name: string; color: 'green' | 'blue' | 'amber' | 'violet' }> = {
  queue: { monogram: 'QL', name: 'Queue Lock', color: 'green' },
  triager: { monogram: 'TR', name: 'The Triager', color: 'blue' },
  gatekeeper: { monogram: 'GK', name: 'The Gatekeeper', color: 'amber' },
  planner: { monogram: 'MP', name: 'The Mission Planner', color: 'violet' },
  investigator: { monogram: 'IN', name: 'The Investigator', color: 'green' },
  reporter: { monogram: 'RP', name: 'The Reporter', color: 'green' },
};
