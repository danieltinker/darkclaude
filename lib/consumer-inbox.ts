// =====================================================================
// Consumer Inbox — TWO-MACHINE BOUNDARY
// =====================================================================
//
// Per the architectural brief, the Consumer machine must never see the
// Producer's DB. Its source of truth is what arrived through PixelBridge:
// `ReviewMissionPackage` events from the Producer + any local artifacts
// captured by the Investigator.
//
// In a real two-machine setup this module would:
//   - tail $PIXELBRIDGE_ROOT/consumer/inbox/
//   - schema-validate each event
//   - persist to a local consumer.db
//   - expose ONLY the fields the Investigator legitimately has
//
// In this POC, we cheat by projecting from the shared mock dataset —
// but we keep the API surface narrow so that Consumer pages never
// reach back into Producer-only fields (metadata, scorecard, gate,
// worker_analytics, deep report, etc.). When the boundary becomes
// real, only this file changes.

import { QUEUE_CASES } from './mock-data';
import type {
  CaseIdentity,
  ConsumerStatus,
  DynamicEvidencePackage,
  GateDecision,
  GeoScreenshotSweepMission,
  GeoSweepCell,
  IocProofInstance,
  IocRubric,
  MissionKind,
  ReviewMissionPackage,
  TransferStatus,
  DeviceSyncState,
} from './types';

export type ConsumerInboxEntry = {
  case_identity: CaseIdentity;
  consumer_status: ConsumerStatus;
  priority: 'low' | 'medium' | 'high' | 'critical';
  mission_package: ReviewMissionPackage;
  rubric: IocRubric;
  // Typed experiment body (geo sweep vs IOC proof chain).
  mission_kind?: MissionKind;
  ioc_proofs?: IocProofInstance[];
  geo_sweep?: GeoScreenshotSweepMission;
  geo_sweep_cells?: GeoSweepCell[];
  transfer_status?: TransferStatus;
  device_sync?: DeviceSyncState;
  // The Producer's gate decision — embedded by the Producer to explain
  // WHY this case is being escalated. The Investigator needs the
  // candidate_score + triggered_force_rules + explanation to plan its
  // dynamic mission well; nothing else from the gate is shared.
  gate_context?: Pick<
    GateDecision,
    'status' | 'candidate_score' | 'triggered_force_rules' | 'explanation' | 'policy_applied'
  >;
  // The Investigator's OWN return — locally captured, optional.
  evidence_package?: DynamicEvidencePackage;
};

// Project Producer-side cases into Consumer-visible entries.
// Anything not listed here is intentionally hidden from Consumer.
function project(c: typeof QUEUE_CASES[number]): ConsumerInboxEntry | null {
  if (!c.consumer_status || !c.mission_package) return null;
  return {
    case_identity: c.case_identity,
    consumer_status: c.consumer_status,
    priority: c.priority,
    mission_package: c.mission_package,
    rubric: c.rubric,
    gate_context: c.gate_decision
      ? {
          status: c.gate_decision.status,
          candidate_score: c.gate_decision.candidate_score,
          triggered_force_rules: c.gate_decision.triggered_force_rules,
          explanation: c.gate_decision.explanation,
          policy_applied: c.gate_decision.policy_applied,
        }
      : undefined,
    mission_kind: c.mission_kind,
    ioc_proofs: c.ioc_proofs,
    geo_sweep: c.geo_sweep,
    geo_sweep_cells: c.geo_sweep_cells,
    transfer_status: c.transfer_status,
    device_sync: c.device_sync,
    evidence_package: c.evidence_package,
  };
}

export function getConsumerInbox(): ConsumerInboxEntry[] {
  return QUEUE_CASES.map(project).filter((x): x is ConsumerInboxEntry => x !== null);
}

export function getConsumerMission(reviewId: string): ConsumerInboxEntry | undefined {
  const c = QUEUE_CASES.find(x => x.case_identity.app_review_id === reviewId);
  if (!c) return undefined;
  return project(c) ?? undefined;
}
