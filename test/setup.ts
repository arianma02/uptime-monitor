import path from 'node:path';

process.env.DOTENV_CONFIG_PATH = path.join(
  process.cwd(),
  'node_modules',
  '.no-test-env',
);
