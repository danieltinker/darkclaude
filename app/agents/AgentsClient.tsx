'use client';

import { useEffect, useState } from 'react';
import type { AgentPrompt } from '@/lib/prompts';
import type { Persona } from '@/lib/personas';

type AgentsClientProps = {
  prompts: AgentPrompt[];
  personas: Persona[];
};

const STORAGE_PREFIX = 'darkclaude_agent_prompt_';

const COLOR_MAP: Record<Persona['color'], { ring: string; text: string; bg: string; border: string }> = {
  blue: { ring: 'border-accent-blue/60', text: 'text-accent-blue', bg: 'bg-accent-blue/10', border: 'border-accent-blue/30' },
  amber: { ring: 'border-accent-amber/60', text: 'text-accent-amber', bg: 'bg-accent-amber/10', border: 'border-accent-amber/30' },
  violet: { ring: 'border-accent-violet/60', text: 'text-accent-violet', bg: 'bg-accent-violet/10', border: 'border-accent-violet/30' },
  green: { ring: 'border-accent-green/60', text: 'text-accent-green', bg: 'bg-accent-green/10', border: 'border-accent-green/30' },
};

export function AgentsClient({ prompts, personas }: AgentsClientProps) {
  return (
    <div className="space-y-6">
      <div>
        <div className="text-[10px] text-ink-muted tracking-[0.3em] mb-1">// 04 AGENTS</div>
        <h1 className="text-2xl font-semibold">Workers in the pipeline</h1>
        <p className="text-sm text-ink-secondary mt-2 max-w-3xl">
          Every agent is a swappable "black box" that plugs into a stable contract — the system doesn't care
          whether it's an LLM, a script, or a human, as long as it produces the right output. You can edit
          any system prompt below to shape behavior. Edits persist in your browser.
        </p>
      </div>

      {/* Worker contract reference */}
      <div className="panel p-5">
        <div className="text-[10px] text-ink-muted tracking-widest mb-2">WORKER CONTRACT · same for every agent</div>
        <p className="text-xs text-ink-secondary mb-3 max-w-3xl">
          Every worker accepts a typed task and returns a typed result. No vendor coupling. To swap an LLM for
          a script, change the adapter — not the pipeline.
        </p>
        <div className="bg-bg-base border divider rounded p-3 overflow-auto max-h-[200px]">
          <pre className="text-[11px] text-ink-secondary leading-relaxed font-mono">
{`run(task: WorkerTask) → WorkerResult

WorkerTask  { task_id, task_type, case_identity, inputs, constraints }
WorkerResult { task_id, status, output_type, output_path, confidence,
               errors, limitations }`}
          </pre>
        </div>
      </div>

      {/* Persona cards */}
      <div className="space-y-5">
        {personas.map(persona => {
          const prompt = prompts.find(p => p.agent_id === persona.agent_id);
          if (!prompt) return null;
          return <AgentCard key={persona.agent_id} persona={persona} prompt={prompt} />;
        })}
      </div>
    </div>
  );
}

function AgentCard({ persona, prompt }: { persona: Persona; prompt: AgentPrompt }) {
  const colors = COLOR_MAP[persona.color];
  const [draft, setDraft] = useState(prompt.body);
  const [saved, setSaved] = useState(prompt.body);
  const [loaded, setLoaded] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_PREFIX + persona.agent_id);
    if (stored !== null) {
      setDraft(stored);
      setSaved(stored);
    }
    setLoaded(true);
  }, [persona.agent_id]);

  const isDirty = draft !== saved;
  const isCustomized = loaded && saved !== prompt.body;

  function handleSave() {
    localStorage.setItem(STORAGE_PREFIX + persona.agent_id, draft);
    setSaved(draft);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1800);
  }

  function handleResetToSaved() {
    setDraft(saved);
  }

  function handleResetToDefault() {
    localStorage.removeItem(STORAGE_PREFIX + persona.agent_id);
    setDraft(prompt.body);
    setSaved(prompt.body);
  }

  return (
    <div className="panel">
      {/* Header */}
      <div className="flex items-start gap-5 p-5 border-b divider">
        <div
          className={`w-14 h-14 rounded-lg flex items-center justify-center text-sm font-semibold border-2 ${colors.ring} ${colors.bg} ${colors.text} flex-shrink-0`}
        >
          {persona.monogram}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-lg font-semibold">{persona.name}</h2>
            <span
              className={`px-2 py-0.5 text-[10px] tracking-widest border rounded bg-bg-card ${colors.text} ${colors.border}`}
            >
              {prompt.role.toUpperCase()}
            </span>
            <span className="text-[10px] text-ink-muted font-mono">{prompt.agent_name}</span>
            {isCustomized && (
              <span className="px-2 py-0.5 text-[10px] tracking-widest border border-accent-amber/40 rounded bg-accent-amber/10 text-accent-amber">
                EDITED
              </span>
            )}
          </div>
          <p className="text-sm text-ink-secondary mt-2 leading-relaxed">{persona.one_liner}</p>
        </div>
      </div>

      {/* Plain-English what-I-do / what-I-can't-do */}
      <div className="grid grid-cols-2 gap-0">
        <div className="p-5 border-r divider">
          <div className="label mb-3">what I do</div>
          <ul className="space-y-2 text-xs">
            {persona.what_i_do.map(item => (
              <li key={item} className="flex gap-2 items-start">
                <span className={`${colors.text} flex-shrink-0 mt-0.5`}>+</span>
                <span className="text-ink-primary leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="p-5">
          <div className="label mb-3">what I can't do</div>
          <ul className="space-y-2 text-xs">
            {persona.what_i_cant_do.map(item => (
              <li key={item} className="flex gap-2 items-start">
                <span className="text-accent-red flex-shrink-0 mt-0.5">−</span>
                <span className="text-ink-primary leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Editable prompt */}
      <div className="border-t divider">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="label">system prompt</div>
            {isDirty && (
              <span className="px-2 py-0.5 text-[10px] tracking-widest border border-accent-amber/40 rounded bg-accent-amber/10 text-accent-amber">
                UNSAVED CHANGES
              </span>
            )}
            {justSaved && (
              <span className="px-2 py-0.5 text-[10px] tracking-widest border border-accent-green/40 rounded bg-accent-green/10 text-accent-green">
                SAVED
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isDirty && (
              <button
                onClick={handleResetToSaved}
                className="px-3 py-1.5 text-[10px] tracking-widest rounded border divider bg-bg-card text-ink-secondary hover:text-ink-primary hover:bg-bg-hover"
              >
                DISCARD
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={!isDirty}
              className={`px-3 py-1.5 text-[10px] tracking-widest rounded border ${
                isDirty
                  ? `${colors.border} ${colors.text} ${colors.bg} hover:brightness-125`
                  : 'border-ink-muted/30 bg-bg-card text-ink-muted cursor-not-allowed'
              }`}
            >
              SAVE
            </button>
            <button
              onClick={handleResetToDefault}
              disabled={!isCustomized && !isDirty}
              className={`px-3 py-1.5 text-[10px] tracking-widest rounded border ${
                isCustomized || isDirty
                  ? 'border-ink-muted/40 bg-bg-card text-ink-secondary hover:text-ink-primary hover:bg-bg-hover'
                  : 'border-ink-muted/20 bg-bg-card text-ink-muted cursor-not-allowed'
              }`}
            >
              RESET TO DEFAULT
            </button>
          </div>
        </div>

        <div className="px-4 pb-4">
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            className="w-full min-h-[280px] bg-bg-base border divider rounded p-3 text-[11px] text-ink-primary leading-relaxed font-mono resize-y focus:outline-none focus:border-accent-green/40"
            spellCheck={false}
          />
          <div className="flex items-center justify-between mt-2 text-[10px] text-ink-muted">
            <span>{draft.length.toLocaleString()} characters</span>
            <button
              onClick={() => setExpanded(!expanded)}
              className="hover:text-ink-secondary"
            >
              {expanded ? 'hide details ▴' : 'show capabilities / boundaries / scoring rules ▾'}
            </button>
          </div>
        </div>

        {expanded && (
          <div className="px-4 pb-5 grid grid-cols-3 gap-5 border-t divider pt-5">
            <DetailList title="capabilities" items={prompt.capabilities} marker="+" markerColor="text-accent-green" />
            <DetailList title="boundaries" items={prompt.boundaries} marker="−" markerColor="text-accent-red" />
            <DetailList title="scoring rules" items={prompt.scoring_rules} marker="≡" markerColor="text-accent-amber" />
          </div>
        )}
      </div>
    </div>
  );
}

function DetailList({
  title,
  items,
  marker,
  markerColor,
}: {
  title: string;
  items: string[];
  marker: string;
  markerColor: string;
}) {
  return (
    <div>
      <div className="label mb-2">{title}</div>
      <ul className="space-y-1.5 text-[11px] text-ink-secondary leading-relaxed">
        {items.map(i => (
          <li key={i} className="flex gap-2">
            <span className={`${markerColor} flex-shrink-0`}>{marker}</span>
            <span>{i}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
