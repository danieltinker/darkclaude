import {
  BridgeEvent,
  DeepInspectionReport,
  DynamicEvidencePackage,
  GateDecision,
  InstallVerification,
  QueueCase,
  QueueLock,
  ReviewMissionPackage,
  StaticClosureReport,
  StaticFunnelScorecard,
  StaticSliceSummary,
  SubmissionReport,
} from './types';
import { RISKWARE_GATE_POLICY, RISKWARE_RUBRIC } from './rubrics';
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
        { order: 2, class: 'com.adsync.net.C2Client', method: 'fetchOffer', reason: 'Issues remote config request' },
        { order: 3, class: 'com.adsync.net.OfferParser', method: 'extractUrl', reason: 'Parses C2 response' },
        { order: 4, class: 'com.adsync.ui.HiddenWebViewController', method: 'load', reason: 'Suspected payload sink' },
      ],
    },
    suspicious_urls: [
      { url: 'https://api.adsync-cdn.net/o/v3', severity: 'high', reason: 'Decrypted at runtime, controls WebView destination' },
    ],
    suspicious_native_files: [],
    suggested_hooks: [
      { target: 'android.webkit.WebView.loadUrl', goal: 'Capture WebView destinations at runtime' },
      { target: 'com.adsync.net.C2Client.fetchOffer', goal: 'Capture C2 response body' },
      { target: 'com.adsync.net.OfferParser.extractUrl', goal: 'Capture parsed destination URL' },
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
    install_verification: scorecard.install_verification,
    static_slice_summary: scorecard.static_slice,
    scorecard,
    gate_decision: gate,
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

const GRC_001_REPORT = buildDeepReport(GRC_001_SCORECARD, GRC_001_GATE, GRC_001_MISSION, GRC_001_EVIDENCE, GRC_001_LOCK);

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

export const QUEUE_CASES: QueueCase[] = [
  // Case 1 (FULL LOOP): GRC-001 — funnel → gate → dynamic → deep report
  {
    case_identity: GRC_001_IDENTITY,
    producer_status: 'DEEP_REPORT_READY',
    consumer_status: 'EVIDENCE_PACKAGE_SENT',
    priority: 'high',
    static_score: GRC_001_REPORT.static_score,
    dynamic_score: GRC_001_REPORT.dynamic_score,
    final_score: GRC_001_REPORT.final_score,
    metadata: GRC_001_MISSION.producer_metadata,
    rubric: RISKWARE_RUBRIC,
    queue_lock: GRC_001_LOCK,
    install_verification: GRC_001_INSTALL,
    static_slice_summary: GRC_001_SLICE,
    scorecard: GRC_001_SCORECARD,
    gate_decision: GRC_001_GATE,
    static_triage: GRC_001_MISSION.static_triage,
    mission_package: GRC_001_MISSION,
    evidence_package: GRC_001_EVIDENCE,
    report: GRC_001_REPORT,
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
    install_verification: GRC_002_SCORECARD.install_verification,
    static_slice_summary: GRC_002_SCORECARD.static_slice,
    scorecard: GRC_002_SCORECARD,
    gate_decision: GRC_002_GATE,
    static_triage: GRC_002_MISSION.static_triage,
    mission_package: GRC_002_MISSION,
  },
  // Case 3 (CLOSED EARLY): Lumen Notepad — funnel → gate → closure report
  {
    case_identity: CLOSURE_IDENTITY,
    producer_status: 'STATIC_INSUFFICIENT_CLOSED',
    consumer_status: null,
    priority: 'low',
    static_score: 2,
    dynamic_score: 0,
    final_score: 2,
    metadata: {
      developer_country: 'CA',
      developer_reputation: 'medium',
      developer_account_age_days: 920,
      related_packages: ['com.lumenlabs.todo'],
      prior_flags: [],
      target_markets: [],
      monetization_signals: [],
    },
    rubric: RISKWARE_RUBRIC,
    queue_lock: makeLock(CLOSURE_IDENTITY.app_review_id, CLOSURE_IDENTITY.queue_item_id),
    install_verification: CLOSURE_SCORECARD.install_verification,
    static_slice_summary: CLOSURE_SCORECARD.static_slice,
    scorecard: CLOSURE_SCORECARD,
    gate_decision: CLOSURE_GATE,
    closure_report: CLOSURE_REPORT,
    static_triage: EMPTY_STATIC_TRIAGE,
  },
  // Case 4 (STATIC SLICE COMPLETE): CoinMint Spin & Win — scorecard ready, awaiting gate
  {
    case_identity: {
      app_review_id: 'review_2026_000201',
      queue_item_id: 'qitem_003',
      package_name: 'com.coinmint.spinwin',
      app_name: 'CoinMint Spin & Win',
      version_name: '1.4.7',
      version_code: 147,
      category_id: 'riskware',
      category_name: 'Riskware',
    },
    producer_status: 'STATIC_SCORECARD_READY',
    consumer_status: null,
    priority: 'critical',
    static_score: 12,
    dynamic_score: 0,
    final_score: 0,
    metadata: {
      developer_country: 'CN',
      developer_reputation: 'low',
      developer_account_age_days: 14,
      related_packages: ['com.coinmint.cashreward'],
      prior_flags: ['Sibling app removed for deceptive monetization'],
      target_markets: ['BR', 'MX', 'AR'],
      monetization_signals: ['rewards SDK', 'offerwall integration'],
    },
    rubric: RISKWARE_RUBRIC,
    queue_lock: makeLock('review_2026_000201', 'qitem_003'),
    install_verification: makeInstallVerification(true),
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
    scorecard: undefined, // illustrate a case where scorecard is generated but gate not yet applied
    static_triage: {
      candidate_score: 12,
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
  },
  // Case 5 (QUEUE LOCKED, FUNNEL RUNNING): Zenith Live Wallpaper
  {
    case_identity: {
      app_review_id: 'review_2026_000219',
      queue_item_id: 'qitem_004',
      package_name: 'com.zenith.wallpaper',
      app_name: 'Zenith Live Wallpaper',
      version_name: '3.1.0',
      version_code: 310,
      category_id: 'riskware',
      category_name: 'Riskware',
    },
    producer_status: 'STATIC_SLICE_RUNNING',
    consumer_status: null,
    priority: 'low',
    static_score: 0,
    dynamic_score: 0,
    final_score: 0,
    metadata: {
      developer_country: 'Unknown',
      developer_reputation: 'unknown',
      developer_account_age_days: 3,
      related_packages: [],
      prior_flags: [],
      target_markets: [],
      monetization_signals: [],
    },
    rubric: RISKWARE_RUBRIC,
    queue_lock: makeLock('review_2026_000219', 'qitem_004'),
    install_verification: makeInstallVerification(true),
    static_triage: EMPTY_STATIC_TRIAGE,
  },
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
