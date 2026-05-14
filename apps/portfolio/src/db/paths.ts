import { homedir } from 'node:os';
import { join } from 'node:path';

const APP_DIR_NAME = '.sdlc-portfolio-manager';

export function dataDir(): string {
  return process.env.SDLC_DATA_DIR ?? join(homedir(), APP_DIR_NAME);
}

export function dataPath(): string {
  return join(dataDir(), 'data.sqlite');
}

export function libraryDir(): string {
  return join(dataDir(), 'library');
}
