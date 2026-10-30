import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const repository = 'https://github.com/RedGry/pivo';

export function versionFromTag(tag) {
  if (!/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(tag)) {
    throw new Error('Release tag must be vMAJOR.MINOR.PATCH without a prerelease suffix.');
  }
  return tag.slice(1);
}

export function checkVersions(tag, cargo, config, frontend) {
  const version = versionFromTag(tag);
  const workspace = cargo.split(/^\[workspace\.package\][ \t]*\r?$/m)[1]?.split(/^\[/m)[0];
  const rustVersion = workspace?.match(/^version\s*=\s*"([^"]+)"\s*$/m)?.[1];
  for (const [name, actual] of Object.entries({ 'Cargo.toml': rustVersion, 'tauri.conf.json': config.version, 'frontend/package.json': frontend.version })) {
    if (actual !== version) throw new Error(`${name} version ${actual} does not match ${tag}.`);
  }
  return version;
}

export function releaseNotes(changelog, version) {
  const lines = changelog.split(/\r?\n/);
  const start = lines.findIndex(line => line === `## ${version}` || line.startsWith(`## ${version} - `));
  if (start < 0) throw new Error(`Add a nonempty "## ${version}" section to CHANGELOG.md before releasing.`);
  const end = lines.findIndex((line, index) => index > start && line.startsWith('## '));
  const notes = lines.slice(start + 1, end < 0 ? undefined : end).join('\n').trim();
  if (!notes) throw new Error(`CHANGELOG.md has no notes for ${version}.`);
  return notes;
}

export function makeManifest(tag, installer, signature, notes, date = new Date()) {
  const version = versionFromTag(tag);
  if (basename(installer) !== installer || !installer.endsWith('.exe') || !installer.includes(`_${version}_x64-setup.exe`)) {
    throw new Error('Expected the versioned Tauri x64 NSIS installer filename.');
  }
  if (!signature.trim()) throw new Error('The updater signature is empty.');
  return {
    version,
    notes,
    pub_date: date.toISOString(),
    platforms: {
      'windows-x86_64': {
        signature: signature.trim(),
        url: `${repository}/releases/download/${tag}/${encodeURIComponent(installer)}`,
      },
    },
  };
}

async function main([command, tag, bundleDirectory, outputDirectory]) {
  const version = checkVersions(
    tag,
    await readFile('Cargo.toml', 'utf8'),
    JSON.parse(await readFile('windows/tauri.conf.json', 'utf8')),
    JSON.parse(await readFile('windows/frontend/package.json', 'utf8')),
  );
  if (command === 'check') {
    releaseNotes(await readFile('CHANGELOG.md', 'utf8'), version);
    console.log(`Release versions and notes match ${tag}.`);
    return;
  }
  if (command !== 'manifest' || !bundleDirectory || !outputDirectory) {
    throw new Error('Usage: prepare.mjs check TAG | manifest TAG BUNDLE_DIRECTORY OUTPUT_DIRECTORY');
  }
  const installers = (await readdir(bundleDirectory)).filter(name => name.endsWith('.exe'));
  if (installers.length !== 1) throw new Error('Expected exactly one NSIS installer in the bundle directory.');
  const installer = installers[0];
  const signature = await readFile(join(bundleDirectory, `${installer}.sig`), 'utf8');
  const notes = releaseNotes(await readFile('CHANGELOG.md', 'utf8'), version);
  const manifest = makeManifest(tag, installer, signature, notes);
  await mkdir(outputDirectory, { recursive: true });
  await copyFile(join(bundleDirectory, installer), join(outputDirectory, installer));
  await copyFile(join(bundleDirectory, `${installer}.sig`), join(outputDirectory, `${installer}.sig`));
  await writeFile(join(outputDirectory, 'latest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(join(outputDirectory, 'notes.md'), `${notes}\n`);
  console.log(`Prepared signed Windows release ${version}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
