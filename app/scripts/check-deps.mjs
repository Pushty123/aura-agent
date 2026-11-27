// Stops the build early with a clear message when installed packages
// don't match package.json (for example after a git pull).
import { execSync } from 'node:child_process';
try {
  execSync('npm ls --depth=0', { stdio: 'pipe' });
} catch (e) {
  const out = String(e.stdout || '') + String(e.stderr || '');
  const bad = out.split('\n').filter((l) => /invalid|missing|UNMET/i.test(l));
  console.error('\nYour installed packages are out of date for this version of AURA:');
  for (const l of bad.slice(0, 10)) console.error('  ' + l.trim());
  console.error('\nFix: run  npm install  in the app folder, then build again.\n');
  process.exit(1);
}
