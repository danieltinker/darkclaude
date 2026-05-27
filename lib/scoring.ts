import { IocCandidateScore, IocLevel, IOC_POINTS, IocRubric, ReconciledIocScore } from './types';

const LEVEL_RANK: Record<IocLevel, number> = { weak: 1, medium: 2, strong: 3 };

export function pointsForLevel(level: IocLevel): number {
  return IOC_POINTS[level];
}

export function strongerLevel(a: IocLevel | null, b: IocLevel | null): IocLevel {
  if (!a && !b) return 'weak';
  if (!a) return b!;
  if (!b) return a;
  return LEVEL_RANK[a] >= LEVEL_RANK[b] ? a : b;
}

export function sumIocPoints(scores: IocCandidateScore[]): number {
  // Dedupe by ioc_id, taking strongest level per IOC.
  const byIoc = new Map<string, IocLevel>();
  for (const s of scores) {
    const prev = byIoc.get(s.ioc_id);
    byIoc.set(s.ioc_id, prev ? strongerLevel(prev, s.level) : s.level);
  }
  return Array.from(byIoc.values()).reduce((acc, lvl) => acc + pointsForLevel(lvl), 0);
}

export function reconcileScores(
  rubric: IocRubric,
  staticScores: IocCandidateScore[],
  dynamicScores: IocCandidateScore[],
): ReconciledIocScore[] {
  const byIoc = new Map<string, ReconciledIocScore>();
  const allIocIds = new Set<string>([
    ...staticScores.map(s => s.ioc_id),
    ...dynamicScores.map(s => s.ioc_id),
  ]);

  for (const ioc_id of allIocIds) {
    const def = rubric.iocs.find(i => i.ioc_id === ioc_id);
    const staticBest = pickStrongest(staticScores.filter(s => s.ioc_id === ioc_id));
    const dynamicBest = pickStrongest(dynamicScores.filter(s => s.ioc_id === ioc_id));
    const final_level = strongerLevel(staticBest?.level ?? null, dynamicBest?.level ?? null);
    byIoc.set(ioc_id, {
      ioc_id,
      ioc_name: def?.name ?? ioc_id,
      static_level: staticBest?.level ?? null,
      dynamic_level: dynamicBest?.level ?? null,
      final_level,
      final_points: pointsForLevel(final_level),
      evidence_ids: [
        ...(staticBest?.evidence_refs ?? []),
        ...(dynamicBest?.evidence_refs ?? []),
      ],
      static_reason: staticBest?.reason,
      static_confidence: staticBest?.confidence,
      static_scored_by: staticBest ? 'StaticFunnelWorker' : undefined,
      dynamic_reason: dynamicBest?.reason,
      dynamic_confidence: dynamicBest?.confidence,
      dynamic_scored_by: dynamicBest ? 'ConsumerDynamicEvidenceAgent' : undefined,
    });
  }
  return Array.from(byIoc.values());
}

function pickStrongest(scores: IocCandidateScore[]): IocCandidateScore | undefined {
  if (!scores.length) return undefined;
  return scores.reduce((best, cur) => (LEVEL_RANK[cur.level] > LEVEL_RANK[best.level] ? cur : best));
}

// Verdict thresholds. Riskware = 12–27, malicious = 28+. GRC-001
// canonically lands in riskware (final=24) and stays there until human
// review escalates, matching the README + golden-case category.
export function verdictFromScore(score: number): 'malicious' | 'riskware' | 'benign' | 'inconclusive' {
  if (score >= 28) return 'malicious';
  if (score >= 12) return 'riskware';
  if (score >= 4) return 'inconclusive';
  return 'benign';
}
