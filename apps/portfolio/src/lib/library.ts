import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { dirname, join } from 'node:path';

import matter from 'gray-matter';

import { dataDir } from '@/db/paths';

export type LibraryEntryType = 'rule' | 'skill' | 'automation' | 'validator' | 'doc';

export const LIBRARY_TYPES: LibraryEntryType[] = [
  'rule',
  'skill',
  'automation',
  'validator',
  'doc',
];

export const DIR_FOR_TYPE: Record<LibraryEntryType, string> = {
  rule: 'rules',
  skill: 'skills',
  automation: 'automations',
  validator: 'validators',
  doc: 'docs',
};

export const TARGET_REPO_DIR: Record<LibraryEntryType, string> = {
  rule: '.cursor/rules',
  skill: '.cursor/skills',
  automation: '.cursor/automations',
  validator: '.cursor/validators',
  doc: '.cursor/framework',
};

export const EXT_FOR_TYPE: Record<LibraryEntryType, string> = {
  rule: '.mdc',
  skill: '', // skills are folders with SKILL.md
  automation: '.json',
  validator: '.json',
  doc: '.md',
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
