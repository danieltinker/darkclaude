// derivePhase — maps the granular ProducerStatus/ConsumerStatus into the
// simplified, business-readable journey vocabulary used across the UI.
// Keeps the technical states intact under the hood; this is display-only.

import type { ProducerStatus, ConsumerStatus, QueueCase } from './types';

export type JourneyPhase =
  | 'queued'
  | 'metadata_review'
  | 'closed_metadata'
  | 'slicing'
  | 'rubric_hunt'
  | 'closed_evasion'
  | 'installing'
  | 'transfer'
  | 'on_device'
  | 'evidence_returned'
  | 'scored'
  | 'human_review'
  | 'submitted';

export const PHASE_LABEL: Record<JourneyPhase, string> = {
  queued: 'Queued',
  metadata_review: 'Metadata review',
  closed_metadata: 'Closed · not enough metadata',
  slicing: 'Slicing',
  rubric_hunt: 'Rubric hunt',
  closed_evasion: 'Closed · not enough evasion points',
  installing: 'Installing',
  transfer: 'Transfer to device',
  on_device: 'Running on device',
  evidence_returned: 'Evidence returned',
  scored: 'Scored',
  human_review: 'Human review',
  submitted: 'Submitted',
};

// What just passed + what's next — for the "passed/next" status chips.
export const PHASE_PASSED_NEXT: Record<JourneyPhase, { passed: string; next: string }> = {
  queued: { passed: 'locked', next: 'metadata review' },
  metadata_review: { passed: 'locked', next: 'gate decision' },
  closed_metadata: { passed: 'metadata gate', next: 'human can reopen ↺' },
  slicing: { passed: 'metadata ✓', next: 'rubric hunt' },
  rubric_hunt: { passed: 'sliced ✓', next: 'gate decision' },
  closed_evasion: { passed: 'static gate', next: 'human can reopen ↺' },
  installing: { passed: 'static ✓', next: 'transfer' },
  transfer: { passed: 'installed ✓', next: 'on device' },
  on_device: { passed: 'transferred ✓', next: 'evidence return' },
  evidence_returned: { passed: 'on device ✓', next: 'reconcile' },
  scored: { passed: 'evidence ✓', next: 'human review' },
  human_review: { passed: 'scored ✓', next: 'submit' },
  submitted: { passed: 'reviewed ✓', next: 'closed' },
};

export function deriveProducerPhase(ps: ProducerStatus): JourneyPhase {
  switch (ps) {
    case 'QUEUE_AVAILABLE':
    case 'QUEUE_LOCKED':
    case 'CASE_CREATED':
      return 'queued';
    case 'METADATA_SCORING':
      return 'metadata_review';
    case 'METADATA_INSUFFICIENT_CLOSED':
      return 'closed_metadata';
    case 'STATIC_SLICE_RUNNING':
      return 'slicing';
    case 'STATIC_SCORECARD_READY':
      return 'rubric_hunt';
    case 'STATIC_INSUFFICIENT_CLOSED':
      return 'closed_evasion';
    case 'INSTALL_VERIFY_RUNNING':
    case 'INSTALL_VERIFY_FAILED':
      return 'installing';
    case 'DYNAMIC_ANALYSIS_REQUIRED':
    case 'DYNAMIC_MISSION_READY':
    case 'DYNAMIC_MISSION_SENT':
      return 'transfer';
    case 'CONSUMER_ACKED':
    case 'CONSUMER_RUNNING':
      return 'on_device';
    case 'EVIDENCE_RECEIVED':
      return 'evidence_returned';
    case 'SCORES_RECONCILED':
    case 'FALSE_POSITIVE_CLOSED':
    case 'EXPLORATORY_FINDING_READY':
      return 'scored';
    case 'DEEP_REPORT_READY':
    case 'HUMAN_REVIEW_READY':
    case 'HUMAN_REVIEW_STATIC_GATE':
      return 'human_review';
    case 'SUBMITTED':
    case 'CLOSED':
      return 'submitted';
    default:
      return 'queued';
  }
}

export function casePhase(c: QueueCase): JourneyPhase {
  return deriveProducerPhase(c.producer_status);
}

// The full ordered journey for the overview step wizard. Closures and the
// human-reopen loop are branch points off the main spine.
export const JOURNEY_SPINE: JourneyPhase[] = [
  'queued',
  'metadata_review',
  'slicing',
  'rubric_hunt',
  'installing',
  'transfer',
  'on_device',
  'evidence_returned',
  'scored',
  'human_review',
  'submitted',
];

export const JOURNEY_BRANCHES: Array<{ from: JourneyPhase; phase: JourneyPhase; note: string }> = [
  { from: 'metadata_review', phase: 'closed_metadata', note: 'not enough metadata · human may reopen ↺' },
  { from: 'rubric_hunt', phase: 'closed_evasion', note: 'not enough evasion points · human may reopen ↺' },
];
