// =====================================================================
// Rubric Flow Library
// =====================================================================
// Each rubric/IOC communicates HOW to reach a TP verdict as a generic
// graph: nodes (path-pinned static signatures) + edges (chain relations).
// This config is reusable across apps — a case fills it with evidence
// (see IocProofInstance in lib/types). Agents read a flow to know the
// exact chain they must prove.

import type { RubricFlowGraph } from './types';

// ---------------------------------------------------------------------
// GOLDEN FLOW: MMP cloaking via onConversionDataSuccess
// ---------------------------------------------------------------------
// An app hides the affiliate URL it intends to load: the destination
// never appears in static strings. Instead the MMP (AppsFlyer-style)
// onConversionDataSuccess callback triggers a chain that fetches the URL
// from a server response and renders it in a coroutine-cloaked WebView.
export const MMP_CONVERSION_CLOAK_FLOW: RubricFlowGraph = {
  flow_id: 'flow_mmp_conversion_cloak_v1',
  category_id: 'riskware',
  ioc_id: 'rw_mmp_conversion_cloak',
  ioc_name: 'MMP cloaking — affiliate URL cloaked via onConversionDataSuccess',
  summary:
    'The true affiliate destination never appears statically. The MMP attribution callback triggers a chain that builds the URL from a network response and renders it in a coroutine-cloaked WebView.',
  entry_node: 'n_callback',
  nodes: [
    {
      node_id: 'n_callback',
      label: 'onConversionDataSuccess(Map)',
      kind: 'trigger',
      what_it_does:
        'MMP attribution callback. Fires once per first-launch with the conversion payload. The single invoke() call here is the crucial trigger of the whole chain.',
      signature: {
        signature_id: 'sig_callback',
        class_name: 'com.cryomedia.scanqr.AttribListener',
        method: 'onConversionDataSuccess(java.util.Map)',
        file_path: 'sources/com/cryomedia/scanqr/AttribListener.java',
        line: 41,
        context_before: [
          '@Override',
          'public void onConversionDataSuccess(Map<String, Object> data) {',
          '    if (data == null) return;',
        ],
        focal_line: '    a.invoke(data);          // <-- single crucial trigger',
        context_after: [
          '}',
          '@Override',
          'public void onConversionDataFail(String s) { }',
        ],
        smali_path: 'smali/com/cryomedia/scanqr/AttribListener.smali',
      },
      verification: {
        methods: ['frida', 'logcat'],
        hook_target: 'com.cryomedia.scanqr.AttribListener.onConversionDataSuccess',
        expectation: 'Hook fires on first launch; data map contains an attribution key the chain reads.',
      },
      required_for_tp: true,
    },
    {
      node_id: 'n_invoke',
      label: 'a.invoke(data)',
      kind: 'transform',
      what_it_does:
        'Orchestrator. Two steps: (1) calls g(data) to build the URL from a network response, (2) hands the built string to MainActivity.o().',
      signature: {
        signature_id: 'sig_invoke',
        class_name: 'com.cryomedia.scanqr.a',
        method: 'invoke(java.util.Map)',
        file_path: 'sources/com/cryomedia/scanqr/a.java',
        line: 27,
        context_before: [
          'public final void invoke(Map<String, Object> data) {',
          '    String token = String.valueOf(data.get("af_sub1"));',
        ],
        focal_line: '    String url = g(token);              // step 1: build url from response',
        context_after: [
          '    if (url != null && url.length() > 0) {',
          '        MainActivity.o(url);            // step 2: hand off to sink',
          '    }',
          '}',
        ],
        smali_path: 'smali/com/cryomedia/scanqr/a.smali',
      },
      verification: {
        methods: ['frida'],
        hook_target: 'com.cryomedia.scanqr.a.invoke',
        expectation: 'invoke() called with the conversion data; returns after calling g() then MainActivity.o().',
      },
      // Orchestrator — the four boundary nodes are the load-bearing proof,
      // so invoke itself isn't required for the TP gate.
      required_for_tp: false,
    },
    {
      node_id: 'n_g',
      label: 'g(token) — fetch + parse URL',
      kind: 'network',
      what_it_does:
        'Makes an HTTPS request to a remote endpoint and parses the affiliate URL out of the JSON response. This is why the destination is invisible to static analysis.',
      signature: {
        signature_id: 'sig_g',
        class_name: 'com.cryomedia.scanqr.a',
        method: 'g(java.lang.String)',
        file_path: 'sources/com/cryomedia/scanqr/a.java',
        line: 58,
        context_before: [
          'private String g(String token) {',
          '    Request req = new Request.Builder()',
          '        .url("https://t.cryo-track.io/v1/c?t=" + token).build();',
          '    Response resp = client.newCall(req).execute();',
        ],
        focal_line: '    String url = new JSONObject(resp.body().string()).optString("dl");  // parse hidden url',
        context_after: [
          '    resp.close();',
          '    return url;',
          '}',
        ],
        smali_path: 'smali/com/cryomedia/scanqr/a.smali',
      },
      verification: {
        methods: ['http_toolkit', 'frida'],
        hook_target: 'com.cryomedia.scanqr.a.g',
        expectation: 'HAR shows GET t.cryo-track.io/v1/c; response JSON "dl" field equals the URL g() returns.',
      },
      required_for_tp: true,
    },
    {
      node_id: 'n_o',
      label: 'MainActivity.o(String)',
      kind: 'transform',
      what_it_does:
        'Receives the built URL and constructs an object extended with a Kotlin coroutine — the indirection that obfuscates the eventual WebView.loadUrl call.',
      signature: {
        signature_id: 'sig_o',
        class_name: 'com.cryomedia.scanqr.MainActivity',
        method: 'o(java.lang.String)',
        file_path: 'sources/com/cryomedia/scanqr/MainActivity.java',
        line: 211,
        context_before: [
          'public static void o(String url) {',
          '    Cloak c = new Cloak(url);   // anonymous subclass w/ coroutine',
        ],
        focal_line: '    BuildersKt.launch(c.scope, null, null, c.block, 2, null);  // coroutine-cloaked dispatch',
        context_after: [
          '}',
        ],
        smali_path: 'smali/com/cryomedia/scanqr/MainActivity.smali',
      },
      verification: {
        methods: ['frida'],
        hook_target: 'com.cryomedia.scanqr.MainActivity.o',
        expectation: 'o() receives the same URL g() returned; launches the coroutine block that performs the load.',
      },
      required_for_tp: true,
    },
    {
      node_id: 'n_load',
      label: 'WebView.loadUrl (coroutine-cloaked)',
      kind: 'sink',
      what_it_does:
        'Inside the coroutine block, WebView.loadUrl is finally called with the affiliate URL — rendering the hidden destination.',
      signature: {
        signature_id: 'sig_load',
        class_name: 'com.cryomedia.scanqr.Cloak$block$1',
        method: 'invokeSuspend(java.lang.Object)',
        file_path: 'sources/com/cryomedia/scanqr/Cloak.java',
        line: 96,
        context_before: [
          'public final Object invokeSuspend(Object $result) {',
          '    WebView w = MainActivity.hiddenWeb;',
        ],
        focal_line: '    w.loadUrl(this.this$0.url);   // <-- real sink, reached only via coroutine',
        context_after: [
          '    return Unit.INSTANCE;',
          '}',
        ],
        smali_path: 'smali/com/cryomedia/scanqr/Cloak$block$1.smali',
      },
      verification: {
        methods: ['frida', 'screenshot'],
        hook_target: 'android.webkit.WebView.loadUrl',
        expectation: 'loadUrl hook captures the affiliate URL; screenshot shows the rendered affiliate page.',
      },
      required_for_tp: true,
    },
  ],
  edges: [
    { from: 'n_callback', to: 'n_invoke', relation: 'calls', label: 'invoke(data) — trigger' },
    { from: 'n_invoke', to: 'n_g', relation: 'calls', label: 'g(token) builds url' },
    { from: 'n_g', to: 'n_invoke', relation: 'returns_to', label: 'returns parsed affiliate url' },
    { from: 'n_invoke', to: 'n_o', relation: 'data_flows_to', label: 'passes built url string' },
    { from: 'n_o', to: 'n_load', relation: 'triggers', label: 'coroutine block → loadUrl' },
  ],
  scoring: {
    tp_requires: ['n_callback', 'n_g', 'n_o', 'n_load'],
    note: 'TP requires proving the trigger fires, the URL is built from a network response, the cloaked dispatch runs, and loadUrl renders it. n_invoke is the orchestrator; the four boundary nodes are the load-bearing proof.',
  },
};

const FLOWS: Record<string, RubricFlowGraph> = {
  [MMP_CONVERSION_CLOAK_FLOW.flow_id]: MMP_CONVERSION_CLOAK_FLOW,
};

export function getFlow(flow_id: string): RubricFlowGraph | undefined {
  return FLOWS[flow_id];
}

export const ALL_FLOWS: RubricFlowGraph[] = Object.values(FLOWS);
