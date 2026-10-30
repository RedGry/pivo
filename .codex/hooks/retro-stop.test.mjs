import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stopDecision } from './retro-stop.mjs';

test('ordinary completion does not request an extra model turn', () => {
  assert.deepEqual(stopDecision({ hook_event_name: 'Stop' }, false), {});
});

test('pending feedback requests the retrospective skill', () => {
  const result = stopDecision({ hook_event_name: 'Stop' }, true);
  assert.equal(result.decision, 'block');
  assert.match(result.reason, /pivo-retro\/SKILL.md/);
});

test('continuation cannot loop and other events do not trigger retro', () => {
  assert.deepEqual(stopDecision({ hook_event_name: 'Stop', stop_hook_active: true }, true), {});
  assert.deepEqual(stopDecision({ hook_event_name: 'SessionStart' }, true), {});
});

test('executable hook reads stdin and emits valid JSON from a subdirectory', () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('./retro-stop.mjs', import.meta.url))], {
    cwd: fileURLToPath(new URL('../', import.meta.url)),
    input: JSON.stringify({ hook_event_name: 'Stop', stop_hook_active: true }),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {});
});

test('executable resolves pending feedback relative to its repository', () => {
  const root = mkdtempSync(join(tmpdir(), 'pivo-retro-'));
  try {
    mkdirSync(join(root, '.codex', 'hooks'), { recursive: true });
    mkdirSync(join(root, '.local', 'retro', 'pending'), { recursive: true });
    const script = join(root, '.codex', 'hooks', 'retro-stop.mjs');
    cpSync(new URL('./retro-stop.mjs', import.meta.url), script);
    writeFileSync(join(root, '.local', 'retro', 'pending', 'session-a.json'), '{"corrections":["Example"]}');
    const result = spawnSync(process.execPath, [script], {
      cwd: tmpdir(),
      input: JSON.stringify({ hook_event_name: 'Stop', session_id: 'session-a' }),
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).decision, 'block');
    for (const session_id of ['session-b', '../session-a', null]) {
      const other = spawnSync(process.execPath, [script], {
        input: JSON.stringify({ hook_event_name: 'Stop', session_id }), encoding: 'utf8',
      });
      assert.equal(other.status, 0, other.stderr);
      assert.deepEqual(JSON.parse(other.stdout), {});
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
