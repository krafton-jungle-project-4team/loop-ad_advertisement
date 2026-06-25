import { connection, runSqldef } from './schema-sync-utils.mjs';

const isDryRun = process.argv.includes('--dry-run');
const flags = isDryRun ? ['--dry-run'] : ['--apply'];
const status = runSqldef(connection(), flags);

process.exit(status);
