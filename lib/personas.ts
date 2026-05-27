// Personas humanize the abstract worker contracts.
// Each persona maps to one agent_id from lib/prompts.ts.

export type Persona = {
  agent_id: string;
  monogram: string;        // 2-letter avatar
  name: string;            // Persona name (e.g. "The Triager")
  one_liner: string;       // One-sentence mission
  what_i_do: string[];     // Plain-English capabilities
  what_i_cant_do: string[]; // Plain-English boundaries
  color: 'blue' | 'amber' | 'violet' | 'green';
};

export const PERSONAS: Persona[] = [
  {
    agent_id: 'producer.static_funnel',
    monogram: 'TR',
    name: 'The Triager',
    one_liner: 'Looks at every app for the first time and decides if it deserves a deeper look.',
    what_i_do: [
      'Install the app and check it actually runs',
      'Take a fast structured peek at the code',
      'Score the app against the rubric',
      'Tell you what I LOOKED for and DID NOT find',
    ],
    what_i_cant_do: [
      'Run the app and claim runtime behavior',
      'Make the final close/escalate decision',
      'Generate verdicts on my own',
    ],
    color: 'blue',
  },
  {
    agent_id: 'producer.static_gate',
    monogram: 'GK',
    name: 'The Gatekeeper',
    one_liner: 'Reads the triager\'s scorecard and applies a deterministic rule: close, escalate, or send to a human.',
    what_i_do: [
      'Apply the threshold and gray-band policy',
      'Honor override rules (force-dynamic) even when score is low',
      'Route install failures separately from rubric routing',
      'Produce an auditable explanation for every decision',
    ],
    what_i_cant_do: [
      'Re-score the rubric',
      'Invent new policy',
      'Communicate directly with the runtime lab',
    ],
    color: 'amber',
  },
  {
    agent_id: 'producer.static_triage',
    monogram: 'MP',
    name: 'The Mission Planner',
    one_liner: 'Turns suspicion into a precise runtime mission so the investigator wastes no time.',
    what_i_do: [
      'Pick the top hypotheses to validate',
      'Choose VPN countries to test against',
      'Suggest hooks, mocks, decryption points',
      'Set a time and iteration budget',
    ],
    what_i_cant_do: [
      'Run the mission myself',
      'Claim dynamic evidence I haven\'t received',
      'Skip past the gate decision',
    ],
    color: 'violet',
  },
  {
    agent_id: 'consumer.dynamic_evidence',
    monogram: 'IN',
    name: 'The Investigator',
    one_liner: 'Runs the mission inside an isolated lab and captures evidence — or honestly reports there isn\'t any.',
    what_i_do: [
      'Run the app in baseline and recommended geographies',
      'Capture screenshots, hook logs, and network traffic',
      'Score every IOC against the artifacts I collected',
      'Stop early when strong evidence is reached',
    ],
    what_i_cant_do: [
      'Score an IOC without an artifact to back it up',
      'Continue past the mission budget',
      'Make the final submission decision',
    ],
    color: 'green',
  },
  {
    agent_id: 'mission_control.report',
    monogram: 'RP',
    name: 'The Reporter',
    one_liner: 'Writes the final document a human reviewer will actually read and act on.',
    what_i_do: [
      'Combine static + dynamic into one document',
      'Reconcile scores honestly (strongest level per IOC, no double-counting)',
      'Generate the human-review checklist',
      'List limitations explicitly — what was NOT proven',
    ],
    what_i_cant_do: [
      'Overclaim what evidence shows',
      'Hide missing evidence',
      'Finalize the human verdict — only propose a candidate',
    ],
    color: 'green',
  },
];

export function getPersona(agentId: string): Persona | undefined {
  return PERSONAS.find(p => p.agent_id === agentId);
}
