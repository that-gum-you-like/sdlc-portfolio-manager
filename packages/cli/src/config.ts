export interface PcConfig {
  apiUrl: string;
  agent: string;
  defaultProject: string | null;
}

export function loadConfig(): PcConfig {
  return {
    apiUrl: process.env.PC_API_URL ?? 'http://localhost:3737',
    agent: process.env.PC_AGENT ?? 'cursor-bg',
    defaultProject: process.env.PC_PROJECT ?? null,
  };
}
