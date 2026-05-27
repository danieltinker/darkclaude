import { ALL_PROMPTS } from '@/lib/prompts';
import { PERSONAS } from '@/lib/personas';
import { allWorkerAnalytics } from '@/lib/mock-data';
import { AgentsClient } from './AgentsClient';

export default function AgentsPage() {
  return (
    <AgentsClient prompts={ALL_PROMPTS} personas={PERSONAS} analytics={allWorkerAnalytics()} />
  );
}
