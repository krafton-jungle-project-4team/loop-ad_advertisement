import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('schema-sync-utils script', () => {
  it('does not pass database passwords as Docker command arguments', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'scripts/schema-sync-utils.mjs'),
      'utf8',
    );

    expect(source).not.toContain("'--password'");
    expect(source).not.toContain('"--password"');
    expect(source).not.toMatch(
      /['"]-e['"],\s*`PGPASSWORD=\$\{db\.password\}`/,
    );
    expect(source).toContain("'--env-file'");
  });
});
