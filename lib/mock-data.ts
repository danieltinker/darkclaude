import { BridgeEvent, DynamicEvidencePackage, QueueCase, ReviewMissionPackage, SubmissionReport } from './types';
import { RISKWARE_RUBRIC } from './rubrics';
import { reconcileScores, sumIocPoints, verdictFromScore } from './scoring';

// =====================================================================
// GOLDEN CASE 001 — Riskware: C2 URL → WebView.loadUrl
// =====================================================================

const GRC_001_MISSION: ReviewMissionPackage = {
  schema_version: '1.0.0',
  event_type: 'ReviewMissionPackage',
  message_id: 'msg_grc001_mission_01',
  created_at: '2026-05-26T20:00:00Z',
  source_agent: 'ProducerStaticTriageAgent',
  target_agent: 'ConsumerDynamicEvidenceAgent',
  case_identity: {
    app_review_id: 'review_2026_000143',
    queue_item_id: 'qitem_001',
    package_name: 'com.adsync.dailyoffers',
    app_name: 'Daily Offers Hub',
    version_name: '4.2.1',
    version_code: 421,
    category_id: 'riskware',
    category_name: 'Riskware',
  },
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
    top_ioc_candidates: [
      {
        ioc_id: 'rw_remote_controlled_webview',
        level: 'medium',
        confidence: 0.84,
        reason:
          'C2Client.fetchOffer() return value flows directly into HiddenWebViewController.load(url).',
      },
      {
        ioc_id: 'rw_c2_endpoint',
        level: 'medium',
        confidence: 0.81,
        reason:
          'Decrypted endpoint https://api.adsync-cdn.net/o/v3 controls offer payload selection.',
      },
      {
        ioc_id: 'rw_hidden_webview',
        level: 'weak',
        confidence: 0.62,
        reason:
          'WebView created with visibility GONE and attached to overlay container after 4s delay.',
      },
    ],
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
      {
        url: 'https://api.adsync-cdn.net/o/v3',
        severity: 'high',
        reason: 'Decrypted at runtime, controls WebView destination',
      },
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
    {
      artifact_id: 'art_grc001_apk',
      artifact_type: 'apk',
      path: 'artifacts/apks/review_2026_000143/app.apk',
      sha256: 'sha256:a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
    },
    {
      artifact_id: 'art_grc001_static_report',
      artifact_type: 'static_report',
      path: 'artifacts/static/review_2026_000143/static_report.json',
      sha256: 'sha256:b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3',
    },
  ],
  checksum: 'sha256:c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4',
};

const GRC_001_EVIDENCE: DynamicEvidencePackage = {
  schema_version: '1.0.0',
  event_type: 'DynamicEvidencePackage',
  message_id: 'msg_grc001_evidence_01',
  created_at: '2026-05-26T20:45:00Z',
  source_agent: 'ConsumerDynamicEvidenceAgent',
  target_agent: 'ProducerStaticTriageAgent',
  case_identity: GRC_001_MISSION.case_identity,
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
      result:
        'C2 response contained offer_url=https://promo.luckydeals.br/offer/9921. WebView.loadUrl received the same URL.',
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
      artifact: {
        artifact_id: 'art_c2_har',
        artifact_type: 'network_capture',
        path: 'artifacts/dynamic/review_2026_000143/network/br_session.har',
        sha256: 'sha256:d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5',
        mime_type: 'application/json',
      },
    },
    {
      evidence_id: 'ev_webview_hook',
      ioc_ids: ['rw_remote_controlled_webview'],
      type: 'hook_log',
      title: 'WebView.loadUrl captured remote URL',
      description: 'Frida hook on WebView.loadUrl captured https://promo.luckydeals.br/offer/9921.',
      severity: 'high',
      confidence: 0.95,
      artifact: {
        artifact_id: 'art_webview_hook',
        artifact_type: 'hook_log',
        path: 'artifacts/dynamic/review_2026_000143/hooks/webview_loadurl_br.json',
        sha256: 'sha256:e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6',
        mime_type: 'application/json',
      },
    },
    {
      evidence_id: 'ev_screenshot',
      ioc_ids: ['rw_hidden_webview'],
      type: 'screenshot',
      title: 'Hidden WebView rendering external offer site',
      description: 'Overlay capture shows offer page rendered while app UI shows benign splash screen.',
      severity: 'high',
      confidence: 0.88,
      artifact: {
        artifact_id: 'art_screenshot',
        artifact_type: 'screenshot',
        path: 'artifacts/dynamic/review_2026_000143/screenshots/webview_payload.png',
        sha256: 'sha256:f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7',
        mime_type: 'image/png',
      },
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
// =====================================================================

const GRC_002_MISSION: ReviewMissionPackage = {
  schema_version: '1.0.0',
  event_type: 'ReviewMissionPackage',
  message_id: 'msg_grc002_mission_01',
  created_at: '2026-05-26T18:00:00Z',
  source_agent: 'ProducerStaticTriageAgent',
  target_agent: 'ConsumerDynamicEvidenceAgent',
  case_identity: {
    app_review_id: 'review_2026_000167',
    queue_item_id: 'qitem_002',
    package_name: 'com.brightwave.flashlight',
    app_name: 'BrightWave Flashlight Pro',
    version_name: '2.8.0',
    version_code: 280,
    category_id: 'riskware',
    category_name: 'Riskware',
  },
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
    top_ioc_candidates: [
      {
        ioc_id: 'rw_remote_config_flag',
        level: 'medium',
        confidence: 0.79,
        reason: 'RemoteConfig.getBoolean("show_offer") branches into OfferwallController.start().',
      },
      {
        ioc_id: 'rw_c2_endpoint',
        level: 'medium',
        confidence: 0.74,
        reason: 'Remote config endpoint https://cfg.brightwave-cdn.io/v1/flags governs runtime behavior.',
      },
    ],
    execution_hypothesis: {
      summary:
        'A remote config flag toggles an offerwall flow that is hidden behind the flashlight UI.',
      suspected_flow: [
        'App launch',
        'RemoteConfigClient.fetch()',
        'show_offer flag read',
        'OfferwallController.start() when flag true',
      ],
      function_call_trace: [
        { order: 1, class: 'com.brightwave.MainActivity', method: 'onResume', reason: 'Entry' },
        { order: 2, class: 'com.brightwave.config.RemoteConfigClient', method: 'fetch', reason: 'Pulls feature flags' },
        { order: 3, class: 'com.brightwave.offer.OfferwallController', method: 'start', reason: 'Flag-gated payload' },
      ],
    },
    suspicious_urls: [
      { url: 'https://cfg.brightwave-cdn.io/v1/flags', severity: 'medium', reason: 'Remote feature-flag endpoint' },
    ],
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
      static_basis: [
        'show_offer flag drives OfferwallController.start',
        'Remote config endpoint is the sole source of the flag',
      ],
      validation_steps: [
        'Baseline US run',
        'ID VPN run',
        'Hook RemoteConfigClient.fetch',
        'Compare runtime behavior across countries',
      ],
      strong_evidence_definition: [
        'Different flag values returned across countries',
        'Hidden behavior triggers only when flag=true',
      ],
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
// Compose queue cases at different pipeline stages
// =====================================================================

function buildReportFor(mission: ReviewMissionPackage, evidence: DynamicEvidencePackage): SubmissionReport {
  const reconciled = reconcileScores(
    RISKWARE_RUBRIC,
    mission.static_triage.top_ioc_candidates,
    evidence.ioc_scores,
  );
  const final_score = reconciled.reduce((acc, r) => acc + r.final_points, 0);
  const static_score = sumIocPoints(mission.static_triage.top_ioc_candidates);
  const dynamic_score = sumIocPoints(evidence.ioc_scores);
  return {
    report_id: `report_${mission.case_identity.app_review_id}`,
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
}

const GRC_001_REPORT = buildReportFor(GRC_001_MISSION, GRC_001_EVIDENCE);

export const QUEUE_CASES: QueueCase[] = [
  // Case 1: Full loop complete — golden case 001
  {
    case_identity: GRC_001_MISSION.case_identity,
    producer_status: 'REPORT_DRAFTED',
    consumer_status: 'PACKAGE_SENT',
    priority: 'high',
    static_score: GRC_001_REPORT.static_score,
    dynamic_score: GRC_001_REPORT.dynamic_score,
    final_score: GRC_001_REPORT.final_score,
    metadata: GRC_001_MISSION.producer_metadata,
    rubric: RISKWARE_RUBRIC,
    static_triage: GRC_001_MISSION.static_triage,
    mission_package: GRC_001_MISSION,
    evidence_package: GRC_001_EVIDENCE,
    report: GRC_001_REPORT,
  },
  // Case 2: Mission sent, Consumer running — golden case 002
  {
    case_identity: GRC_002_MISSION.case_identity,
    producer_status: 'CONSUMER_RUNNING',
    consumer_status: 'DYNAMIC_RUNNING',
    priority: 'medium',
    static_score: sumIocPoints(GRC_002_MISSION.static_triage.top_ioc_candidates),
    dynamic_score: 0,
    final_score: 0,
    metadata: GRC_002_MISSION.producer_metadata,
    rubric: RISKWARE_RUBRIC,
    static_triage: GRC_002_MISSION.static_triage,
    mission_package: GRC_002_MISSION,
  },
  // Case 3: Static triage only — mission not yet built
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
    producer_status: 'STATIC_TRIAGED',
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
    static_triage: {
      candidate_score: 12,
      top_ioc_candidates: [
        {
          ioc_id: 'rw_c2_endpoint',
          level: 'medium',
          confidence: 0.78,
          reason: 'Encrypted endpoint resolves at runtime; controls reward payout destination.',
        },
        {
          ioc_id: 'rw_remote_controlled_webview',
          level: 'medium',
          confidence: 0.72,
          reason: 'RewardsController.openWindow consumes server URL field.',
        },
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
    mission_package: GRC_002_MISSION, // placeholder, not yet sent
  },
  // Case 4: New queue arrival
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
    producer_status: 'QUEUE_IMPORTED',
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
    static_triage: {
      candidate_score: 0,
      top_ioc_candidates: [],
      execution_hypothesis: { summary: '', suspected_flow: [], function_call_trace: [] },
      suspicious_urls: [],
      suspicious_native_files: [],
      suggested_hooks: [],
    },
    mission_package: GRC_002_MISSION,
  },
];

// =====================================================================
// PixelBridge append-only event log
// =====================================================================

function caseKey(c: QueueCase): string {
  return `${c.case_identity.app_review_id}/${c.case_identity.package_name}/v${c.case_identity.version_code}/${c.case_identity.category_id}`;
}

export const BRIDGE_EVENTS: BridgeEvent[] = [
  {
    event_id: 'evt_001',
    message_id: GRC_001_MISSION.message_id,
    event_type: 'ReviewMissionPackage',
    case_key: caseKey(QUEUE_CASES[0]),
    source: 'producer',
    target: 'consumer',
    status: 'processed',
    created_at: GRC_001_MISSION.created_at,
    checksum: GRC_001_MISSION.checksum,
    size_bytes: 14_823,
  },
  {
    event_id: 'evt_002',
    message_id: 'msg_grc001_ack_01',
    event_type: 'MissionAck',
    case_key: caseKey(QUEUE_CASES[0]),
    source: 'consumer',
    target: 'producer',
    status: 'processed',
    created_at: '2026-05-26T20:02:00Z',
    checksum: 'sha256:11111111111111111111111111111111aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    size_bytes: 412,
  },
  {
    event_id: 'evt_003',
    message_id: 'msg_grc001_progress_01',
    event_type: 'ConsumerProgressUpdate',
    case_key: caseKey(QUEUE_CASES[0]),
    source: 'consumer',
    target: 'producer',
    status: 'processed',
    created_at: '2026-05-26T20:18:00Z',
    checksum: 'sha256:22222222222222222222222222222222bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    size_bytes: 980,
  },
  {
    event_id: 'evt_004',
    message_id: GRC_001_EVIDENCE.message_id,
    event_type: 'DynamicEvidencePackage',
    case_key: caseKey(QUEUE_CASES[0]),
    source: 'consumer',
    target: 'producer',
    status: 'processed',
    created_at: GRC_001_EVIDENCE.created_at,
    checksum: GRC_001_EVIDENCE.checksum,
    size_bytes: 28_104,
  },
  {
    event_id: 'evt_005',
    message_id: GRC_002_MISSION.message_id,
    event_type: 'ReviewMissionPackage',
    case_key: caseKey(QUEUE_CASES[1]),
    source: 'producer',
    target: 'consumer',
    status: 'processed',
    created_at: GRC_002_MISSION.created_at,
    checksum: GRC_002_MISSION.checksum,
    size_bytes: 11_220,
  },
  {
    event_id: 'evt_006',
    message_id: 'msg_grc002_ack_01',
    event_type: 'MissionAck',
    case_key: caseKey(QUEUE_CASES[1]),
    source: 'consumer',
    target: 'producer',
    status: 'processed',
    created_at: '2026-05-26T18:01:30Z',
    checksum: 'sha256:33333333333333333333333333333333cccccccccccccccccccccccccccccccc',
    size_bytes: 412,
  },
  {
    event_id: 'evt_007',
    message_id: 'msg_grc002_progress_01',
    event_type: 'ConsumerProgressUpdate',
    case_key: caseKey(QUEUE_CASES[1]),
    source: 'consumer',
    target: 'producer',
    status: 'transferred',
    created_at: '2026-05-27T09:14:00Z',
    checksum: 'sha256:44444444444444444444444444444444dddddddddddddddddddddddddddddddd',
    size_bytes: 1_104,
  },
];

export function getCaseByReviewId(id: string): QueueCase | undefined {
  return QUEUE_CASES.find(c => c.case_identity.app_review_id === id);
}

export function getCaseKey(c: QueueCase): string {
  return caseKey(c);
}
