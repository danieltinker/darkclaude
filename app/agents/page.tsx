import { ALL_PROMPTS } from '@/lib/prompts';
import { PERSONAS } from '@/lib/personas';
import { AgentsClient } from './AgentsClient';

export default function AgentsPage() {
  return <AgentsClient prompts={ALL_PROMPTS} personas={PERSONAS} />;
}
