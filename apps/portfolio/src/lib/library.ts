import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';

import matter from 'gray-matter';

import { dataDir } from '@/db/paths';

export type LibraryEntryType =
  | 'rule'
  | 'skill'
  | 'automation'
  | 'validator'
  | 'doc'
  | 'guardrail';

export const LIBRARY_TYPES: LibraryEntryType[] = [
  'rule',
  'skill',
  'automation',
  'validator',
  'doc',
  'guardrail',
];

export const DIR_FOR_TYPE: Record<LibraryEntryType, string> = {
  rule: 'rules',
  skill: 'skills',
  automation: 'automations',
  validator: 'validators',
  doc: 'docs',
  guardrail: 'guardrails',
};

export const TARGET_REPO_DIR: Record<LibraryEntryType, string> = {
  rule: '.cursor/rules',
  skill: '.cursor/skills',
  automation: '.cursor/automations',
  validator: '.cursor/validators',
  doc: '.cursor/framework',
  guardrail: '.cursor/guardrails',
};

export const EXT_FOR_TYPE: Record<LibraryEntryType, string> = {
  rule: '.mdc',
  skill: '', // skills are folders with SKILL.md
  automation: '.json',
  validator: '.json',
  doc: '.md',
  guardrail: '.json',
};

export interface LibraryEntry {
  type: LibraryEntryType;
  slug: string;
  name: string;
  description?: string;
  body?: string;
  frontmatter: Record<string, unknown>;
  filePath: string;
  origin: 'seed' | 'user';
}

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

function userLibraryDir(): string {
  return join(dataDir(), 'library');
}

function loadSingleFile(
  type: LibraryEntryType,
  filePath: string,
  origin: 'seed' | 'user',
): LibraryEntry | null {
  try {
    const raw = readFileSync(filePath, 'utf8');
    const filename = filePath.split('/').pop() ?? '';
    const ext = EXT_FOR_TYPE[type];
    const slug = ext ? filename.replace(new RegExp(`\\${ext}$`), '') : filename;

    if (filePath.endsWith('.json')) {
      const parsed = JSON.parse(raw) as {
        name?: string;
        description?: string;
        frontmatter?: Record<string, unknown>;
      };
      return {
        type,
        slug,
        name: parsed.name ?? slug,
        description: parsed.description,
        frontmatter: parsed.frontmatter ?? {},
        filePath,
        origin,
      };
    }

    const parsed = matter(raw);
    const fm = (parsed.data ?? {}) as Record<string, unknown>;
    return {
      type,
      slug,
      name: (fm.name as string) ?? slug,
      description: fm.description as string | undefined,
      body: parsed.content.trim(),
      frontmatter: fm,
      filePath,
      origin,
    };
  } catch {
    return null;
  }
}

function loadSkillFolder(
  folderPath: string,
  origin: 'seed' | 'user',
): LibraryEntry | null {
  const skillFile = join(folderPath, 'SKILL.md');
  if (!existsSync(skillFile)) return null;
  const slug = folderPath.split('/').pop() ?? '';
  const raw = readFileSync(skillFile, 'utf8');
  const parsed = matter(raw);
  const fm = (parsed.data ?? {}) as Record<string, unknown>;
  return {
    type: 'skill',
    slug,
    name: (fm.name as string) ?? slug,
    description: fm.description as string | undefined,
    body: parsed.content.trim(),
    frontmatter: fm,
    filePath: skillFile,
    origin,
  };
}

function loadDirectory(
  root: string,
  type: LibraryEntryType,
  origin: 'seed' | 'user',
): LibraryEntry[] {
  const dir = join(root, DIR_FOR_TYPE[type]);
  if (!existsSync(dir)) return [];
  const entries: LibraryEntry[] = [];

  if (type === 'skill') {
    for (const name of readdirSync(dir)) {
      const candidate = join(dir, name);
      if (statSync(candidate).isDirectory()) {
        const entry = loadSkillFolder(candidate, origin);
        if (entry) entries.push(entry);
      }
    }
    return entries;
  }

  const ext = EXT_FOR_TYPE[type];
  for (const file of readdirSync(dir)) {
    if (ext && !file.endsWith(ext)) continue;
    const entry = loadSingleFile(type, join(dir, file), origin);
    if (entry) entries.push(entry);
  }
  return entries;
}

export function listLibraryEntries(type?: LibraryEntryType): LibraryEntry[] {
  const seedRoot = findTemplatesDir();
  const userRoot = userLibraryDir();

  const types = type ? [type] : LIBRARY_TYPES;
  const bySlug = new Map<string, LibraryEntry>();

  for (const t of types) {
    if (seedRoot) {
      for (const entry of loadDirectory(seedRoot, t, 'seed')) {
        bySlug.set(`${t}:${entry.slug}`, entry);
      }
    }
    // User entries override seed entries with the same slug ("fork on edit")
    for (const entry of loadDirectory(userRoot, t, 'user')) {
      bySlug.set(`${t}:${entry.slug}`, entry);
    }
  }

  const list = Array.from(bySlug.values());
  list.sort((a, b) => {
    if (a.type !== b.type) return LIBRARY_TYPES.indexOf(a.type) - LIBRARY_TYPES.indexOf(b.type);
    return a.name.localeCompare(b.name);
  });
  return list;
}

export function findLibraryEntry(type: LibraryEntryType, slug: string): LibraryEntry | null {
  return listLibraryEntries(type).find((e) => e.slug === slug) ?? null;
}

function userTypeDir(type: LibraryEntryType): string {
  return join(userLibraryDir(), DIR_FOR_TYPE[type]);
}

const SAFE_SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;

export function isSafeSlug(slug: string): boolean {
  if (!SAFE_SLUG.test(slug)) return false;
  if (slug.includes('..') || slug.includes('/') || slug.includes('\\')) return false;
  return true;
}

export function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

export interface ValidationResult {
  ok: boolean;
  error?: string;
  details?: unknown;
}

// Lightweight per-type parse-and-shape validation. Schema enforcement is
// loose at MVP: we ensure the file parses and (for JSON types) that
// required top-level keys exist. Deeper Zod-shape validation can layer on.
export function validateContent(type: LibraryEntryType, content: string): ValidationResult {
  if (type === 'skill') {
    return { ok: false, error: 'skill_editor_unsupported', details: 'Skill folder editing is not supported in this pass' };
  }
  const ext = EXT_FOR_TYPE[type];
  if (ext === '.json') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      return {
        ok: false,
        error: 'invalid_json',
        details: err instanceof Error ? err.message : String(err),
      };
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { ok: false, error: 'invalid_shape', details: 'Expected a JSON object at top level' };
    }
    const obj = parsed as Record<string, unknown>;
    if (typeof obj.name !== 'string' || obj.name.length === 0) {
      return { ok: false, error: 'missing_name', details: 'Top-level "name" string is required' };
    }
    if (type === 'automation' || type === 'validator') {
      const fm = obj.frontmatter;
      if (typeof fm !== 'object' || fm === null || Array.isArray(fm)) {
        return {
          ok: false,
          error: 'missing_frontmatter',
          details: `${type} entries need a "frontmatter" object`,
        };
      }
      if (type === 'automation') {
        const f = fm as Record<string, unknown>;
        if (typeof f.prompt !== 'string' || f.prompt.length === 0) {
          return { ok: false, error: 'missing_prompt', details: 'frontmatter.prompt is required' };
        }
        if (typeof f.cron !== 'string' || f.cron.length === 0) {
          return { ok: false, error: 'missing_cron', details: 'frontmatter.cron is required' };
        }
      }
      if (type === 'validator') {
        const f = fm as Record<string, unknown>;
        if (typeof f.gate !== 'string' || f.gate.length === 0) {
          return { ok: false, error: 'missing_gate', details: 'frontmatter.gate is required' };
        }
        if (typeof f.command !== 'string' || f.command.length === 0) {
          return { ok: false, error: 'missing_command', details: 'frontmatter.command is required' };
        }
      }
    }
    return { ok: true };
  }

  // Markdown types — parse frontmatter
  try {
    matter(content);
  } catch (err) {
    return {
      ok: false,
      error: 'invalid_frontmatter',
      details: err instanceof Error ? err.message : String(err),
    };
  }
  return { ok: true };
}

export interface WriteResult {
  filePath: string;
  created: boolean;
  forkedFromSeed: boolean;
}

export function writeLibraryEntry(
  type: LibraryEntryType,
  slug: string,
  content: string,
): WriteResult {
  if (type === 'skill') {
    throw new Error('skill editor not supported in this pass');
  }
  if (!isSafeSlug(slug)) {
    throw new Error(`unsafe slug: ${slug}`);
  }
  const dir = userTypeDir(type);
  mkdirSync(dir, { recursive: true });
  const filePath = join(dir, `${slug}${EXT_FOR_TYPE[type]}`);
  const existedBefore = existsSync(filePath);

  // Was there a seeded version we're forking from?
  const seedRoot = findTemplatesDir();
  const seedPath = seedRoot
    ? join(seedRoot, DIR_FOR_TYPE[type], `${slug}${EXT_FOR_TYPE[type]}`)
    : null;
  const forkedFromSeed = !existedBefore && seedPath !== null && existsSync(seedPath);

  writeFileSync(filePath, content, 'utf8');
  return { filePath, created: !existedBefore, forkedFromSeed };
}

export function deleteUserLibraryEntry(
  type: LibraryEntryType,
  slug: string,
): { deleted: boolean; reverted: boolean } {
  if (!isSafeSlug(slug)) throw new Error(`unsafe slug: ${slug}`);
  const userPath = join(userTypeDir(type), `${slug}${EXT_FOR_TYPE[type]}`);
  if (!existsSync(userPath)) {
    return { deleted: false, reverted: false };
  }
  rmSync(userPath);
  const seedRoot = findTemplatesDir();
  const seedPath = seedRoot
    ? join(seedRoot, DIR_FOR_TYPE[type], `${slug}${EXT_FOR_TYPE[type]}`)
    : null;
  const reverted = seedPath !== null && existsSync(seedPath);
  return { deleted: true, reverted };
}

export function readRawContent(filePath: string): string {
  return readFileSync(filePath, 'utf8');
}

export function getTemplateForType(type: LibraryEntryType, slug: string, name: string): string {
  if (type === 'rule') {
    return `---
name: ${JSON.stringify(name)}
description: ""
globs: []
alwaysApply: false
---

# ${name}

Write the rule body here. The Cursor agent will read this when one of the globs matches a file
in the target repo.
`;
  }
  if (type === 'doc') {
    return `---
name: ${JSON.stringify(name)}
description: ""
category: ""
level: 1
---

# ${name}

Framework knowledge content here.
`;
  }
  if (type === 'automation') {
    return JSON.stringify(
      {
        name,
        description: '',
        type: 'automation',
        frontmatter: {
          prompt: 'Replace with the prompt the automation should run.',
          cron: '0 9 * * MON',
          scope: {},
          resultHook: 'comment-only',
        },
      },
      null,
      2,
    );
  }
  if (type === 'validator') {
    return JSON.stringify(
      {
        name,
        description: '',
        type: 'validator',
        frontmatter: {
          gate: 'quality',
          command: 'npm run lint && npm run typecheck',
          pass_exit_codes: [0],
          output_parser: 'none',
          timeout_seconds: 300,
        },
      },
      null,
      2,
    );
  }
  if (type === 'skill') {
    throw new Error('skill editor not supported in this pass');
  }
  if (type === 'guardrail') {
    return JSON.stringify(
      {
        name,
        description: '',
        type: 'guardrail',
        frontmatter: {
          kind: 'custom',
          scope: 'per-agent',
          action_patterns: ['*'],
          verdict_on_breach: 'warn',
          message: 'Custom guardrail breached',
        },
      },
      null,
      2,
    );
  }
  // exhaustiveness check
  const _exhaustive: never = type;
  throw new Error(`unknown type: ${_exhaustive as string}`);
}
