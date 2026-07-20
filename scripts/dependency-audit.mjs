import { spawnSync } from 'node:child_process';

const result = spawnSync('npm', ['audit', '--json'], {
  encoding: 'utf8',
  maxBuffer: 10 * 1024 * 1024,
  shell: process.platform === 'win32',
});

let report;
try {
  report = JSON.parse(result.stdout || '{}');
} catch {
  console.error(result.stderr || result.stdout || 'npm audit did not return valid JSON.');
  process.exit(1);
}

const vulnerabilities = Object.entries(report.vulnerabilities || {})
  .filter(([, vulnerability]) => ['high', 'critical'].includes(vulnerability.severity))
  .map(([name, vulnerability]) => ({
    name,
    severity: vulnerability.severity,
    range: vulnerability.range,
    fixAvailable: vulnerability.fixAvailable,
    via: (vulnerability.via || []).map((entry) => typeof entry === 'string' ? entry : entry.title),
  }));

if (vulnerabilities.length) {
  console.error('High or critical npm vulnerabilities found:');
  vulnerabilities.forEach((vulnerability) => {
    console.error(JSON.stringify(vulnerability));
  });
  process.exit(1);
}

console.log('No high or critical npm vulnerabilities found.');
