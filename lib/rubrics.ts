import { GatePolicy, IocRubric, MetadataGatePolicy } from './types';

// Metadata-gate policy — the FIRST filter. Runs on data we already have
// (publisher, account age, prior flags, target markets, monetization
// signals). Apps that score below threshold close here with no install
// or decompile cost.
export const RISKWARE_METADATA_GATE_POLICY: MetadataGatePolicy = {
  category_id: 'riskware',
  signal_score_threshold: 2,   // ≥ 2 → proceed to static funnel
  auto_close_below_score: 2,   // < 2 → close at metadata gate
  force_static_if: [
    'developer_prior_flags_present',
    'known_bad_developer',
    'known_bad_package_pattern',
    'high_country_risk_with_monetization',
  ],
};

// Decision-gate policy for the riskware category.
// The gate is deterministic — Static Funnel proposes, gate disposes.
export const RISKWARE_GATE_POLICY: GatePolicy = {
  category_id: 'riskware',
  dynamic_analysis_threshold: 8, // candidate_score >= 8 → dynamic
  auto_close_below_score: 4,     // candidate_score < 4 → close early
  human_review_band: { min: 4, max: 7 }, // gray band → human static-gate review
  force_dynamic_if: [
    'suspicious_native_file_high',
    'known_bad_domain',
    'developer_prior_flags',
    'remote_controlled_webview_candidate',
  ],
};

export const RISKWARE_RUBRIC: IocRubric = {
  rubric_id: 'rubric_riskware_v1',
  rubric_version: '1.0.0',
  rubric_hash: 'sha256:8f3c2a1b9d4e7f6a5c3b2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a',
  category_id: 'riskware',
  category_name: 'Riskware',
  iocs: [
    {
      ioc_id: 'rw_remote_controlled_webview',
      name: 'Remote-controlled WebView destination',
      levels: {
        weak: {
          points: 2,
          definition: 'Static WebView usage and suspicious remote URL strings exist.',
        },
        medium: {
          points: 4,
          definition: 'Static flow suggests remote server response controls WebView destination.',
        },
        strong: {
          points: 8,
          definition: 'Runtime evidence confirms server/C2 response is loaded into WebView.',
        },
      },
    },
    {
      ioc_id: 'rw_c2_endpoint',
      name: 'Suspicious C2 / remote config endpoint',
      levels: {
        weak: {
          points: 2,
          definition: 'Suspicious endpoint, domain, or URL exists in strings/config.',
        },
        medium: {
          points: 4,
          definition: 'Code path shows endpoint controls behavior, UI, redirects, or payload selection.',
        },
        strong: {
          points: 8,
          definition: 'Runtime capture confirms app contacts endpoint and uses response to alter behavior.',
        },
      },
    },
    {
      ioc_id: 'rw_hidden_webview',
      name: 'Hidden or misleading WebView behavior',
      levels: {
        weak: {
          points: 2,
          definition: 'WebView exists but is not clearly visible in normal UI.',
        },
        medium: {
          points: 4,
          definition: 'Code suggests hidden WebView, delayed load, condition gate, or misleading UX.',
        },
        strong: {
          points: 8,
          definition: 'Screenshot / runtime trace confirms hidden or misleading WebView content.',
        },
      },
    },
    {
      ioc_id: 'rw_remote_config_flag',
      name: 'Remote config flag enables hidden behavior',
      levels: {
        weak: { points: 2, definition: 'Remote config request observed with feature-flag-like keys.' },
        medium: { points: 4, definition: 'Code branches on remote flag and changes runtime behavior.' },
        strong: { points: 8, definition: 'Runtime confirms flagged behavior differs from baseline (e.g., hidden offer/redirect).' },
      },
    },
    // ---- Strong riskware families from the architect brief ----
    {
      ioc_id: 'rw_decrypt_asset_dexload',
      name: 'Decrypts asset file and executes via DexClassLoader',
      levels: {
        weak: { points: 2, definition: 'DexClassLoader / PathClassLoader present alongside encrypted assets.' },
        medium: { points: 4, definition: 'Static flow shows AssetLoader output decoded then fed to DexClassLoader.' },
        strong: { points: 8, definition: 'Runtime captures the decrypted DEX file AND ClassLoader.loadClass call.' },
      },
    },
    {
      ioc_id: 'rw_http_url_in_webview',
      name: 'Cleartext HTTP URL loaded in WebView',
      levels: {
        weak: { points: 2, definition: 'Cleartext http:// strings appear near WebView usage.' },
        medium: { points: 4, definition: 'Code path shows http:// URL feeding WebView.loadUrl().' },
        strong: { points: 8, definition: 'Runtime hook captures WebView.loadUrl("http://…") with cleartext over the wire.' },
      },
    },
    {
      ioc_id: 'rw_firebase_remote_url',
      name: 'Firebase Remote Config URL loaded',
      levels: {
        weak: { points: 2, definition: 'Firebase Remote Config / Firestore strings present.' },
        medium: { points: 4, definition: 'Code retrieves a URL string from Firebase and routes it to a WebView.' },
        strong: { points: 8, definition: 'Runtime captures Firebase payload + WebView destination set from that payload.' },
      },
    },
    {
      ioc_id: 'rw_attribution_conversion_payload',
      name: 'Attribution-conversion callback supplies destination URL',
      levels: {
        weak: { points: 2, definition: 'AppsFlyer / Adjust SDK present alongside WebView.' },
        medium: { points: 4, definition: 'onConversionDataSuccess return value feeds WebView.loadUrl.' },
        strong: { points: 8, definition: 'Runtime captures attribution payload and WebView destination set from it.' },
      },
    },
    {
      ioc_id: 'rw_mmp_conversion_cloak',
      name: 'MMP cloaking — affiliate URL cloaked via onConversionDataSuccess',
      levels: {
        weak: { points: 2, definition: 'MMP onConversionDataSuccess callback present near WebView usage.' },
        medium: { points: 4, definition: 'Static chain: callback → URL builder → WebView sink, but destination only resolvable at runtime.' },
        strong: { points: 8, definition: 'Runtime proves the full chain: callback fires → URL built from a network response → cloaked WebView.loadUrl renders the affiliate page.' },
      },
    },
  ],
};

// =====================================================================
// SPYWARE — minimal second rubric so we can demo multi-rubric cases.
// =====================================================================
export const SPYWARE_RUBRIC: IocRubric = {
  rubric_id: 'rubric_spyware_v1',
  rubric_version: '1.0.0',
  rubric_hash: 'sha256:9e5b3c8f2a1d4e6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b',
  category_id: 'spyware',
  category_name: 'Spyware',
  iocs: [
    {
      ioc_id: 'sp_sms_premium_trap',
      name: 'Premium-SMS subscription trap',
      levels: {
        weak: { points: 2, definition: 'SmsManager / sendTextMessage references present near reward / conversion code.' },
        medium: { points: 4, definition: 'Code path sends SMS to short-code based on remote/local config.' },
        strong: { points: 8, definition: 'Runtime captures SMS_SEND intent with body + short-code recipient.' },
      },
    },
    {
      ioc_id: 'sp_contacts_exfil',
      name: 'Contacts exfiltration',
      levels: {
        weak: { points: 2, definition: 'READ_CONTACTS permission requested without a clear feature need.' },
        medium: { points: 4, definition: 'ContactsContract reads feed an outbound HTTP request.' },
        strong: { points: 8, definition: 'Runtime captures network upload containing contact records.' },
      },
    },
  ],
};

export const SPYWARE_GATE_POLICY: GatePolicy = {
  category_id: 'spyware',
  dynamic_analysis_threshold: 8,
  auto_close_below_score: 4,
  human_review_band: { min: 4, max: 7 },
  force_dynamic_if: ['sms_intent_present_near_billing', 'contacts_read_with_network_egress'],
};
