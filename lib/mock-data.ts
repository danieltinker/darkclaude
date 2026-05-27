import {
  BridgeEvent,
  DeepInspectionReport,
  DynamicEvidencePackage,
  ExploratoryFinding,
  GateDecision,
  InstallVerification,
  MetadataClosureReport,
  MetadataGateDecision,
  MetadataScorecard,
  MetadataSignals,
  ProducerMetadata,
  QueueCase,
  QueueLock,
  ReviewMissionPackage,
  StaticClosureReport,
  StaticFunnelScorecard,
  StaticSliceSummary,
  SubmissionReport,
} from './types';
import { RISKWARE_GATE_POLICY, RISKWARE_METADATA_GATE_POLICY, RISKWARE_RUBRIC, SPYWARE_RUBRIC } from './rubrics';
import { reconcileScores, sumIocPoints, verdictFromScore } from './scoring';

// =====================================================================
// Helpers
// =====================================================================

function caseKey(c: Pick<QueueCase, 'case_identity'>): string {
  const id = c.case_identity;
  return `${id.app_review_id}/${id.package_name}/v${id.version_code}/${id.category_id}`;
}

function makeLock(app_review_id: string, queue_item_id: string, worker = 'static_funnel_worker_01'): QueueLock {
  return {
    lock_id: `lock_${app_review_id}`,
    queue_item_id,
    app_review_id,
    locked_by: worker,
    locked_at: '2026-05-27T08:00:00Z',
    lock_expires_at: '2026-05-27T08:30:00Z',
    status: 'QUEUE_LOCKED',
  };
}

// =====================================================================
// Metadata scoring — same math the Scout would apply
// =====================================================================

function inferCountryRisk(country: string): 'low' | 'medium' | 'high' {
  const high = ['VG', 'KY', 'BZ', 'PA'];   // common shell-company jurisdictions
  const medium = ['CN', 'RU', 'TR'];        // mixed signal countries (in this mock)
  if (high.includes(country)) return 'high';
  if (medium.includes(country)) return 'medium';
  if (country === 'Unknown') return 'medium';
  return 'low';
}

function buildSignals(meta: ProducerMetadata): MetadataSignals {
  return {
    developer_reputation: meta.developer_reputation,
    developer_country_risk: inferCountryRisk(meta.developer_country),
    account_age_days: meta.developer_account_age_days,
    related_packages_count: meta.related_packages.length,
    prior_flags_count: meta.prior_flags.length,
    target_markets_count: meta.target_markets.length,
    monetization_signals_count: meta.monetization_signals.length,
  };
}

function scoreMetadata(s: MetadataSignals): { score: number; reasoning: string[] } {
  const reasoning: string[] = [];
  let score = 0;

  // developer_reputation
  const repPoints = { high: 0, medium: 1, low: 3, unknown: 2 }[s.developer_reputation];
  if (repPoints) reasoning.push(`developer_reputation=${s.developer_reputation} → +${repPoints}`);
  score += repPoints;

  // country
  const countryPoints = { low: 0, medium: 2, high: 3 }[s.developer_country_risk];
  if (countryPoints) reasoning.push(`country_risk=${s.developer_country_risk} → +${countryPoints}`);
  score += countryPoints;

  // account age
  let agePoints = 0;
  if (s.account_age_days < 90) agePoints = 3;
  else if (s.account_age_days < 365) agePoints = 1;
  if (agePoints) reasoning.push(`account_age=${s.account_age_days}d → +${agePoints}`);
  score += agePoints;

  // related packages
  let relPoints = 0;
  if (s.related_packages_count >= 3) relPoints = 2;
  else if (s.related_packages_count >= 1) relPoints = 1;
  if (relPoints) reasoning.push(`related_packages=${s.related_packages_count} → +${relPoints}`);
  score += relPoints;

  // prior flags
  let flagPoints = 0;
  if (s.prior_flags_count >= 2) flagPoints = 5;
  else if (s.prior_flags_count === 1) flagPoints = 2;
  if (flagPoints) reasoning.push(`prior_flags=${s.prior_flags_count} → +${flagPoints}`);
  score += flagPoints;

  // target markets
  let marketPoints = 0;
  if (s.target_markets_count >= 3) marketPoints = 2;
  else if (s.target_markets_count >= 1) marketPoints = 1;
  if (marketPoints) reasoning.push(`target_markets=${s.target_markets_count} → +${marketPoints}`);
  score += marketPoints;

  // monetization
  let monPoints = 0;
  if (s.monetization_signals_count >= 3) monPoints = 2;
  else if (s.monetization_signals_count >= 1) monPoints = 1;
  if (monPoints) reasoning.push(`monetization=${s.monetization_signals_count} → +${monPoints}`);
  score += monPoints;

  if (score === 0) reasoning.push('all signals clean — no points');
  return { score, reasoning };
}

function makeMetadataScorecard(
  case_identity: QueueCase['case_identity'],
  meta: ProducerMetadata,
  caseSeed: string,
): MetadataScorecard {
  const signals = buildSignals(meta);
  const { score, reasoning } = scoreMetadata(signals);
  return {
    schema_version: '1.0.0',
    event_type: 'MetadataScorecard',
    message_id: `msg_${caseSeed}_metadata_01`,
    created_at: '2026-05-27T07:55:00Z',
    source_agent: 'MetadataScoutWorker',
    case_identity,
    signals,
    signal_score: score,
    threshold_for_static_analysis: RISKWARE_METADATA_GATE_POLICY.signal_score_threshold,
    requires_static_analysis: score >= RISKWARE_METADATA_GATE_POLICY.signal_score_threshold,
    reasoning,
    checksum: `sha256:meta_${caseSeed}_${score}aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`,
  };
}

function makeMetadataGateDecision(
  case_identity: QueueCase['case_identity'],
  sc: MetadataScorecard,
  meta: ProducerMetadata,
): MetadataGateDecision {
  const triggered: string[] = [];
  if (meta.prior_flags.length > 0) triggered.push('developer_prior_flags');
  const proceed = sc.requires_static_analysis || triggered.length > 0;
  return {
    case_identity,
    policy_applied: RISKWARE_METADATA_GATE_POLICY,
    signal_score: sc.signal_score,
    triggered_force_rules: triggered,
    status: proceed ? 'PROCEED_TO_STATIC_FUNNEL' : 'CLOSE_EARLY_METADATA_INSUFFICIENT',
    next_step: proceed ? 'PROCEED_TO_STATIC_FUNNEL' : 'GENERATE_METADATA_CLOSURE_REPORT',
    explanation: proceed
      ? `signal_score (${sc.signal_score}) ≥ threshold (${RISKWARE_METADATA_GATE_POLICY.signal_score_threshold})${triggered.length ? ` AND force-rules fired: ${triggered.join(', ')}` : ''}.`
      : `signal_score (${sc.signal_score}) < threshold (${RISKWARE_METADATA_GATE_POLICY.signal_score_threshold}) and no force-rule. Close at metadata gate — not worth installing.`,
    decided_at: '2026-05-27T07:56:00Z',
  };
}

function makeSliceVerification(success = true): import('./types').SliceVerification {
  if (!success) {
    return {
      status: 'failed',
      decompiler: 'jadx',
      classes_decompiled: 0,
      classes_failed: 0,
      manifest_parsed: false,
      resources_parsed: false,
      obfuscation_detected: false,
      errors: ['jadx exited with non-zero status'],
      artifact_refs: [],
    };
  }
  return {
    status: 'success',
    decompiler: 'jadx',
    classes_decompiled: 1284,
    classes_failed: 0,
    manifest_parsed: true,
    resources_parsed: true,
    obfuscation_detected: true,
    obfuscation_notes: 'class names obfuscated; behavioral patterns intact',
    errors: [],
    artifact_refs: ['artifacts/static/slice/jadx_output.log'],
  };
}

function makeAnalytics(case_key: string, runs: Array<{ task: string; agent: string; ms: number; tokensIn: number; tokensOut: number; status?: 'completed' | 'partial' | 'failed' }>): import('./types').WorkerAnalytics[] {
  const baseTime = new Date('2026-05-27T08:00:00Z').getTime();
  let cursor = 0;
  return runs.map((r, i) => {
    const started = new Date(baseTime + cursor).toISOString();
    cursor += r.ms;
    const completed = new Date(baseTime + cursor).toISOString();
    cursor += 500; // gap between tasks
    return {
      task_id: `${case_key}_task_${String(i + 1).padStart(2, '0')}`,
      task_type: r.task,
      agent_id: r.agent,
      case_key,
      status: r.status ?? 'completed',
      started_at: started,
      completed_at: completed,
      duration_ms: r.ms,
      tokens_in: r.tokensIn,
      tokens_out: r.tokensOut,
      total_cost_usd: Math.round(((r.tokensIn + r.tokensOut) * 0.000003) * 1000) / 1000,
    };
  });
}

function makeInstallVerification(success = true): InstallVerification {
  if (!success) {
    return {
      status: 'failed',
      install_method: 'adb_install',
      package_detected: false,
      version_code_matches: false,
      launchable_activity_found: false,
      first_launch_success: false,
      error_code: 'INSTALL_FAILED_VERSION_MISMATCH',
      recoverable: true,
      recommended_action: 'retry_with_clean_device_state',
      notes: 'Install failed — version code on device does not match expected.',
      artifact_refs: [],
    };
  }
  return {
    status: 'success',
    install_method: 'adb_install',
    package_detected: true,
    version_code_matches: true,
    launchable_activity_found: true,
    first_launch_success: true,
    notes: 'APK installed and launched successfully in controlled static lab.',
    artifact_refs: ['artifacts/static/install/install_log.txt'],
  };
}

// =====================================================================
// GOLDEN CASE 001 — Riskware: C2 URL → WebView.loadUrl
// FUNNEL: install ok → static slice → scorecard 10 → gate → dynamic
// =====================================================================

const GRC_001_IDENTITY = {
  app_review_id: 'review_2026_000143',
  queue_item_id: 'qitem_001',
  package_name: 'com.adsync.dailyoffers',
  app_name: 'Daily Offers Hub',
  version_name: '4.2.1',
  version_code: 421,
  category_id: 'riskware',
  category_name: 'Riskware',
};

const GRC_001_LOCK = makeLock(GRC_001_IDENTITY.app_review_id, GRC_001_IDENTITY.queue_item_id);
const GRC_001_INSTALL = makeInstallVerification(true);

const GRC_001_SLICE: StaticSliceSummary = {
  status: 'completed',
  decompile_status: 'success',
  manifest_parsed: true,
  native_files_detected: false,
  network_strings_detected: true,
  webview_usage_detected: true,
  candidate_flows: [
    {
      flow_id: 'flow_c2_to_webview_001',
      summary: 'Remote endpoint response appears to influence WebView.loadUrl destination.',
      source: 'C2Client.fetchOffer',
      transform: 'OfferParser.extractUrl',
      sink: 'WebView.loadUrl',
      confidence: 0.84,
    },
  ],
};

const GRC_001_SCORECARD: StaticFunnelScorecard = {
  schema_version: '1.0.0',
  event_type: 'StaticFunnelScorecard',
  message_id: 'msg_grc001_scorecard_01',
  created_at: '2026-05-27T08:05:00Z',
  source_agent: 'StaticFunnelWorker',
  case_identity: GRC_001_IDENTITY,
  install_verification: GRC_001_INSTALL,
  static_slice: GRC_001_SLICE,
  rubric_potential: {
    candidate_score: 10,
    threshold_for_dynamic_analysis: 8,
    requires_dynamic_analysis: true,
    reason:
      'Riskware rubric signal: remote endpoint + WebView sink + response-controlled URL flow. Strongly enough to justify deep dynamic analysis.',
  },
  candidate_iocs: [
    {
      ioc_id: 'rw_remote_controlled_webview',
      level: 'medium',
      confidence: 0.78,
      reason: 'Static flow suggests remote response can influence WebView.loadUrl.',
      evidence_refs: ['artifacts/static/review_2026_000143/slices/webview_flow.json'],
    },
    {
      ioc_id: 'rw_c2_endpoint',
      level: 'medium',
      confidence: 0.81,
      reason: 'Suspicious endpoint api.adsync-cdn.net/o/v3 controls offer payload selection.',
      evidence_refs: ['artifacts/static/review_2026_000143/slices/network_endpoints.json'],
    },
    {
      ioc_id: 'rw_hidden_webview',
      level: 'weak',
      confidence: 0.58,
      reason: 'WebView visibility forced to GONE and attached after 4s delay.',
      evidence_refs: ['artifacts/static/review_2026_000143/slices/ui_webview_refs.json'],
    },
  ],
  missing_rubric_signals: [
    {
      ioc_id: 'rw_remote_config_flag',
      ioc_name: 'Remote config flag enables hidden behavior',
      reason: 'No remote-config feature-flag pattern detected in this app.',
    },
  ],
  checksum: 'sha256:5c0recardgrc001aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
};

const GRC_001_GATE: GateDecision = {
  case_identity: GRC_001_IDENTITY,
  policy_applied: RISKWARE_GATE_POLICY,
  candidate_score: 10,
  triggered_force_rules: ['remote_controlled_webview_candidate'],
  status: 'DYNAMIC_ANALYSIS_REQUIRED',
  next_step: 'BUILD_DYNAMIC_MISSION_PACKAGE',
  explanation:
    'Candidate score (10) exceeds dynamic_analysis_threshold (8) AND remote_controlled_webview_candidate force rule is true. Route to dynamic evidence collection.',
  decided_at: '2026-05-27T08:06:00Z',
};

const GRC_001_MISSION: ReviewMissionPackage = {
  schema_version: '1.0.0',
  event_type: 'ReviewMissionPackage',
  message_id: 'msg_grc001_mission_01',
  created_at: '2026-05-27T08:10:00Z',
  source_agent: 'ProducerStaticTriageAgent',
  target_agent: 'ConsumerDynamicEvidenceAgent',
  case_identity: GRC_001_IDENTITY,
  rubric_reference: {
    rubric_id: RISKWARE_RUBRIC.rubric_id,
    rubric_version: RISKWARE_RUBRIC.rubric_version,
    rubric_hash: RISKWARE_RUBRIC.rubric_hash,
  },
  producer_metadata: {
    developer_country: 'Unknown',
    developer_reputation: 'low',
    developer_account_age_days: 47,
    related_packages: ['com.adsync.luckyspin', 'com.adsync.coinrewards'],
    prior_flags: ['Similar package previously linked to hidden WebView monetization'],
    target_markets: ['BR', 'ZA', 'ID'],
    monetization_signals: ['offerwall sdk strings', 'aggressive ad interval config'],
  },
  static_triage: {
    candidate_score: 10,
    top_ioc_candidates: GRC_001_SCORECARD.candidate_iocs,
    execution_hypothesis: {
      summary:
        'On launch the app calls a C2 endpoint that returns a destination URL; the app loads that URL into a hidden WebView.',
      suspected_flow: [
        'App launch (MainActivity.onCreate)',
        'C2Client.fetchOffer() → POST /o/v3',
        'Response JSON parsed for offer_url',
        'HiddenWebViewController.load(offer_url)',
        'Hidden WebView renders external content',
      ],
      function_call_trace: [
        { order: 1, class: 'com.adsync.MainActivity', method: 'onCreate', reason: 'Entry point' },
        { order: 2, class: 'com.adsync.net.C2Client', method: 'fetchOffer', reason: 'Issues remote config request', evidence_refs: ['ev_c2_capture'], related_ioc_ids: ['rw_c2_endpoint'] },
        { order: 3, class: 'com.adsync.net.OfferParser', method: 'extractUrl', reason: 'Parses C2 response', related_ioc_ids: ['rw_c2_endpoint', 'rw_remote_controlled_webview'] },
        { order: 4, class: 'com.adsync.ui.HiddenWebViewController', method: 'load', reason: 'Suspected payload sink', evidence_refs: ['ev_webview_hook', 'ev_screenshot'], related_ioc_ids: ['rw_remote_controlled_webview', 'rw_hidden_webview'] },
      ],
    },
    suspicious_urls: [
      { url: 'https://api.adsync-cdn.net/o/v3', severity: 'high', reason: 'Decrypted at runtime, controls WebView destination' },
    ],
    suspicious_native_files: [],
    suggested_hooks: [
      { target: 'android.webkit.WebView.loadUrl', goal: 'Capture WebView destinations at runtime', evidence_refs: ['ev_webview_hook'], related_ioc_ids: ['rw_remote_controlled_webview'] },
      { target: 'com.adsync.net.C2Client.fetchOffer', goal: 'Capture C2 response body', evidence_refs: ['ev_c2_capture'], related_ioc_ids: ['rw_c2_endpoint'] },
      { target: 'com.adsync.net.OfferParser.extractUrl', goal: 'Capture parsed destination URL', related_ioc_ids: ['rw_c2_endpoint'] },
    ],
  },
  hypotheses: [
    {
      hypothesis_id: 'hyp_grc001_c2_webview',
      title: 'C2 response URL is loaded into a hidden WebView',
      related_iocs: ['rw_remote_controlled_webview', 'rw_c2_endpoint', 'rw_hidden_webview'],
      static_basis: [
        'C2Client.fetchOffer feeds OfferParser.extractUrl',
        'HiddenWebViewController.load is the only WebView sink',
        'WebView visibility forced to GONE before load',
      ],
      validation_steps: [
        'Run baseline US session and capture network traffic',
        'Hook WebView.loadUrl and C2Client.fetchOffer',
        'Run BR VPN session and re-capture',
        'Screenshot any rendered WebView content',
      ],
      strong_evidence_definition: [
        'Network capture shows C2 response containing URL',
        'WebView.loadUrl hook receives that same URL',
        'Screenshot shows external content rendered',
      ],
      stop_condition: 'Stop once WebView.loadUrl hook + C2 response + screenshot are all captured',
    },
  ],
  geo_execution_plan: {
    baseline_country: { country: 'US', role: 'baseline', priority: 1, reason: 'Neutral baseline for behavior comparison' },
    recommended_vpn_countries: [
      { country: 'BR', role: 'suspected_trigger', priority: 1, reason: 'Target market hint from monetization SDK strings' },
      { country: 'ZA', role: 'secondary_suspected_trigger', priority: 2, reason: 'Carrier strings match ZA telcos' },
    ],
  },
  consumer_budget: {
    max_total_minutes: 45,
    max_iterations: 5,
    max_vpn_countries: 3,
    max_hook_revisions: 3,
    early_stop_on_strong_evidence: true,
  },
  artifacts: [
    { artifact_id: 'art_grc001_apk', artifact_type: 'apk', path: 'artifacts/apks/review_2026_000143/app.apk', sha256: 'sha256:a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2' },
  ],
  checksum: 'sha256:c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4',
};

const GRC_001_EVIDENCE: DynamicEvidencePackage = {
  schema_version: '1.0.0',
  event_type: 'DynamicEvidencePackage',
  message_id: 'msg_grc001_evidence_01',
  created_at: '2026-05-27T08:55:00Z',
  source_agent: 'ConsumerDynamicEvidenceAgent',
  target_agent: 'ProducerStaticTriageAgent',
  case_identity: GRC_001_IDENTITY,
  execution_summary: {
    status: 'completed',
    runtime_verdict_candidate: 'riskware',
    dynamic_score: 24,
    confidence: 0.91,
    summary:
      'Runtime testing confirmed C2 endpoint returns an external offer URL which is loaded into a hidden WebView on every launch.',
  },
  budget_usage: {
    actual_total_minutes: 38,
    actual_iterations: 4,
    vpn_countries_tested: ['US', 'BR'],
    stop_reason: 'strong_runtime_evidence_found',
  },
  ioc_scores: [
    {
      ioc_id: 'rw_remote_controlled_webview',
      level: 'strong',
      confidence: 0.94,
      reason: 'WebView.loadUrl hook captured URL that matches C2 response body verbatim.',
      evidence_refs: ['ev_webview_hook', 'ev_c2_capture'],
    },
    {
      ioc_id: 'rw_c2_endpoint',
      level: 'strong',
      confidence: 0.92,
      reason: 'HTTP Toolkit captured POST to api.adsync-cdn.net/o/v3 returning offer_url JSON field.',
      evidence_refs: ['ev_c2_capture'],
    },
    {
      ioc_id: 'rw_hidden_webview',
      level: 'strong',
      confidence: 0.88,
      reason: 'Screenshot from overlay capture shows WebView rendering offer site with no user-visible UI element.',
      evidence_refs: ['ev_screenshot'],
    },
  ],
  experiments: [
    {
      iteration: 1,
      goal: 'Establish baseline behavior',
      country: 'US',
      tools_used: ['logcat', 'http_toolkit'],
      hooks_enabled: [],
      result: 'C2 contacted but returned empty offer set — no WebView load observed.',
      artifacts: ['artifacts/dynamic/review_2026_000143/network/baseline_us.har'],
      next_decision: 'Switch to BR VPN and add hooks',
    },
    {
      iteration: 2,
      goal: 'Trigger geo-gated behavior',
      country: 'BR',
      tools_used: ['logcat', 'http_toolkit', 'frida'],
      hooks_enabled: ['android.webkit.WebView.loadUrl', 'com.adsync.net.C2Client.fetchOffer'],
      result: 'C2 response contained offer_url=https://promo.luckydeals.br/offer/9921. WebView.loadUrl received the same URL.',
      artifacts: [
        'artifacts/dynamic/review_2026_000143/network/br_session.har',
        'artifacts/dynamic/review_2026_000143/hooks/webview_loadurl_br.json',
      ],
      next_decision: 'Capture screenshot of rendered content',
    },
    {
      iteration: 3,
      goal: 'Capture visual evidence',
      country: 'BR',
      tools_used: ['screenshot_capture', 'overlay_recorder'],
      hooks_enabled: ['android.webkit.WebView.loadUrl'],
      result: 'Screenshot captured. WebView rendered third-party offer page outside app UI bounds.',
      artifacts: ['artifacts/dynamic/review_2026_000143/screenshots/webview_payload.png'],
      next_decision: 'Stop — strong evidence threshold reached',
    },
  ],
  evidence_items: [
    {
      evidence_id: 'ev_c2_capture',
      ioc_ids: ['rw_c2_endpoint', 'rw_remote_controlled_webview'],
      type: 'network_capture',
      title: 'C2 POST /o/v3 returns offer_url',
      description: 'HAR shows POST to api.adsync-cdn.net/o/v3 returning JSON with offer_url field used by WebView.',
      severity: 'high',
      confidence: 0.94,
      artifact: { artifact_id: 'art_c2_har', artifact_type: 'network_capture', path: 'artifacts/dynamic/review_2026_000143/network/br_session.har', sha256: 'sha256:d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5', mime_type: 'application/json' },
    },
    {
      evidence_id: 'ev_webview_hook',
      ioc_ids: ['rw_remote_controlled_webview'],
      type: 'hook_log',
      title: 'WebView.loadUrl captured remote URL',
      description: 'Frida hook on WebView.loadUrl captured https://promo.luckydeals.br/offer/9921.',
      severity: 'high',
      confidence: 0.95,
      artifact: { artifact_id: 'art_webview_hook', artifact_type: 'hook_log', path: 'artifacts/dynamic/review_2026_000143/hooks/webview_loadurl_br.json', sha256: 'sha256:e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6', mime_type: 'application/json' },
    },
    {
      evidence_id: 'ev_screenshot',
      ioc_ids: ['rw_hidden_webview'],
      type: 'screenshot',
      title: 'Hidden WebView rendering external offer site',
      description: 'Overlay capture shows offer page rendered while app UI shows benign splash screen.',
      severity: 'high',
      confidence: 0.88,
      artifact: { artifact_id: 'art_screenshot', artifact_type: 'screenshot', path: 'artifacts/dynamic/review_2026_000143/screenshots/webview_payload.png', sha256: 'sha256:f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7', mime_type: 'image/png' },
    },
  ],
  runtime_trace: [
    { step: 1, event: 'App launched on BR VPN session' },
    { step: 2, event: 'C2Client.fetchOffer POST /o/v3', artifact_ref: 'ev_c2_capture' },
    { step: 3, event: 'OfferParser.extractUrl returned promo.luckydeals.br URL' },
    { step: 4, event: 'WebView.loadUrl invoked with returned URL', artifact_ref: 'ev_webview_hook' },
    { step: 5, event: 'WebView rendered offer page in hidden container', artifact_ref: 'ev_screenshot' },
  ],
  limitations: [
    'No subscription / payment flow was triggered during this run.',
    'Behavior may differ on additional carriers beyond Vivo / Claro tested.',
  ],
  recommended_next_action: 'submit_as_riskware',
  checksum: 'sha256:a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8',
};

// =====================================================================
// GOLDEN CASE 002 — Riskware: Remote config flag enables hidden behavior
// FUNNEL: install ok → scorecard 8 → gate → dynamic (in progress)
// =====================================================================

const GRC_002_IDENTITY = {
  app_review_id: 'review_2026_000167',
  queue_item_id: 'qitem_002',
  package_name: 'com.brightwave.flashlight',
  app_name: 'BrightWave Flashlight Pro',
  version_name: '2.8.0',
  version_code: 280,
  category_id: 'riskware',
  category_name: 'Riskware',
};

const GRC_002_SCORECARD: StaticFunnelScorecard = {
  schema_version: '1.0.0',
  event_type: 'StaticFunnelScorecard',
  message_id: 'msg_grc002_scorecard_01',
  created_at: '2026-05-27T07:00:00Z',
  source_agent: 'StaticFunnelWorker',
  case_identity: GRC_002_IDENTITY,
  install_verification: makeInstallVerification(true),
  static_slice: {
    status: 'completed',
    decompile_status: 'success',
    manifest_parsed: true,
    native_files_detected: false,
    network_strings_detected: true,
    webview_usage_detected: false,
    candidate_flows: [
      {
        flow_id: 'flow_config_flag_001',
        summary: 'show_offer remote config flag gates OfferwallController.start().',
        source: 'RemoteConfigClient.fetch',
        sink: 'OfferwallController.start',
        confidence: 0.79,
      },
    ],
  },
  rubric_potential: {
    candidate_score: 8,
    threshold_for_dynamic_analysis: 8,
    requires_dynamic_analysis: true,
    reason: 'Remote config flag + endpoint together reach threshold. Behavior delta must be confirmed dynamically.',
  },
  candidate_iocs: [
    { ioc_id: 'rw_remote_config_flag', level: 'medium', confidence: 0.79, reason: 'show_offer flag branches into OfferwallController.start().' },
    { ioc_id: 'rw_c2_endpoint', level: 'medium', confidence: 0.74, reason: 'Endpoint cfg.brightwave-cdn.io/v1/flags governs runtime behavior.' },
  ],
  missing_rubric_signals: [
    { ioc_id: 'rw_remote_controlled_webview', ioc_name: 'Remote-controlled WebView destination', reason: 'No WebView usage detected.' },
    { ioc_id: 'rw_hidden_webview', ioc_name: 'Hidden or misleading WebView behavior', reason: 'No WebView usage detected.' },
  ],
  checksum: 'sha256:5c0recardgrc002bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
};

const GRC_002_GATE: GateDecision = {
  case_identity: GRC_002_IDENTITY,
  policy_applied: RISKWARE_GATE_POLICY,
  candidate_score: 8,
  triggered_force_rules: [],
  status: 'DYNAMIC_ANALYSIS_REQUIRED',
  next_step: 'BUILD_DYNAMIC_MISSION_PACKAGE',
  explanation: 'Candidate score (8) meets dynamic_analysis_threshold (8). Routing to dynamic.',
  decided_at: '2026-05-27T07:01:00Z',
};

const GRC_002_MISSION: ReviewMissionPackage = {
  schema_version: '1.0.0',
  event_type: 'ReviewMissionPackage',
  message_id: 'msg_grc002_mission_01',
  created_at: '2026-05-27T07:05:00Z',
  source_agent: 'ProducerStaticTriageAgent',
  target_agent: 'ConsumerDynamicEvidenceAgent',
  case_identity: GRC_002_IDENTITY,
  rubric_reference: {
    rubric_id: RISKWARE_RUBRIC.rubric_id,
    rubric_version: RISKWARE_RUBRIC.rubric_version,
    rubric_hash: RISKWARE_RUBRIC.rubric_hash,
  },
  producer_metadata: {
    developer_country: 'VG',
    developer_reputation: 'low',
    developer_account_age_days: 21,
    related_packages: ['com.brightwave.qrtools', 'com.brightwave.compasspro'],
    prior_flags: ['Sibling app flagged for offerwall redirect via feature flag'],
    target_markets: ['ID', 'PH', 'VN'],
    monetization_signals: ['offerwall feature flag keys in remote config'],
  },
  static_triage: {
    candidate_score: 8,
    top_ioc_candidates: GRC_002_SCORECARD.candidate_iocs,
    execution_hypothesis: {
      summary: 'A remote config flag toggles an offerwall flow that is hidden behind the flashlight UI.',
      suspected_flow: ['App launch', 'RemoteConfigClient.fetch()', 'show_offer flag read', 'OfferwallController.start() when flag true'],
      function_call_trace: [
        { order: 1, class: 'com.brightwave.MainActivity', method: 'onResume', reason: 'Entry' },
        { order: 2, class: 'com.brightwave.config.RemoteConfigClient', method: 'fetch', reason: 'Pulls feature flags' },
        { order: 3, class: 'com.brightwave.offer.OfferwallController', method: 'start', reason: 'Flag-gated payload' },
      ],
    },
    suspicious_urls: [{ url: 'https://cfg.brightwave-cdn.io/v1/flags', severity: 'medium', reason: 'Remote feature-flag endpoint' }],
    suspicious_native_files: [],
    suggested_hooks: [
      { target: 'com.brightwave.config.RemoteConfigClient.fetch', goal: 'Capture remote config response' },
      { target: 'com.brightwave.offer.OfferwallController.start', goal: 'Detect when flagged path triggers' },
    ],
  },
  hypotheses: [
    {
      hypothesis_id: 'hyp_grc002_flag',
      title: 'Remote config flag enables hidden offerwall',
      related_iocs: ['rw_remote_config_flag', 'rw_c2_endpoint'],
      static_basis: ['show_offer flag drives OfferwallController.start', 'Remote config endpoint is the sole source of the flag'],
      validation_steps: ['Baseline US run', 'ID VPN run', 'Hook RemoteConfigClient.fetch', 'Compare runtime behavior across countries'],
      strong_evidence_definition: ['Different flag values returned across countries', 'Hidden behavior triggers only when flag=true'],
      stop_condition: 'Stop once behavior delta is confirmed with config capture',
    },
  ],
  geo_execution_plan: {
    baseline_country: { country: 'US', role: 'baseline', priority: 1, reason: 'Neutral baseline' },
    recommended_vpn_countries: [
      { country: 'ID', role: 'suspected_trigger', priority: 1, reason: 'Target market hint from related packages' },
    ],
  },
  consumer_budget: {
    max_total_minutes: 30,
    max_iterations: 4,
    max_vpn_countries: 2,
    max_hook_revisions: 2,
    early_stop_on_strong_evidence: true,
  },
  artifacts: [],
  checksum: 'sha256:b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9',
};

// =====================================================================
// NEW: CLOSED-EARLY CASE — Static funnel insufficient potential
// =====================================================================

const CLOSURE_IDENTITY = {
  app_review_id: 'review_2026_000245',
  queue_item_id: 'qitem_005',
  package_name: 'com.lumenlabs.notepad',
  app_name: 'Lumen Notepad',
  version_name: '5.0.2',
  version_code: 502,
  category_id: 'riskware',
  category_name: 'Riskware',
};

const CLOSURE_SCORECARD: StaticFunnelScorecard = {
  schema_version: '1.0.0',
  event_type: 'StaticFunnelScorecard',
  message_id: 'msg_clo_scorecard_01',
  created_at: '2026-05-27T08:20:00Z',
  source_agent: 'StaticFunnelWorker',
  case_identity: CLOSURE_IDENTITY,
  install_verification: makeInstallVerification(true),
  static_slice: {
    status: 'completed',
    decompile_status: 'success',
    manifest_parsed: true,
    native_files_detected: false,
    network_strings_detected: true,
    webview_usage_detected: true,
    candidate_flows: [
      {
        flow_id: 'flow_basic_webview_001',
        summary: 'WebView is used to render markdown help inside settings.',
        source: 'AssetLoader.loadHelpHtml',
        sink: 'HelpWebView.loadDataWithBaseURL',
        confidence: 0.36,
      },
    ],
  },
  rubric_potential: {
    candidate_score: 2,
    threshold_for_dynamic_analysis: 8,
    requires_dynamic_analysis: false,
    reason:
      'Only weak WebView usage was found. No suspicious endpoint, C2/config behavior, native risk indicators, or response-to-WebView flow were identified.',
  },
  candidate_iocs: [
    {
      ioc_id: 'rw_hidden_webview',
      level: 'weak',
      confidence: 0.36,
      reason: 'WebView loads bundled help content with no remote URL influence.',
    },
  ],
  missing_rubric_signals: [
    { ioc_id: 'rw_c2_endpoint', ioc_name: 'Suspicious C2 / remote config endpoint', reason: 'No remote-control endpoints found; networking limited to crash reporter.' },
    { ioc_id: 'rw_remote_controlled_webview', ioc_name: 'Remote-controlled WebView destination', reason: 'WebView sink loads bundled assets only.' },
    { ioc_id: 'rw_remote_config_flag', ioc_name: 'Remote config flag enables hidden behavior', reason: 'No remote config client present.' },
  ],
  checksum: 'sha256:5c0recardclo01cccccccccccccccccccccccccccccccccccccccccccccccccc',
};

const CLOSURE_GATE: GateDecision = {
  case_identity: CLOSURE_IDENTITY,
  policy_applied: RISKWARE_GATE_POLICY,
  candidate_score: 2,
  triggered_force_rules: [],
  status: 'CLOSE_EARLY_STATIC_INSUFFICIENT',
  next_step: 'GENERATE_STATIC_CLOSURE_REPORT',
  explanation:
    'Candidate score (2) is below auto_close_below_score (4) and no force-dynamic rule triggered. Close with insufficient static potential.',
  decided_at: '2026-05-27T08:21:00Z',
};

const CLOSURE_REPORT: StaticClosureReport = {
  report_id: `closure_${CLOSURE_IDENTITY.app_review_id}`,
  report_type: 'StaticClosureReport',
  case_identity: CLOSURE_IDENTITY,
  install_verification: CLOSURE_SCORECARD.install_verification,
  rubric_potential: CLOSURE_SCORECARD.rubric_potential,
  checked_iocs: RISKWARE_RUBRIC.iocs.map(i => ({
    ioc_id: i.ioc_id,
    ioc_name: i.name,
    outcome: i.ioc_id === 'rw_hidden_webview' ? ('matched' as const) : ('not_matched' as const),
  })),
  found_weak_signals: CLOSURE_SCORECARD.candidate_iocs,
  missing_strong_signals: CLOSURE_SCORECARD.missing_rubric_signals,
  decision_reason: CLOSURE_GATE.explanation,
  limitations: [
    'This closure reflects insufficient static rubric potential, not a guarantee of benign behavior.',
    'Future versions may introduce dynamic behavior worth re-investigating.',
  ],
  final_status: 'Closed early: insufficient static rubric potential for deep dynamic analysis.',
  created_at: '2026-05-27T08:22:00Z',
};

// =====================================================================
// Reconcile + build deep inspection report for GRC-001
// =====================================================================

function buildDeepReport(
  scorecard: StaticFunnelScorecard,
  gate: GateDecision,
  mission: ReviewMissionPackage,
  evidence: DynamicEvidencePackage,
  lock: QueueLock,
  metadataScorecard?: MetadataScorecard,
  metadataGate?: MetadataGateDecision,
): DeepInspectionReport {
  const reconciled = reconcileScores(
    RISKWARE_RUBRIC,
    mission.static_triage.top_ioc_candidates,
    evidence.ioc_scores,
  );
  const final_score = reconciled.reduce((acc, r) => acc + r.final_points, 0);
  const static_score = sumIocPoints(mission.static_triage.top_ioc_candidates);
  const dynamic_score = sumIocPoints(evidence.ioc_scores);
  const base: SubmissionReport = {
    report_id: `deep_report_${mission.case_identity.app_review_id}`,
    case_identity: mission.case_identity,
    verdict_candidate: verdictFromScore(final_score),
    confidence: evidence.execution_summary.confidence,
    static_score,
    dynamic_score,
    final_score,
    reconciled_scores: reconciled,
    metadata: mission.producer_metadata,
    static_summary: mission.static_triage.execution_hypothesis.summary,
    dynamic_summary: evidence.execution_summary.summary,
    execution_flow: evidence.runtime_trace.map(t => t.event),
    limitations: evidence.limitations,
    recommendation:
      verdictFromScore(final_score) === 'malicious'
        ? 'Submit for malicious enforcement.'
        : verdictFromScore(final_score) === 'riskware'
        ? 'Submit as riskware policy violation; escalate if monetization harm confirmed.'
        : 'Hold and request additional dynamic validation.',
    created_at: evidence.created_at,
  };
  return {
    ...base,
    report_type: 'DeepInspectionReport',
    queue_lock: lock,
    metadata_scorecard: metadataScorecard,
    metadata_gate: metadataGate,
    install_verification: scorecard.install_verification,
    slice_verification: makeSliceVerification(true),
    static_slice_summary: scorecard.static_slice,
    scorecard,
    gate_decision: gate,
    evidence_package: evidence,
    function_call_trace: mission.static_triage.execution_hypothesis.function_call_trace,
    rubric: RISKWARE_RUBRIC,
    why_dynamic_was_triggered: gate.explanation,
    human_review_checklist: [
      { item: 'Confirm verdict candidate matches policy', required: true },
      { item: 'Verify evidence artifacts are accessible', required: true },
      { item: 'Confirm no off-policy IOC scoring occurred', required: true },
      { item: 'Review limitations and decide if more dynamic runs are needed', required: false },
      { item: 'Approve recommendation', required: true },
    ],
  };
}

// Compute metadata layer for GRC-001 here so the deep report can carry it.
const GRC_001_METADATA_SCORECARD_EARLY = makeMetadataScorecard(GRC_001_IDENTITY, GRC_001_MISSION.producer_metadata, 'grc001');
const GRC_001_METADATA_GATE_EARLY = makeMetadataGateDecision(GRC_001_IDENTITY, GRC_001_METADATA_SCORECARD_EARLY, GRC_001_MISSION.producer_metadata);
const GRC_001_REPORT = buildDeepReport(
  GRC_001_SCORECARD,
  GRC_001_GATE,
  GRC_001_MISSION,
  GRC_001_EVIDENCE,
  GRC_001_LOCK,
  GRC_001_METADATA_SCORECARD_EARLY,
  GRC_001_METADATA_GATE_EARLY,
);

// =====================================================================
// Compose queue cases at different pipeline stages
// =====================================================================

const EMPTY_STATIC_TRIAGE = {
  candidate_score: 0,
  top_ioc_candidates: [],
  execution_hypothesis: { summary: '', suspected_flow: [], function_call_trace: [] },
  suspicious_urls: [],
  suspicious_native_files: [],
  suggested_hooks: [],
};

// =====================================================================
// METADATA-GATE CLOSURE CASE — closes BEFORE the static funnel
// =====================================================================

const META_CLOSURE_IDENTITY = {
  app_review_id: 'review_2026_000301',
  queue_item_id: 'qitem_006',
  package_name: 'com.cleartools.calendar',
  app_name: 'ClearNote Calendar',
  version_name: '6.4.0',
  version_code: 640,
  category_id: 'riskware',
  category_name: 'Riskware',
};

const META_CLOSURE_META: ProducerMetadata = {
  developer_country: 'DE',
  developer_reputation: 'high',
  developer_account_age_days: 1500,
  related_packages: [],
  prior_flags: [],
  target_markets: [],
  monetization_signals: [],
};

const META_CLOSURE_SCORECARD = makeMetadataScorecard(META_CLOSURE_IDENTITY, META_CLOSURE_META, 'meta_clo');
const META_CLOSURE_GATE = makeMetadataGateDecision(META_CLOSURE_IDENTITY, META_CLOSURE_SCORECARD, META_CLOSURE_META);
const META_CLOSURE_REPORT: MetadataClosureReport = {
  report_id: `meta_closure_${META_CLOSURE_IDENTITY.app_review_id}`,
  report_type: 'MetadataClosureReport',
  case_identity: META_CLOSURE_IDENTITY,
  scorecard: META_CLOSURE_SCORECARD,
  decision_reason: META_CLOSURE_GATE.explanation,
  limitations: [
    'Closure reflects clean metadata only — not a runtime guarantee.',
    'If the developer ships a future version with new signals, the case re-enters the queue.',
  ],
  final_status: 'Closed at metadata gate: high-reputation publisher with no suspicious metadata signals.',
  created_at: '2026-05-27T07:57:00Z',
};

// =====================================================================
// FALSE POSITIVE CASE — static suspected riskware, dynamic disproved
// =====================================================================

const FP_IDENTITY = {
  app_review_id: 'review_2026_000312',
  queue_item_id: 'qitem_007',
  package_name: 'com.mirasound.player',
  app_name: 'Mira Music Player',
  version_name: '2.1.0',
  version_code: 210,
  category_id: 'riskware',
  category_name: 'Riskware',
};

const FP_META: ProducerMetadata = {
  developer_country: 'US',
  developer_reputation: 'medium',
  developer_account_age_days: 380,
  related_packages: ['com.mirasound.radio'],
  prior_flags: [],
  target_markets: ['US', 'GB'],
  monetization_signals: ['music-streaming-sdk'],
};

const FP_METADATA_SCORECARD = makeMetadataScorecard(FP_IDENTITY, FP_META, 'fp');
const FP_METADATA_GATE = makeMetadataGateDecision(FP_IDENTITY, FP_METADATA_SCORECARD, FP_META);

const FP_INSTALL = makeInstallVerification(true);

const FP_SLICE: StaticSliceSummary = {
  status: 'completed',
  decompile_status: 'success',
  manifest_parsed: true,
  native_files_detected: false,
  network_strings_detected: true,
  webview_usage_detected: true,
  candidate_flows: [
    {
      flow_id: 'flow_fp_webview_001',
      summary: 'WebView found alongside network code — flow not conclusively traced statically.',
      source: 'PlayerActivity.onCreate',
      sink: 'TutorialWebView.loadUrl',
      confidence: 0.51,
    },
  ],
};

const FP_SCORECARD: StaticFunnelScorecard = {
  schema_version: '1.0.0',
  event_type: 'StaticFunnelScorecard',
  message_id: 'msg_fp_scorecard_01',
  created_at: '2026-05-27T08:30:00Z',
  source_agent: 'StaticFunnelWorker',
  case_identity: FP_IDENTITY,
  install_verification: FP_INSTALL,
  static_slice: FP_SLICE,
  rubric_potential: {
    candidate_score: 6,
    threshold_for_dynamic_analysis: 8,
    requires_dynamic_analysis: false,
    reason: 'WebView present and network code present, but flow from network to WebView is ambiguous. Force-rule "remote_controlled_webview_candidate" still applies — escalate to confirm.',
  },
  candidate_iocs: [
    { ioc_id: 'rw_remote_controlled_webview', level: 'medium', confidence: 0.51, reason: 'Static flow to WebView unclear — could be bundled tutorials or remote.' },
    { ioc_id: 'rw_c2_endpoint', level: 'weak', confidence: 0.42, reason: 'Network code present — could be telemetry or content fetch.' },
  ],
  missing_rubric_signals: [
    { ioc_id: 'rw_remote_config_flag', ioc_name: 'Remote config flag', reason: 'No remote config pattern detected.' },
  ],
  checksum: 'sha256:5c0recardfpqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq',
};

const FP_GATE: GateDecision = {
  case_identity: FP_IDENTITY,
  policy_applied: RISKWARE_GATE_POLICY,
  candidate_score: 6,
  triggered_force_rules: ['remote_controlled_webview_candidate'],
  status: 'DYNAMIC_ANALYSIS_REQUIRED',
  next_step: 'BUILD_DYNAMIC_MISSION_PACKAGE',
  explanation:
    'Score (6) in gray band, but force-rule "remote_controlled_webview_candidate" fired. Escalate to dynamic to confirm the WebView flow.',
  decided_at: '2026-05-27T08:31:00Z',
};

const FP_MISSION: ReviewMissionPackage = {
  schema_version: '1.0.0',
  event_type: 'ReviewMissionPackage',
  message_id: 'msg_fp_mission_01',
  created_at: '2026-05-27T08:35:00Z',
  source_agent: 'ProducerStaticTriageAgent',
  target_agent: 'ConsumerDynamicEvidenceAgent',
  case_identity: FP_IDENTITY,
  rubric_reference: {
    rubric_id: RISKWARE_RUBRIC.rubric_id,
    rubric_version: RISKWARE_RUBRIC.rubric_version,
    rubric_hash: RISKWARE_RUBRIC.rubric_hash,
  },
  producer_metadata: FP_META,
  static_triage: {
    candidate_score: 6,
    top_ioc_candidates: FP_SCORECARD.candidate_iocs,
    execution_hypothesis: {
      summary: 'WebView usage may or may not load remote URL — needs runtime confirmation.',
      suspected_flow: ['App launch', 'TutorialWebView.loadUrl (target unknown statically)'],
      function_call_trace: [],
    },
    suspicious_urls: [],
    suspicious_native_files: [],
    suggested_hooks: [
      { target: 'android.webkit.WebView.loadUrl', goal: 'Capture WebView destination' },
    ],
  },
  hypotheses: [
    {
      hypothesis_id: 'hyp_fp_webview',
      title: 'WebView may load remote content',
      related_iocs: ['rw_remote_controlled_webview', 'rw_c2_endpoint'],
      static_basis: ['WebView and network code coexist in the app'],
      validation_steps: ['Run app and capture WebView.loadUrl destinations'],
      strong_evidence_definition: ['WebView observed loading a remote URL controlled by server response'],
      stop_condition: 'Stop once flow is confirmed or disproved',
    },
  ],
  geo_execution_plan: {
    baseline_country: { country: 'US', role: 'baseline', priority: 1, reason: 'Target market' },
    recommended_vpn_countries: [],
  },
  consumer_budget: {
    max_total_minutes: 30,
    max_iterations: 4,
    max_vpn_countries: 1,
    max_hook_revisions: 2,
    early_stop_on_strong_evidence: true,
  },
  artifacts: [],
  checksum: 'sha256:fpmission_rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr',
};

const FP_EVIDENCE: DynamicEvidencePackage = {
  schema_version: '1.0.0',
  event_type: 'DynamicEvidencePackage',
  message_id: 'msg_fp_evidence_01',
  created_at: '2026-05-27T08:55:00Z',
  source_agent: 'ConsumerDynamicEvidenceAgent',
  target_agent: 'ProducerStaticTriageAgent',
  case_identity: FP_IDENTITY,
  execution_summary: {
    status: 'completed',
    runtime_verdict_candidate: 'false_positive',
    dynamic_score: 0,
    confidence: 0.86,
    summary:
      'Static suspicion disproved. WebView.loadUrl only ever received bundled asset URLs (file:///android_asset/tutorials/*.html). No remote control observed. Network traffic was legitimate streaming telemetry.',
  },
  budget_usage: {
    actual_total_minutes: 22,
    actual_iterations: 3,
    vpn_countries_tested: ['US'],
    stop_reason: 'static_suspicion_disproved',
  },
  ioc_scores: [],
  experiments: [
    {
      iteration: 1,
      goal: 'Capture WebView destinations',
      country: 'US',
      tools_used: ['frida', 'http_toolkit'],
      hooks_enabled: ['android.webkit.WebView.loadUrl'],
      result: 'WebView.loadUrl received file:///android_asset/tutorials/getting-started.html — bundled content.',
      artifacts: ['artifacts/dynamic/review_2026_000312/hooks/webview_bundled.json'],
      next_decision: 'Verify no remote loading happens after deeper navigation',
    },
    {
      iteration: 2,
      goal: 'Navigate through tutorials and check for late remote URLs',
      country: 'US',
      tools_used: ['logcat', 'http_toolkit'],
      hooks_enabled: ['android.webkit.WebView.loadUrl'],
      result: 'All WebView destinations remained bundled. Network traffic = streaming telemetry only.',
      artifacts: ['artifacts/dynamic/review_2026_000312/network/full_session.har'],
      next_decision: 'Disprove riskware hypothesis — FP outcome',
    },
  ],
  evidence_items: [],
  runtime_trace: [
    { step: 1, event: 'App launched' },
    { step: 2, event: 'WebView only loaded bundled assets across full session' },
    { step: 3, event: 'No remote-controlled flow observed' },
  ],
  limitations: [
    'Only US session was tested — non-target geographies not validated.',
    'Future versions could introduce remote URL loading; re-investigate on update.',
  ],
  recommended_next_action: 'close_as_false_positive',
  checksum: 'sha256:fpevidence_ssssssssssssssssssssssssssssssssssssssssssssssssss',
};

// =====================================================================
// EXPLORATORY-FINDING CASE — dynamic discovered an unanticipated IOC
// =====================================================================

const EXPL_IDENTITY = {
  app_review_id: 'review_2026_000333',
  queue_item_id: 'qitem_008',
  package_name: 'com.snapread.scanner',
  app_name: 'SnapRead OCR Scanner',
  version_name: '3.7.2',
  version_code: 372,
  category_id: 'riskware',
  category_name: 'Riskware',
};

const EXPL_META: ProducerMetadata = {
  developer_country: 'Unknown',
  developer_reputation: 'low',
  developer_account_age_days: 95,
  related_packages: ['com.snapread.translate'],
  prior_flags: [],
  target_markets: ['ID', 'BD', 'NG'],
  monetization_signals: ['rewards-sdk', 'iap'],
};

const EXPL_METADATA_SCORECARD = makeMetadataScorecard(EXPL_IDENTITY, EXPL_META, 'expl');
const EXPL_METADATA_GATE = makeMetadataGateDecision(EXPL_IDENTITY, EXPL_METADATA_SCORECARD, EXPL_META);

const EXPL_INSTALL = makeInstallVerification(true);

const EXPL_SLICE: StaticSliceSummary = {
  status: 'completed',
  decompile_status: 'success',
  manifest_parsed: true,
  native_files_detected: false,
  network_strings_detected: true,
  webview_usage_detected: true,
  candidate_flows: [
    {
      flow_id: 'flow_expl_webview',
      summary: 'WebView used for reward-claim screens.',
      source: 'RewardsApi.fetchReward',
      sink: 'RewardWebView.loadUrl',
      confidence: 0.68,
    },
  ],
};

const EXPL_SCORECARD: StaticFunnelScorecard = {
  schema_version: '1.0.0',
  event_type: 'StaticFunnelScorecard',
  message_id: 'msg_expl_scorecard_01',
  created_at: '2026-05-27T09:00:00Z',
  source_agent: 'StaticFunnelWorker',
  case_identity: EXPL_IDENTITY,
  install_verification: EXPL_INSTALL,
  static_slice: EXPL_SLICE,
  rubric_potential: {
    candidate_score: 9,
    threshold_for_dynamic_analysis: 8,
    requires_dynamic_analysis: true,
    reason: 'WebView + reward server flow + monetization-heavy app. Worth dynamic confirmation.',
  },
  candidate_iocs: [
    { ioc_id: 'rw_remote_controlled_webview', level: 'medium', confidence: 0.68, reason: 'Reward-claim WebView could receive server-controlled URLs.' },
    { ioc_id: 'rw_c2_endpoint', level: 'medium', confidence: 0.71, reason: 'Reward server is the runtime configuration source.' },
  ],
  missing_rubric_signals: [],
  checksum: 'sha256:5c0recardexplttttttttttttttttttttttttttttttttttttttttttttttttttt',
};

const EXPL_GATE: GateDecision = {
  case_identity: EXPL_IDENTITY,
  policy_applied: RISKWARE_GATE_POLICY,
  candidate_score: 9,
  triggered_force_rules: ['remote_controlled_webview_candidate'],
  status: 'DYNAMIC_ANALYSIS_REQUIRED',
  next_step: 'BUILD_DYNAMIC_MISSION_PACKAGE',
  explanation: 'Score 9 ≥ threshold 8 AND force-rule fired. Escalate to dynamic.',
  decided_at: '2026-05-27T09:01:00Z',
};

const EXPL_MISSION: ReviewMissionPackage = {
  ...FP_MISSION,
  message_id: 'msg_expl_mission_01',
  case_identity: EXPL_IDENTITY,
  producer_metadata: EXPL_META,
  static_triage: {
    candidate_score: 9,
    top_ioc_candidates: EXPL_SCORECARD.candidate_iocs,
    execution_hypothesis: {
      summary: 'Reward server controls WebView destination on claim flow.',
      suspected_flow: ['App launch', 'Spin', 'Reward claim', 'WebView opens server URL'],
      function_call_trace: [],
    },
    suspicious_urls: [],
    suspicious_native_files: [],
    suggested_hooks: [
      { target: 'android.webkit.WebView.loadUrl', goal: 'Capture WebView destination' },
      { target: 'com.snapread.api.RewardsApi.fetchReward', goal: 'Capture reward server response' },
    ],
  },
  consumer_budget: { max_total_minutes: 45, max_iterations: 6, max_vpn_countries: 3, max_hook_revisions: 3, early_stop_on_strong_evidence: false },
  checksum: 'sha256:explmission_uuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuu',
};

const EXPL_FINDING: ExploratoryFinding = {
  finding_id: 'finding_expl_001',
  case_identity: EXPL_IDENTITY,
  unanticipated_ioc_id: 'sp_sms_premium_trap',
  unanticipated_ioc_name: 'Premium-SMS subscription trap (spyware rubric)',
  level: 'strong',
  confidence: 0.89,
  description:
    'During exploration of the rewards flow, the Investigator observed a hidden code path triggering SMS subscription consent to a premium short-code. This is a DIFFERENT IOC than the static-predicted "remote-controlled WebView". Captured under the budget breathing room.',
  evidence_artifacts: [
    'artifacts/dynamic/review_2026_000333/hooks/sms_send_intent.json',
    'artifacts/dynamic/review_2026_000333/screenshots/sms_consent_overlay.png',
  ],
  budget_breathing_room_used_minutes: 8,
  why_static_missed_it: 'The SMS subscription path was triggered only after 4 spin-attempts in the reward flow — too deep for static slicing to reach with a fast pass. Static found the WebView but not the SMS branch.',
};

const EXPL_EVIDENCE: DynamicEvidencePackage = {
  schema_version: '1.0.0',
  event_type: 'DynamicEvidencePackage',
  message_id: 'msg_expl_evidence_01',
  created_at: '2026-05-27T09:50:00Z',
  source_agent: 'ConsumerDynamicEvidenceAgent',
  target_agent: 'ProducerStaticTriageAgent',
  case_identity: EXPL_IDENTITY,
  execution_summary: {
    status: 'completed',
    runtime_verdict_candidate: 'exploratory_finding',
    dynamic_score: 8,
    confidence: 0.89,
    summary:
      'Static-predicted WebView flow was inconclusive, but exploratory mode discovered an UNANTICIPATED IOC: SMS premium subscription trap triggered after multiple reward spins. Strong evidence captured within budget breathing room.',
    exploratory_finding: EXPL_FINDING,
  },
  budget_usage: {
    actual_total_minutes: 41,
    actual_iterations: 5,
    vpn_countries_tested: ['US', 'ID'],
    stop_reason: 'exploratory_strong_evidence_found',
  },
  ioc_scores: [
    {
      ioc_id: EXPL_FINDING.unanticipated_ioc_id,
      level: 'strong',
      confidence: 0.89,
      reason: 'SMS_SEND intent captured via Frida hook + screenshot of consent overlay. Premium short-code confirmed.',
      evidence_refs: EXPL_FINDING.evidence_artifacts,
    },
  ],
  experiments: [
    {
      iteration: 1,
      goal: 'Baseline + capture WebView destinations',
      country: 'US',
      tools_used: ['frida', 'http_toolkit'],
      hooks_enabled: ['android.webkit.WebView.loadUrl'],
      result: 'WebView loaded reward server pages — looked benign so far.',
      artifacts: [],
      next_decision: 'Explore deeper reward flow',
    },
    {
      iteration: 2,
      goal: 'Spin and claim multiple rewards to probe behavior',
      country: 'ID',
      tools_used: ['logcat', 'frida'],
      hooks_enabled: ['android.webkit.WebView.loadUrl', 'com.snapread.api.RewardsApi.fetchReward'],
      result: 'After 4 spins, an SMS consent overlay appeared — NEW signal, not in the static hypothesis.',
      artifacts: ['artifacts/dynamic/review_2026_000333/screenshots/sms_consent_overlay.png'],
      next_decision: 'Enter exploratory mode — hook SMS intents',
    },
    {
      iteration: 3,
      goal: 'EXPLORATORY: hook SmsManager and intent senders',
      country: 'ID',
      tools_used: ['frida', 'logcat'],
      hooks_enabled: ['android.telephony.SmsManager.sendTextMessage', 'android.content.Intent.<init>'],
      result: 'SMS_SEND intent captured with body "SUBSCRIBE WIN" to premium short-code 36661. Confirmed billing path.',
      artifacts: ['artifacts/dynamic/review_2026_000333/hooks/sms_send_intent.json'],
      next_decision: 'Strong evidence captured — stop and report exploratory finding',
    },
  ],
  evidence_items: [
    {
      evidence_id: 'ev_expl_sms',
      ioc_ids: [EXPL_FINDING.unanticipated_ioc_id],
      type: 'hook_log',
      title: 'SMS_SEND intent to premium short-code',
      description: 'Captured outbound SMS intent during reward-spin flow.',
      severity: 'high',
      confidence: 0.92,
      artifact: {
        artifact_id: 'art_expl_sms',
        artifact_type: 'hook_log',
        path: 'artifacts/dynamic/review_2026_000333/hooks/sms_send_intent.json',
        sha256: 'sha256:explsmsuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuu',
        mime_type: 'application/json',
      },
    },
    {
      evidence_id: 'ev_expl_screenshot',
      ioc_ids: [EXPL_FINDING.unanticipated_ioc_id],
      type: 'screenshot',
      title: 'SMS consent overlay after reward spin',
      description: 'Screenshot of the hidden subscription consent that appears during the reward flow.',
      severity: 'high',
      confidence: 0.88,
      artifact: {
        artifact_id: 'art_expl_screenshot',
        artifact_type: 'screenshot',
        path: 'artifacts/dynamic/review_2026_000333/screenshots/sms_consent_overlay.png',
        sha256: 'sha256:explsswwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww',
        mime_type: 'image/png',
      },
    },
  ],
  runtime_trace: [
    { step: 1, event: 'Static-predicted WebView flow inconclusive' },
    { step: 2, event: 'Entered exploratory mode after spotting SMS overlay' },
    { step: 3, event: 'Hooked SMS intents and captured outbound premium send', artifact_ref: 'ev_expl_sms' },
    { step: 4, event: 'Screenshot captured consent overlay', artifact_ref: 'ev_expl_screenshot' },
  ],
  limitations: [
    'Static phase did not predict this IOC — rubric should be updated.',
    'Only triggered after 4 spin attempts; static slicing did not reach this branch.',
  ],
  recommended_next_action: 'submit_with_rubric_update_request',
  checksum: 'sha256:explevidence_vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv',
};

const GRC_001_METADATA_SCORECARD = GRC_001_METADATA_SCORECARD_EARLY;
const GRC_001_METADATA_GATE = GRC_001_METADATA_GATE_EARLY;
const GRC_002_METADATA_SCORECARD = makeMetadataScorecard(GRC_002_IDENTITY, GRC_002_MISSION.producer_metadata, 'grc002');
const GRC_002_METADATA_GATE = makeMetadataGateDecision(GRC_002_IDENTITY, GRC_002_METADATA_SCORECARD, GRC_002_MISSION.producer_metadata);
const CLOSURE_METADATA = {
  developer_country: 'CA',
  developer_reputation: 'medium' as const,
  developer_account_age_days: 920,
  related_packages: ['com.lumenlabs.todo'],
  prior_flags: [],
  target_markets: [],
  monetization_signals: [],
};
const CLOSURE_METADATA_SCORECARD = makeMetadataScorecard(CLOSURE_IDENTITY, CLOSURE_METADATA, 'closure');
const CLOSURE_METADATA_GATE = makeMetadataGateDecision(CLOSURE_IDENTITY, CLOSURE_METADATA_SCORECARD, CLOSURE_METADATA);

export const QUEUE_CASES: QueueCase[] = [
  // Case 1 (FULL LOOP): GRC-001 — metadata gate passes → funnel → gate → dynamic → deep report
  {
    case_identity: GRC_001_IDENTITY,
    producer_status: 'DEEP_REPORT_READY',
    consumer_status: 'EVIDENCE_RETURNED',
    priority: 'high',
    static_score: GRC_001_REPORT.static_score,
    dynamic_score: GRC_001_REPORT.dynamic_score,
    final_score: GRC_001_REPORT.final_score,
    metadata: GRC_001_MISSION.producer_metadata,
    rubric: RISKWARE_RUBRIC,
    queue_lock: GRC_001_LOCK,
    metadata_scorecard: GRC_001_METADATA_SCORECARD,
    metadata_gate: GRC_001_METADATA_GATE,
    install_verification: GRC_001_INSTALL,
    slice_verification: makeSliceVerification(true),
    static_slice_summary: GRC_001_SLICE,
    scorecard: GRC_001_SCORECARD,
    gate_decision: GRC_001_GATE,
    static_triage: GRC_001_MISSION.static_triage,
    mission_package: GRC_001_MISSION,
    evidence_package: GRC_001_EVIDENCE,
    report: GRC_001_REPORT,
    extracted_payloads: [
      {
        payload_id: 'payload_grc001_dropper_01',
        case_identity: GRC_001_IDENTITY,
        artifact_type: 'dex',
        source_path_on_device: '/data/data/com.adsync.dailyoffers/files/.cache/d_2c.bin',
        bridge_artifact_path: 'artifacts/dynamic/review_2026_000143/payloads/d_2c_decrypted.dex',
        sha256: 'sha256:dexdroppergrc001payload0000aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        size_bytes: 84_320,
        description: 'Decrypted DEX file pulled from app private storage after first WebView trigger. Static decryption stub matches the runtime payload.',
        extracted_during_experiment_id: 3,
        related_ioc_ids: ['rw_remote_controlled_webview', 'rw_hidden_webview'],
      },
    ],
    worker_analytics: makeAnalytics(`${GRC_001_IDENTITY.app_review_id}/${GRC_001_IDENTITY.package_name}`, [
      { task: 'producer.metadata_score',           agent: 'MetadataScoutWorker',         ms: 1840,  tokensIn: 820,  tokensOut: 280 },
      { task: 'producer.install_verify',           agent: 'StaticFunnelWorker',          ms: 6400,  tokensIn: 360,  tokensOut: 110 },
      { task: 'producer.slice_verify',             agent: 'StaticFunnelWorker',          ms: 12_300, tokensIn: 540,  tokensOut: 220 },
      { task: 'producer.static_slice',             agent: 'StaticFunnelWorker',          ms: 18_700, tokensIn: 2_950, tokensOut: 1_200 },
      { task: 'producer.generate_static_scorecard',agent: 'StaticFunnelWorker',          ms: 9_400,  tokensIn: 3_800, tokensOut: 1_840 },
      { task: 'producer.decide_static_gate',       agent: 'StaticGateDecisionWorker',    ms: 480,    tokensIn: 920,  tokensOut: 140 },
      { task: 'producer.build_dynamic_mission',    agent: 'ProducerStaticTriageAgent',   ms: 11_600, tokensIn: 4_280, tokensOut: 2_400 },
      { task: 'consumer.collect_dynamic_evidence', agent: 'ConsumerDynamicEvidenceAgent',ms: 38 * 60 * 1000, tokensIn: 12_400, tokensOut: 5_960 },
      { task: 'mission_control.deep_report',       agent: 'MissionControlReportWorker',  ms: 14_800, tokensIn: 5_400, tokensOut: 3_120 },
    ]),
  },
  // Case 2 (DYNAMIC IN PROGRESS): GRC-002 — funnel → gate → dynamic running
  {
    case_identity: GRC_002_IDENTITY,
    producer_status: 'CONSUMER_RUNNING',
    consumer_status: 'DYNAMIC_RUNNING',
    priority: 'medium',
    static_score: sumIocPoints(GRC_002_MISSION.static_triage.top_ioc_candidates),
    dynamic_score: 0,
    final_score: 0,
    metadata: GRC_002_MISSION.producer_metadata,
    rubric: RISKWARE_RUBRIC,
    queue_lock: makeLock(GRC_002_IDENTITY.app_review_id, GRC_002_IDENTITY.queue_item_id),
    metadata_scorecard: GRC_002_METADATA_SCORECARD,
    metadata_gate: GRC_002_METADATA_GATE,
    install_verification: GRC_002_SCORECARD.install_verification,
    static_slice_summary: GRC_002_SCORECARD.static_slice,
    scorecard: GRC_002_SCORECARD,
    gate_decision: GRC_002_GATE,
    static_triage: GRC_002_MISSION.static_triage,
    mission_package: GRC_002_MISSION,
  },
  // Case M (METADATA CLOSURE): ClearNote — closes at metadata gate, never installed
  {
    case_identity: META_CLOSURE_IDENTITY,
    producer_status: 'METADATA_INSUFFICIENT_CLOSED',
    consumer_status: null,
    priority: 'low',
    static_score: 0,
    dynamic_score: 0,
    final_score: 0,
    metadata: META_CLOSURE_META,
    rubric: RISKWARE_RUBRIC,
    queue_lock: makeLock(META_CLOSURE_IDENTITY.app_review_id, META_CLOSURE_IDENTITY.queue_item_id),
    metadata_scorecard: META_CLOSURE_SCORECARD,
    metadata_gate: META_CLOSURE_GATE,
    metadata_closure_report: META_CLOSURE_REPORT,
    static_triage: EMPTY_STATIC_TRIAGE,
  },
  // Case FP (FALSE POSITIVE): Mira Music — full chain, dynamic disproves static
  {
    case_identity: FP_IDENTITY,
    producer_status: 'FALSE_POSITIVE_CLOSED',
    consumer_status: 'EVIDENCE_RETURNED',
    priority: 'medium',
    static_score: sumIocPoints(FP_SCORECARD.candidate_iocs),
    dynamic_score: 0,
    final_score: 0,
    metadata: FP_META,
    rubric: RISKWARE_RUBRIC,
    queue_lock: makeLock(FP_IDENTITY.app_review_id, FP_IDENTITY.queue_item_id),
    metadata_scorecard: FP_METADATA_SCORECARD,
    metadata_gate: FP_METADATA_GATE,
    install_verification: FP_INSTALL,
    static_slice_summary: FP_SLICE,
    scorecard: FP_SCORECARD,
    gate_decision: FP_GATE,
    static_triage: FP_MISSION.static_triage,
    mission_package: FP_MISSION,
    evidence_package: FP_EVIDENCE,
  },
  // Case EX (EXPLORATORY FINDING): SnapRead OCR — dynamic discovers unanticipated IOC
  {
    case_identity: EXPL_IDENTITY,
    producer_status: 'EXPLORATORY_FINDING_READY',
    consumer_status: 'EVIDENCE_RETURNED',
    priority: 'high',
    // Static IOCs (rw_remote_controlled_webview medium, rw_c2_endpoint
    // medium = 4+4) + dynamic unanticipated IOC (strong = 8). Distinct
    // ioc_ids, so reconciliation sums to 16 per scoring rules.
    static_score: sumIocPoints(EXPL_SCORECARD.candidate_iocs),
    dynamic_score: 8,
    final_score: sumIocPoints(EXPL_SCORECARD.candidate_iocs) + 8,
    metadata: EXPL_META,
    rubric: RISKWARE_RUBRIC,
    queue_lock: makeLock(EXPL_IDENTITY.app_review_id, EXPL_IDENTITY.queue_item_id),
    metadata_scorecard: EXPL_METADATA_SCORECARD,
    metadata_gate: EXPL_METADATA_GATE,
    install_verification: EXPL_INSTALL,
    static_slice_summary: EXPL_SLICE,
    scorecard: EXPL_SCORECARD,
    gate_decision: EXPL_GATE,
    static_triage: EXPL_MISSION.static_triage,
    mission_package: EXPL_MISSION,
    evidence_package: EXPL_EVIDENCE,
    exploratory_finding: EXPL_FINDING,
    // MULTI-RUBRIC: this case spans BOTH riskware (static-hypothesized
    // remote-controlled WebView) AND spyware (the runtime-discovered
    // SMS premium-subscription trap). Each rubric scores independently.
    rubrics: [
      {
        rubric: RISKWARE_RUBRIC,
        candidate_score: 8,
        candidate_iocs: EXPL_SCORECARD.candidate_iocs,
        missing_signals: [],
        gate_status: 'DYNAMIC_ANALYSIS_REQUIRED',
      },
      {
        rubric: SPYWARE_RUBRIC,
        candidate_score: 0,
        candidate_iocs: [],
        missing_signals: [{ ioc_id: 'sp_sms_premium_trap', ioc_name: 'Premium-SMS subscription trap', reason: 'Static slice did not reach the SMS branch (4 spin-attempts deep).' }],
        // Static did not flag this rubric — but dynamic exploratory mode
        // captured strong evidence for it. The reconciled score lifts it
        // post-hoc.
        gate_status: 'CLOSE_EARLY_STATIC_INSUFFICIENT',
        reconciled: [
          {
            ioc_id: 'sp_sms_premium_trap',
            ioc_name: 'Premium-SMS subscription trap',
            static_level: null,
            dynamic_level: 'strong',
            final_level: 'strong',
            final_points: 8,
            evidence_ids: EXPL_FINDING.evidence_artifacts,
            dynamic_reason: EXPL_FINDING.description,
            dynamic_confidence: EXPL_FINDING.confidence,
            dynamic_scored_by: 'ConsumerDynamicEvidenceAgent',
          },
        ],
      },
    ],
  },
  // Case 3 (STATIC CLOSURE): Lumen Notepad — metadata passes but static fails
  {
    case_identity: CLOSURE_IDENTITY,
    producer_status: 'STATIC_INSUFFICIENT_CLOSED',
    consumer_status: null,
    priority: 'low',
    static_score: 2,
    dynamic_score: 0,
    final_score: 2,
    metadata: CLOSURE_METADATA,
    rubric: RISKWARE_RUBRIC,
    queue_lock: makeLock(CLOSURE_IDENTITY.app_review_id, CLOSURE_IDENTITY.queue_item_id),
    metadata_scorecard: CLOSURE_METADATA_SCORECARD,
    metadata_gate: CLOSURE_METADATA_GATE,
    install_verification: CLOSURE_SCORECARD.install_verification,
    static_slice_summary: CLOSURE_SCORECARD.static_slice,
    scorecard: CLOSURE_SCORECARD,
    gate_decision: CLOSURE_GATE,
    closure_report: CLOSURE_REPORT,
    static_triage: EMPTY_STATIC_TRIAGE,
  },
  // Case 4 (STATIC SLICE COMPLETE): CoinMint Spin & Win — scorecard ready, awaiting gate
  ((): QueueCase => {
    const id = {
      app_review_id: 'review_2026_000201',
      queue_item_id: 'qitem_003',
      package_name: 'com.coinmint.spinwin',
      app_name: 'CoinMint Spin & Win',
      version_name: '1.4.7',
      version_code: 147,
      category_id: 'riskware',
      category_name: 'Riskware',
    };
    const meta: ProducerMetadata = {
      developer_country: 'CN',
      developer_reputation: 'low',
      developer_account_age_days: 14,
      related_packages: ['com.coinmint.cashreward'],
      prior_flags: ['Sibling app removed for deceptive monetization'],
      target_markets: ['BR', 'MX', 'AR'],
      monetization_signals: ['rewards SDK', 'offerwall integration'],
    };
    const sc = makeMetadataScorecard(id, meta, 'coinmint');
    const gate = makeMetadataGateDecision(id, sc, meta);
    return {
    case_identity: id,
    producer_status: 'STATIC_SCORECARD_READY',
    consumer_status: null,
    priority: 'critical',
    static_score: 8,
    dynamic_score: 0,
    final_score: 0,
    metadata: meta,
    rubric: RISKWARE_RUBRIC,
    queue_lock: makeLock('review_2026_000201', 'qitem_003'),
    metadata_scorecard: sc,
    metadata_gate: gate,
    install_verification: makeInstallVerification(true),
    slice_verification: makeSliceVerification(true),
    static_slice_summary: {
      status: 'completed',
      decompile_status: 'success',
      manifest_parsed: true,
      native_files_detected: false,
      network_strings_detected: true,
      webview_usage_detected: true,
      candidate_flows: [
        {
          flow_id: 'flow_rewards_webview_001',
          summary: 'Reward server URL is opened in WebView on payout.',
          source: 'RewardsApi.fetch',
          sink: 'RewardsController.openWindow',
          confidence: 0.78,
        },
      ],
    },
    // Scorecard generated, awaiting gate — demonstrates the moment
    // right after the Triager finishes scoring.
    scorecard: {
      schema_version: '1.0.0',
      event_type: 'StaticFunnelScorecard',
      message_id: 'msg_coinmint_scorecard_01',
      created_at: '2026-05-27T09:30:00Z',
      source_agent: 'StaticFunnelWorker',
      case_identity: id,
      install_verification: makeInstallVerification(true),
      static_slice: {
        status: 'completed',
        decompile_status: 'success',
        manifest_parsed: true,
        native_files_detected: false,
        network_strings_detected: true,
        webview_usage_detected: true,
        candidate_flows: [],
      },
      rubric_potential: {
        candidate_score: 8,
        threshold_for_dynamic_analysis: 8,
        requires_dynamic_analysis: true,
        reason: 'Two medium IOCs — reward-server URL flow + remote-controlled WebView — reach the dynamic threshold exactly.',
      },
      candidate_iocs: [
        { ioc_id: 'rw_c2_endpoint', level: 'medium', confidence: 0.78, reason: 'Encrypted endpoint resolves at runtime; controls reward payout destination.' },
        { ioc_id: 'rw_remote_controlled_webview', level: 'medium', confidence: 0.72, reason: 'RewardsController.openWindow consumes server URL field.' },
      ],
      missing_rubric_signals: [
        { ioc_id: 'rw_hidden_webview', ioc_name: 'Hidden or misleading WebView behavior', reason: 'No hidden-WebView pattern detected in static slice.' },
      ],
      checksum: 'sha256:coinmintscorecardrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr',
    },
    static_triage: {
      candidate_score: 8,
      top_ioc_candidates: [
        { ioc_id: 'rw_c2_endpoint', level: 'medium', confidence: 0.78, reason: 'Encrypted endpoint resolves at runtime; controls reward payout destination.' },
        { ioc_id: 'rw_remote_controlled_webview', level: 'medium', confidence: 0.72, reason: 'RewardsController.openWindow consumes server URL field.' },
      ],
      execution_hypothesis: {
        summary: 'Spin-win game opens server-controlled WebView when reward triggers.',
        suspected_flow: ['App launch', 'Spin trigger', 'Reward API call', 'WebView opened'],
        function_call_trace: [],
      },
      suspicious_urls: [],
      suspicious_native_files: [],
      suggested_hooks: [],
    },
  };
  })(),
  // Case 5 (QUEUE LOCKED, FUNNEL RUNNING): Zenith Live Wallpaper
  ((): QueueCase => {
    const id = {
      app_review_id: 'review_2026_000219',
      queue_item_id: 'qitem_004',
      package_name: 'com.zenith.wallpaper',
      app_name: 'Zenith Live Wallpaper',
      version_name: '3.1.0',
      version_code: 310,
      category_id: 'riskware',
      category_name: 'Riskware',
    };
    const meta: ProducerMetadata = {
      developer_country: 'Unknown',
      developer_reputation: 'unknown',
      developer_account_age_days: 3,
      related_packages: [],
      prior_flags: [],
      target_markets: [],
      monetization_signals: [],
    };
    const sc = makeMetadataScorecard(id, meta, 'zenith');
    const gate = makeMetadataGateDecision(id, sc, meta);
    return {
      case_identity: id,
      producer_status: 'STATIC_SLICE_RUNNING',
      consumer_status: null,
      priority: 'low',
      static_score: 0,
      dynamic_score: 0,
      final_score: 0,
      metadata: meta,
      rubric: RISKWARE_RUBRIC,
      queue_lock: makeLock('review_2026_000219', 'qitem_004'),
      metadata_scorecard: sc,
      metadata_gate: gate,
      install_verification: makeInstallVerification(true),
      static_triage: EMPTY_STATIC_TRIAGE,
    };
  })(),

  // ===================================================================
  // FAMILY: DexClassLoader dropper — decrypts asset, executes via reflection
  // ===================================================================
  ((): QueueCase => {
    const id = {
      app_review_id: 'review_2026_000401',
      queue_item_id: 'qitem_010',
      package_name: 'com.nyxlabs.battery',
      app_name: 'NyxBattery Saver',
      version_name: '2.0.3',
      version_code: 203,
      category_id: 'riskware',
      category_name: 'Riskware',
    };
    const meta: ProducerMetadata = {
      developer_country: 'Unknown',
      developer_reputation: 'low',
      developer_account_age_days: 28,
      related_packages: ['com.nyxlabs.cleaner', 'com.nyxlabs.booster'],
      prior_flags: ['Sibling app removed for dynamic code loading'],
      target_markets: ['ID', 'BD', 'NG'],
      monetization_signals: ['rewards-sdk'],
    };
    const sc = makeMetadataScorecard(id, meta, 'nyx');
    const gate = makeMetadataGateDecision(id, sc, meta);
    return {
      case_identity: id,
      producer_status: 'CONSUMER_RUNNING',
      consumer_status: 'DYNAMIC_RUNNING',
      priority: 'critical',
      static_score: 8,
      dynamic_score: 0,
      final_score: 0,
      metadata: meta,
      rubric: RISKWARE_RUBRIC,
      queue_lock: makeLock(id.app_review_id, id.queue_item_id),
      metadata_scorecard: sc,
      metadata_gate: gate,
      install_verification: makeInstallVerification(true),
      slice_verification: makeSliceVerification(true),
      static_slice_summary: {
        status: 'completed',
        decompile_status: 'success',
        manifest_parsed: true,
        native_files_detected: true,
        network_strings_detected: true,
        webview_usage_detected: false,
        candidate_flows: [
          { flow_id: 'flow_dex_drop_001', summary: 'AssetLoader.openFile → CryptoUtil.decrypt → DexClassLoader(<init>)', source: 'AssetLoader.openFile', transform: 'CryptoUtil.decrypt', sink: 'dalvik.system.DexClassLoader.<init>', confidence: 0.82 },
        ],
      },
      static_triage: {
        candidate_score: 8,
        top_ioc_candidates: [
          { ioc_id: 'rw_decrypt_asset_dexload', level: 'medium', confidence: 0.82, reason: 'Asset decryption stub feeds a DexClassLoader constructor.' },
        ],
        execution_hypothesis: {
          summary: 'App decrypts a packed payload from assets/ at runtime and loads it via DexClassLoader.',
          suspected_flow: ['App launch', 'AssetLoader.openFile("p.bin")', 'CryptoUtil.decrypt(buf)', 'new DexClassLoader(...)'],
          function_call_trace: [
            { order: 1, class: 'com.nyxlabs.MainActivity', method: 'onCreate', reason: 'Entry point' },
            { order: 2, class: 'com.nyxlabs.assets.AssetLoader', method: 'openFile', reason: 'Reads encrypted blob from assets', related_ioc_ids: ['rw_decrypt_asset_dexload'] },
            { order: 3, class: 'com.nyxlabs.crypto.CryptoUtil', method: 'decrypt', reason: 'Decryption stub' },
            { order: 4, class: 'dalvik.system.DexClassLoader', method: '<init>', reason: 'Loads decrypted DEX', related_ioc_ids: ['rw_decrypt_asset_dexload'] },
          ],
        },
        suspicious_urls: [],
        suspicious_native_files: [{ path: 'assets/p.bin', severity: 'high', reason: 'High-entropy blob loaded at runtime.' }],
        suggested_hooks: [
          { target: 'java.io.InputStream.read', goal: 'Capture decrypted bytes from CryptoUtil', related_ioc_ids: ['rw_decrypt_asset_dexload'] },
          { target: 'dalvik.system.DexClassLoader.<init>', goal: 'Capture path of loaded DEX', related_ioc_ids: ['rw_decrypt_asset_dexload'] },
          { target: 'java.lang.ClassLoader.loadClass', goal: 'Capture class names invoked from decrypted DEX', related_ioc_ids: ['rw_decrypt_asset_dexload'] },
        ],
      },
    };
  })(),

  // ===================================================================
  // FAMILY: HTTP-in-WebView — cleartext URL load
  // ===================================================================
  ((): QueueCase => {
    const id = {
      app_review_id: 'review_2026_000412',
      queue_item_id: 'qitem_011',
      package_name: 'com.spinpix.dailyclaim',
      app_name: 'SpinPix Daily Claim',
      version_name: '1.0.4',
      version_code: 104,
      category_id: 'riskware',
      category_name: 'Riskware',
    };
    const meta: ProducerMetadata = {
      developer_country: 'Unknown',
      developer_reputation: 'low',
      developer_account_age_days: 12,
      related_packages: [],
      prior_flags: [],
      target_markets: ['IN', 'PK'],
      monetization_signals: ['cleartext-tracker'],
    };
    const sc = makeMetadataScorecard(id, meta, 'spinpix');
    const gate = makeMetadataGateDecision(id, sc, meta);
    return {
      case_identity: id,
      producer_status: 'STATIC_SCORECARD_READY',
      consumer_status: null,
      priority: 'high',
      static_score: 4,
      dynamic_score: 0,
      final_score: 0,
      metadata: meta,
      rubric: RISKWARE_RUBRIC,
      queue_lock: makeLock(id.app_review_id, id.queue_item_id),
      metadata_scorecard: sc,
      metadata_gate: gate,
      install_verification: makeInstallVerification(true),
      slice_verification: makeSliceVerification(true),
      static_slice_summary: {
        status: 'completed',
        decompile_status: 'success',
        manifest_parsed: true,
        native_files_detected: false,
        network_strings_detected: true,
        webview_usage_detected: true,
        candidate_flows: [
          { flow_id: 'flow_http_wv_001', summary: 'http:// constant directly passed to WebView.loadUrl', source: 'StringConstants.PROMO_URL', sink: 'WebView.loadUrl', confidence: 0.74 },
        ],
      },
      static_triage: {
        candidate_score: 4,
        top_ioc_candidates: [
          { ioc_id: 'rw_http_url_in_webview', level: 'medium', confidence: 0.74, reason: 'Cleartext http:// constant in code feeds WebView.loadUrl().' },
        ],
        execution_hypothesis: { summary: 'WebView loads a cleartext URL — MITM-prone.', suspected_flow: ['Splash', 'WebView.loadUrl(http://promo.spinpix.io/c)'], function_call_trace: [] },
        suspicious_urls: [{ url: 'http://promo.spinpix.io/c', severity: 'high', reason: 'Cleartext load destination.' }],
        suspicious_native_files: [],
        suggested_hooks: [{ target: 'android.webkit.WebView.loadUrl', goal: 'Confirm cleartext scheme used at runtime', related_ioc_ids: ['rw_http_url_in_webview'] }],
      },
    };
  })(),

  // ===================================================================
  // FAMILY: Firebase Remote Config URL
  // ===================================================================
  ((): QueueCase => {
    const id = {
      app_review_id: 'review_2026_000423',
      queue_item_id: 'qitem_012',
      package_name: 'com.embergrow.tunes',
      app_name: 'EmberGrow Tunes',
      version_name: '3.4.0',
      version_code: 340,
      category_id: 'riskware',
      category_name: 'Riskware',
    };
    const meta: ProducerMetadata = {
      developer_country: 'CY',
      developer_reputation: 'low',
      developer_account_age_days: 60,
      related_packages: ['com.embergrow.bass', 'com.embergrow.equalizer'],
      prior_flags: [],
      target_markets: ['BR', 'AR', 'MX'],
      monetization_signals: ['offerwall-sdk', 'tracker-sdk'],
    };
    const sc = makeMetadataScorecard(id, meta, 'ember');
    const gate = makeMetadataGateDecision(id, sc, meta);
    return {
      case_identity: id,
      producer_status: 'CONSUMER_RUNNING',
      consumer_status: 'DYNAMIC_RUNNING',
      priority: 'high',
      static_score: 8,
      dynamic_score: 0,
      final_score: 0,
      metadata: meta,
      rubric: RISKWARE_RUBRIC,
      queue_lock: makeLock(id.app_review_id, id.queue_item_id),
      metadata_scorecard: sc,
      metadata_gate: gate,
      install_verification: makeInstallVerification(true),
      slice_verification: makeSliceVerification(true),
      static_slice_summary: {
        status: 'completed',
        decompile_status: 'success',
        manifest_parsed: true,
        native_files_detected: false,
        network_strings_detected: true,
        webview_usage_detected: true,
        candidate_flows: [
          { flow_id: 'flow_firebase_url_001', summary: 'FirebaseRemoteConfig.getString("promo_url") → WebView.loadUrl', source: 'FirebaseRemoteConfig.getString', sink: 'WebView.loadUrl', confidence: 0.81 },
        ],
      },
      static_triage: {
        candidate_score: 8,
        top_ioc_candidates: [
          { ioc_id: 'rw_firebase_remote_url', level: 'medium', confidence: 0.81, reason: 'Firebase Remote Config string drives WebView destination.' },
          { ioc_id: 'rw_remote_controlled_webview', level: 'medium', confidence: 0.78, reason: 'Server-supplied URL reaches WebView.' },
        ],
        execution_hypothesis: { summary: 'Firebase Remote Config supplies the WebView destination per geo.', suspected_flow: ['App launch', 'FirebaseRemoteConfig.fetch', 'WebView.loadUrl(returned URL)'], function_call_trace: [] },
        suspicious_urls: [],
        suspicious_native_files: [],
        suggested_hooks: [
          { target: 'com.google.firebase.remoteconfig.FirebaseRemoteConfig.getString', goal: 'Capture remote-config payload', related_ioc_ids: ['rw_firebase_remote_url'] },
          { target: 'android.webkit.WebView.loadUrl', goal: 'Capture WebView destination', related_ioc_ids: ['rw_firebase_remote_url', 'rw_remote_controlled_webview'] },
        ],
      },
    };
  })(),

  // ===================================================================
  // FAMILY: AppsFlyer onConversionDataSuccess → WebView
  // ===================================================================
  ((): QueueCase => {
    const id = {
      app_review_id: 'review_2026_000434',
      queue_item_id: 'qitem_013',
      package_name: 'com.cryomedia.scanqr',
      app_name: 'CryoMedia QR Scanner',
      version_name: '5.1.2',
      version_code: 512,
      category_id: 'riskware',
      category_name: 'Riskware',
    };
    const meta: ProducerMetadata = {
      developer_country: 'Unknown',
      developer_reputation: 'low',
      developer_account_age_days: 41,
      related_packages: ['com.cryomedia.filemanager'],
      prior_flags: [],
      target_markets: ['ID', 'PH'],
      monetization_signals: ['appsflyer-sdk'],
    };
    const sc = makeMetadataScorecard(id, meta, 'cryomedia');
    const gate = makeMetadataGateDecision(id, sc, meta);
    return {
      case_identity: id,
      producer_status: 'DYNAMIC_ANALYSIS_REQUIRED',
      consumer_status: 'MISSION_RECEIVED',
      priority: 'medium',
      static_score: 8,
      dynamic_score: 0,
      final_score: 0,
      metadata: meta,
      rubric: RISKWARE_RUBRIC,
      queue_lock: makeLock(id.app_review_id, id.queue_item_id),
      metadata_scorecard: sc,
      metadata_gate: gate,
      install_verification: makeInstallVerification(true),
      slice_verification: makeSliceVerification(true),
      static_slice_summary: {
        status: 'completed',
        decompile_status: 'success',
        manifest_parsed: true,
        native_files_detected: false,
        network_strings_detected: true,
        webview_usage_detected: true,
        candidate_flows: [
          { flow_id: 'flow_attribution_url_001', summary: 'AppsFlyerConversionListener.onConversionDataSuccess(data) → WebView.loadUrl(data["deep_link_value"])', source: 'AppsFlyerConversionListener.onConversionDataSuccess', sink: 'WebView.loadUrl', confidence: 0.80 },
        ],
      },
      static_triage: {
        candidate_score: 8,
        top_ioc_candidates: [
          { ioc_id: 'rw_attribution_conversion_payload', level: 'medium', confidence: 0.80, reason: 'AppsFlyer conversion payload supplies WebView destination.' },
          { ioc_id: 'rw_remote_controlled_webview', level: 'medium', confidence: 0.74, reason: 'Server-supplied URL routed to WebView.loadUrl.' },
        ],
        execution_hypothesis: { summary: 'Attribution SDK returns a destination URL that the app then loads in a WebView.', suspected_flow: ['App launch', 'AppsFlyerLib.start', 'onConversionDataSuccess', 'WebView.loadUrl(data["deep_link_value"])'], function_call_trace: [] },
        suspicious_urls: [],
        suspicious_native_files: [],
        suggested_hooks: [
          { target: 'com.appsflyer.AppsFlyerConversionListener.onConversionDataSuccess', goal: 'Capture attribution payload', related_ioc_ids: ['rw_attribution_conversion_payload'] },
          { target: 'android.webkit.WebView.loadUrl', goal: 'Capture WebView destination', related_ioc_ids: ['rw_attribution_conversion_payload', 'rw_remote_controlled_webview'] },
        ],
      },
    };
  })(),
];

// =====================================================================
// PixelBridge append-only event log — now includes funnel events
// =====================================================================

export const BRIDGE_EVENTS: BridgeEvent[] = [
  // GRC-001 full chain
  { event_id: 'evt_grc001_01', message_id: `lock_${GRC_001_IDENTITY.app_review_id}`, event_type: 'QueueLockClaimed', case_key: caseKey({ case_identity: GRC_001_IDENTITY }), source: 'queue', target: 'static_funnel', status: 'processed', created_at: '2026-05-27T08:00:00Z', checksum: 'sha256:lockgrc001aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', size_bytes: 320 },
  { event_id: 'evt_grc001_02', message_id: 'msg_grc001_install_01', event_type: 'InstallVerification', case_key: caseKey({ case_identity: GRC_001_IDENTITY }), source: 'static_funnel', target: 'mission_control', status: 'processed', created_at: '2026-05-27T08:03:00Z', checksum: 'sha256:installgrc001bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', size_bytes: 780 },
  { event_id: 'evt_grc001_03', message_id: GRC_001_SCORECARD.message_id, event_type: 'StaticFunnelScorecard', case_key: caseKey({ case_identity: GRC_001_IDENTITY }), source: 'static_funnel', target: 'mission_control', status: 'processed', created_at: GRC_001_SCORECARD.created_at, checksum: GRC_001_SCORECARD.checksum, size_bytes: 5_240 },
  { event_id: 'evt_grc001_04', message_id: 'msg_grc001_gate_01', event_type: 'GateDecision', case_key: caseKey({ case_identity: GRC_001_IDENTITY }), source: 'mission_control', target: 'mission_control', status: 'processed', created_at: GRC_001_GATE.decided_at, checksum: 'sha256:gategrc001ddddddddddddddddddddddddddddddddddddddddddddddddddd', size_bytes: 640 },
  { event_id: 'evt_grc001_05', message_id: GRC_001_MISSION.message_id, event_type: 'ReviewMissionPackage', case_key: caseKey({ case_identity: GRC_001_IDENTITY }), source: 'mission_control', target: 'consumer', status: 'processed', created_at: GRC_001_MISSION.created_at, checksum: GRC_001_MISSION.checksum, size_bytes: 14_823 },
  { event_id: 'evt_grc001_06', message_id: 'msg_grc001_ack_01', event_type: 'MissionAck', case_key: caseKey({ case_identity: GRC_001_IDENTITY }), source: 'consumer', target: 'mission_control', status: 'processed', created_at: '2026-05-27T08:12:00Z', checksum: 'sha256:ackgrc001eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', size_bytes: 412 },
  { event_id: 'evt_grc001_07', message_id: 'msg_grc001_progress_01', event_type: 'ConsumerProgressUpdate', case_key: caseKey({ case_identity: GRC_001_IDENTITY }), source: 'consumer', target: 'mission_control', status: 'processed', created_at: '2026-05-27T08:32:00Z', checksum: 'sha256:progrc001fffffffffffffffffffffffffffffffffffffffffffffffffff', size_bytes: 980 },
  { event_id: 'evt_grc001_08', message_id: GRC_001_EVIDENCE.message_id, event_type: 'DynamicEvidencePackage', case_key: caseKey({ case_identity: GRC_001_IDENTITY }), source: 'consumer', target: 'mission_control', status: 'processed', created_at: GRC_001_EVIDENCE.created_at, checksum: GRC_001_EVIDENCE.checksum, size_bytes: 28_104 },
  { event_id: 'evt_grc001_09', message_id: GRC_001_REPORT.report_id, event_type: 'DeepInspectionReportDraft', case_key: caseKey({ case_identity: GRC_001_IDENTITY }), source: 'mission_control', target: 'mission_control', status: 'processed', created_at: '2026-05-27T09:00:00Z', checksum: 'sha256:deepgrc001gggggggggggggggggggggggggggggggggggggggggggggggggg', size_bytes: 41_320 },

  // GRC-002 chain
  { event_id: 'evt_grc002_01', message_id: `lock_${GRC_002_IDENTITY.app_review_id}`, event_type: 'QueueLockClaimed', case_key: caseKey({ case_identity: GRC_002_IDENTITY }), source: 'queue', target: 'static_funnel', status: 'processed', created_at: '2026-05-27T06:55:00Z', checksum: 'sha256:lockgrc002hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh', size_bytes: 320 },
  { event_id: 'evt_grc002_02', message_id: GRC_002_SCORECARD.message_id, event_type: 'StaticFunnelScorecard', case_key: caseKey({ case_identity: GRC_002_IDENTITY }), source: 'static_funnel', target: 'mission_control', status: 'processed', created_at: GRC_002_SCORECARD.created_at, checksum: GRC_002_SCORECARD.checksum, size_bytes: 4_180 },
  { event_id: 'evt_grc002_03', message_id: 'msg_grc002_gate_01', event_type: 'GateDecision', case_key: caseKey({ case_identity: GRC_002_IDENTITY }), source: 'mission_control', target: 'mission_control', status: 'processed', created_at: GRC_002_GATE.decided_at, checksum: 'sha256:gategrc002iiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiii', size_bytes: 580 },
  { event_id: 'evt_grc002_04', message_id: GRC_002_MISSION.message_id, event_type: 'ReviewMissionPackage', case_key: caseKey({ case_identity: GRC_002_IDENTITY }), source: 'mission_control', target: 'consumer', status: 'processed', created_at: GRC_002_MISSION.created_at, checksum: GRC_002_MISSION.checksum, size_bytes: 11_220 },
  { event_id: 'evt_grc002_05', message_id: 'msg_grc002_ack_01', event_type: 'MissionAck', case_key: caseKey({ case_identity: GRC_002_IDENTITY }), source: 'consumer', target: 'mission_control', status: 'processed', created_at: '2026-05-27T07:06:30Z', checksum: 'sha256:ackgrc002jjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjj', size_bytes: 412 },
  { event_id: 'evt_grc002_06', message_id: 'msg_grc002_progress_01', event_type: 'ConsumerProgressUpdate', case_key: caseKey({ case_identity: GRC_002_IDENTITY }), source: 'consumer', target: 'mission_control', status: 'transferred', created_at: '2026-05-27T09:14:00Z', checksum: 'sha256:progrc002kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk', size_bytes: 1_104 },

  // Closure chain
  { event_id: 'evt_clo_01', message_id: `lock_${CLOSURE_IDENTITY.app_review_id}`, event_type: 'QueueLockClaimed', case_key: caseKey({ case_identity: CLOSURE_IDENTITY }), source: 'queue', target: 'static_funnel', status: 'processed', created_at: '2026-05-27T08:15:00Z', checksum: 'sha256:lockclolllllllllllllllllllllllllllllllllllllllllllllllllllllll', size_bytes: 320 },
  { event_id: 'evt_clo_02', message_id: CLOSURE_SCORECARD.message_id, event_type: 'StaticFunnelScorecard', case_key: caseKey({ case_identity: CLOSURE_IDENTITY }), source: 'static_funnel', target: 'mission_control', status: 'processed', created_at: CLOSURE_SCORECARD.created_at, checksum: CLOSURE_SCORECARD.checksum, size_bytes: 3_120 },
  { event_id: 'evt_clo_03', message_id: 'msg_clo_gate_01', event_type: 'GateDecision', case_key: caseKey({ case_identity: CLOSURE_IDENTITY }), source: 'mission_control', target: 'mission_control', status: 'processed', created_at: CLOSURE_GATE.decided_at, checksum: 'sha256:gateclommmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm', size_bytes: 540 },
  { event_id: 'evt_clo_04', message_id: CLOSURE_REPORT.report_id, event_type: 'StaticClosureReport', case_key: caseKey({ case_identity: CLOSURE_IDENTITY }), source: 'mission_control', target: 'mission_control', status: 'processed', created_at: CLOSURE_REPORT.created_at, checksum: 'sha256:closurereportnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn', size_bytes: 6_840 },
];

export function getCaseByReviewId(id: string): QueueCase | undefined {
  return QUEUE_CASES.find(c => c.case_identity.app_review_id === id);
}

export function getCaseKey(c: QueueCase): string {
  return caseKey(c);
}

// Aggregate worker analytics across all cases — feeds the /agents
// analytics tab.
export function allWorkerAnalytics() {
  const rows: NonNullable<QueueCase['worker_analytics']>[number][] = [];
  for (const c of QUEUE_CASES) {
    if (c.worker_analytics) rows.push(...c.worker_analytics);
  }
  return rows;
}

// Synthetic log feed for the case file LogViewer.
export function getCaseLogs(reviewId: string): Array<{
  ts: string;
  channel: 'network' | 'logcat' | 'hook';
  level?: 'info' | 'warn' | 'error';
  text: string;
  insight?: { evidence_id: string; severity: 'low' | 'medium' | 'high'; note: string };
}> {
  if (reviewId !== 'review_2026_000143') return [];
  return [
    { ts: '08:15:01.230', channel: 'logcat',  level: 'info', text: 'ActivityManager: START u0 {com.adsync.dailyoffers/.MainActivity} from uid 2000' },
    { ts: '08:15:01.812', channel: 'logcat',  level: 'info', text: 'MainActivity.onCreate: launching' },
    { ts: '08:15:02.041', channel: 'hook',    level: 'info', text: 'C2Client.fetchOffer() called — preparing POST to /o/v3' },
    { ts: '08:15:02.219', channel: 'network', level: 'info', text: 'POST https://api.adsync-cdn.net/o/v3  status 200  88 ms', insight: { evidence_id: 'ev_c2_capture', severity: 'high', note: 'C2 endpoint returned offer_url field' } },
    { ts: '08:15:02.232', channel: 'hook',    level: 'info', text: 'OfferParser.extractUrl(): https://promo.luckydeals.br/offer/9921' },
    { ts: '08:15:02.318', channel: 'hook',    level: 'warn', text: 'WebView.loadUrl(https://promo.luckydeals.br/offer/9921)', insight: { evidence_id: 'ev_webview_hook', severity: 'high', note: 'WebView destination matches C2 response — remote-controlled flow confirmed' } },
    { ts: '08:15:02.401', channel: 'logcat',  level: 'info', text: 'HiddenWebViewController: attaching view to overlay container, visibility=GONE' },
    { ts: '08:15:02.690', channel: 'network', level: 'info', text: 'GET https://promo.luckydeals.br/offer/9921  status 200  342 ms (text/html)' },
    { ts: '08:15:03.117', channel: 'logcat',  level: 'warn', text: 'WebView: rendered third-party content outside primary UI bounds', insight: { evidence_id: 'ev_screenshot', severity: 'high', note: 'Hidden WebView is rendering the C2 destination — screenshot evidence captured' } },
    { ts: '08:15:04.022', channel: 'hook',    level: 'info', text: 'Frida snapshot: writing screenshots/webview_payload.png' },
    { ts: '08:15:04.100', channel: 'logcat',  level: 'info', text: 'Investigator: stop_reason = strong_runtime_evidence_found' },
  ];
}
