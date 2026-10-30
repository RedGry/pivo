import assert from 'node:assert/strict';
import test from 'node:test';
import { checkVersions, makeManifest, releaseNotes, versionFromTag } from './prepare.mjs';

test('release tags and all three version declarations must agree', () => {
  const cargo = '[workspace]\nmembers = ["windows"]\n[workspace.package]\nversion = "0.1.0"\nedition = "2024"\n[profile.release]\nopt-level = "s"\n';
  assert.equal(checkVersions('v0.1.0', cargo, { version: '0.1.0' }, { version: '0.1.0' }), '0.1.0');
  assert.throws(() => checkVersions('v0.1.1', cargo, { version: '0.1.1' }, { version: '0.1.1' }), /Cargo.toml/);
  assert.throws(() => checkVersions('v0.1.0', cargo, { version: '0.1.1' }, { version: '0.1.0' }), /tauri.conf/);
  assert.throws(() => checkVersions('v0.1.0', cargo, { version: '0.1.0' }, { version: '0.1.1' }), /package.json/);
  for (const tag of ['0.1.0', 'v01.1.0', 'v0.1.0-beta', 'v0.1', 'v0.1.0/evil']) {
    assert.throws(() => versionFromTag(tag));
  }
});

test('manifest embeds signature contents and immutable versioned download URL', () => {
  const result = makeManifest('v0.1.0', 'PivO_0.1.0_x64-setup.exe', 'signature-content\n', 'Changes', new Date('2026-10-30T00:00:00Z'));
  assert.deepEqual(result, {
    version: '0.1.0', notes: 'Changes', pub_date: '2026-10-30T00:00:00.000Z',
    platforms: { 'windows-x86_64': {
      signature: 'signature-content',
      url: 'https://github.com/RedGry/pivo/releases/download/v0.1.0/PivO_0.1.0_x64-setup.exe',
    } },
  });
  assert.throws(() => makeManifest('v0.1.0', 'PivO_0.1.0_x64-setup.exe', ' ', 'Changes'), /empty/);
  assert.throws(() => makeManifest('v0.1.0', 'PivO_0.2.0_x64-setup.exe', 'sig', 'Changes'), /filename/);
  assert.throws(() => makeManifest('v0.1.0', '../PivO_0.1.0_x64-setup.exe', 'sig', 'Changes'), /filename/);
});

test('release notes select only the tagged version and refuse missing notes', () => {
  const changelog = '# Changelog\r\n\r\n## Unreleased\r\n\r\n- Future\r\n\r\n## 0.1.0 - 2026-10-30\r\n\r\n- Signed updates\r\n\r\n## 0.0.1\r\n\r\n- Old\r\n';
  assert.equal(releaseNotes(changelog, '0.1.0'), '- Signed updates');
  assert.throws(() => releaseNotes(changelog, '0.2.0'), /nonempty/);
  assert.throws(() => releaseNotes('## 0.1.0\n\n## 0.0.1\n- Old', '0.1.0'), /no notes/);
});
