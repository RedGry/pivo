import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Semantic correction detection belongs to the coordinator, not transcript parsing.
export function stopDecision(event, pending) {
  if (event.hook_event_name !== 'Stop' || event.stop_hook_active || !pending) return {};
  return {
    decision: 'block',
    reason: 'This PivO session has pending corrective user feedback. If development is complete, read .agents/skills/pivo-retro/SKILL.md and finish the retrospective before your final response. Use only the pending file for your CODEX_THREAD_ID. If work is paused, cancelled, deferred or awaiting input, preserve it and stop. Do not rerun application checks for retrospective prose.',
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  const event = JSON.parse(input);
  const session = event.session_id;
  const pending = typeof session === 'string' && /^[a-zA-Z0-9_-]+$/.test(session)
    && existsSync(new URL(`../../.local/retro/pending/${session}.json`, import.meta.url));
  process.stdout.write(JSON.stringify(stopDecision(event, pending)));
}
