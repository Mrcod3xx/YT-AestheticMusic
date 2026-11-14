import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EXTENSION_VERSION } from '../src/shared/version';

describe('extension versioning consistency', () => {
  const root = process.cwd();
  const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  const manifest = JSON.parse(
    readFileSync(resolve(root, 'public/manifest.json'), 'utf8')
  );
  const changelog = readFileSync(resolve(root, 'CHANGELOG.md'), 'utf8');

  it('uses a valid MAJOR.MINOR.PATCH version', () => {
    expect(EXTENSION_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('keeps package.json, public/manifest.json, and src/shared/version.ts synchronized', () => {
    expect(pkg.version).toBe(EXTENSION_VERSION);
    expect(manifest.version).toBe(EXTENSION_VERSION);
  });

  it('documents the current version in CHANGELOG.md', () => {
    expect(changelog).toContain(`## [${EXTENSION_VERSION}]`);
  });
});
