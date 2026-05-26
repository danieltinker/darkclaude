import { IocRubric } from './types';

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
        weak: {
          points: 2,
          definition: 'Remote config request observed with feature-flag-like keys.',
        },
        medium: {
          points: 4,
          definition: 'Code branches on remote flag and changes runtime behavior.',
        },
        strong: {
          points: 8,
          definition: 'Runtime confirms flagged behavior differs from baseline (e.g., hidden offer/redirect).',
        },
      },
    },
  ],
};
