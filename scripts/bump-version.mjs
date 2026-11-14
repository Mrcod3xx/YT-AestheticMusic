import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const pkgPath = resolve(root, 'package.json');
const manifestPath = resolve(root, 'public/manifest.json');
const versionTsPath = resolve(root, 'src/shared/version.ts');

const SEMVER_RE = /^\d+\.\d+\.\d+$/;

function readVersions() {
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const versionTs = readFileSync(versionTsPath, 'utf8');
  const tsMatch = versionTs.match(/EXTENSION_VERSION\s*=\s*['"]([^'"]+)['"]/);
  return {
    pkg,
    manifest,
    versionTs,
    tsVersion: tsMatch?.[1] || '',
  };
}

function incrementSemver(current, bumpType) {
  if (SEMVER_RE.test(bumpType)) {
    return bumpType;
  }
  const [maj, min, pat] = current.split('.').map(Number);
  if (bumpType === 'major') return `${maj + 1}.0.0`;
  if (bumpType === 'minor') return `${maj}.${min + 1}.0`;
  if (bumpType === 'patch') return `${maj}.${min}.${pat + 1}`;
  throw new Error(
    `Invalid version argument "${bumpType}". Expected patch, minor, major, or x.y.z.`
  );
}

const arg = process.argv[2];
const { pkg, manifest, versionTs, tsVersion } = readVersions();

if (arg === '--check') {
  const allValid =
    SEMVER_RE.test(pkg.version) &&
    pkg.version === manifest.version &&
    pkg.version === tsVersion;

  if (!allValid) {
    console.error(
      `[version-check] Mismatch detected:\n` +
        `  package.json:        ${pkg.version}\n` +
        `  public/manifest.json: ${manifest.version}\n` +
        `  src/shared/version.ts: ${tsVersion}`
    );
    process.exit(1);
  }
  console.log(`[version-check] OK (${pkg.version})`);
  process.exit(0);
}

if (!arg) {
  console.error('Usage: node scripts/bump-version.mjs <patch|minor|major|x.y.z|--check>');
  process.exit(1);
}

const nextVersion = incrementSemver(pkg.version, arg);

pkg.version = nextVersion;
manifest.version = nextVersion;

const updatedVersionTs = versionTs.replace(
  /EXTENSION_VERSION\s*=\s*['"][^'"]+['"]/,
  `EXTENSION_VERSION = '${nextVersion}'`
);

writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
writeFileSync(versionTsPath, updatedVersionTs, 'utf8');

console.log(`[version-bump] Updated extension version to ${nextVersion} across package.json, manifest.json, and src/shared/version.ts`);
