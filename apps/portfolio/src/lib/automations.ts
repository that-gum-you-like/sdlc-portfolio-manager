import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { z } from 'zod';

export const AutomationFrontmatter = z.object({
  gate: z.string().nullable().optional(),
  prompt: z.string().min(1),
  cron: z.string().min(1),
  scope: z.record(z.unknown()).default({}),
  resultHook: z
    .enum(['file-findings-as-bugs', 'comment-only', 'custom'])
    .default('comment-only'),
});

export const AutomationEntry = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.literal('automation'),
  frontmatter: AutomationFrontmatter,
  filePath: z.string(),
});

export type AutomationEntry = z.infer<typeof AutomationEntry>;

function findTemplatesDir(): string | null {
  if (process.env.SDLC_TEMPLATES_DIR) return process.env.SDLC_TEMPLATES_DIR;
  let dir = process.cwd();
  for (let i = 0; i < 12; i++) {
    const candidate = join(dir, 'cursor-templates');
    if (existsSync(candidate) && statSync(candidate).isDirectory()) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

export function listAutomationEntries(): AutomationEntry[] {
  const root = findTemplatesDir();
  if (!root) return [];
  const dir = join(root, 'automations');
  if (!existsSync(dir)) return [];

  const entries: AutomationEntry[] = [];
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.json')) continue;
    const filePath = join(dir, file);
    const slug = file.replace(/\.json$/, '');
    try {
      const raw = JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
      const parsed = AutomationEntry.safeParse({ ...((raw as object) ?? {}), slug, filePath });
      if (parsed.success) entries.push(parsed.data);
    } catch {
      // skip malformed
    }
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  return entries;
}

export function findAutomationEntry(slug: string): AutomationEntry | null {
  return listAutomationEntries().find((e) => e.slug === slug) ?? null;
}
