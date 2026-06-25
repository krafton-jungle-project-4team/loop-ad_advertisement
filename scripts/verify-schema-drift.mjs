import { connection, runSqldef } from './schema-sync-utils.mjs';

const flags = ['--check'];

if (process.argv.includes('--verbose')) {
  flags.push('--verbose');
}

const status = runSqldef(connection(), flags);

if (status === 0) {
  process.exit(0);
}

if (status === 2) {
  process.exit(2);
}

process.exit(status);
