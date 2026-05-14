import { v4 as uuid } from 'uuid';

export interface GeneratedDraft {
  draftType:
    | 'epic'
    | 'story'
    | 'task'
    | 'bug'
    | 'requirement'
    | 'roadmap-item'
    | 'parallelization-stream'
    | 'devlog-entry';
  draftData: {
    title: string;
    description?: string;
    acceptance_criteria?: Array<{ id: string; text: string }>;
    value?: number;
    complexity?: number;
  };
  parentDraftId?: string;
  relationshipDrafts?: Array<{ targetDraftId: string; type: string }>;
}

interface InternalDraft extends GeneratedDraft {
  id: string;
}

// Built-in MVP generator: turns a braindump into one epic + N stories with
// AC stubs, without calling any LLM. This is a placeholder for the framework-
// port planning personas (bill-crouse / judy / barbara / april) which arrive
// via Cursor Automation execution. The deterministic shape lets users
// exercise the discovery flow end-to-end before LLM-driven generation lands.
export function generateDefaultDrafts(rawDump: string): InternalDraft[] {
  const trimmed = rawDump.trim();
  if (!trimmed) return [];

  // Heuristic split: bullet/numbered lists first, fall back to sentences.
  const lines = trimmed.split('\n').map((l) => l.trim()).filter(Boolean);
  const bulletLines = lines
    .filter((l) => /^[-*•]\s+/.test(l) || /^\d+[.)]\s+/.test(l))
    .map((l) => l.replace(/^([-*•]|\d+[.)])\s+/, '').trim())
    .filter(Boolean);

  let storyTexts: string[];
  if (bulletLines.length >= 2) {
    storyTexts = bulletLines;
  } else {
    storyTexts = trimmed
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 8)
      .slice(0, 6);
    if (storyTexts.length < 2) storyTexts = [trimmed.slice(0, 200)];
  }

  // Epic title: first reasonable line
  const firstLine = lines[0] ?? trimmed;
  const epicTitle = firstLine.length > 80 ? firstLine.slice(0, 77) + '…' : firstLine;

  const epicId = uuid();
  const drafts: InternalDraft[] = [
    {
      id: epicId,
      draftType: 'epic',
      draftData: {
        title: `Epic: ${epicTitle}`,
        description: 'Auto-generated framing of the braindump. Edit before accepting.',
        value: 3,
        complexity: 5,
      },
    },
  ];

  for (let i = 0; i < Math.min(storyTexts.length, 6); i++) {
    const text = storyTexts[i]!;
    const storyTitle = text.length > 80 ? text.slice(0, 77) + '…' : text;
    drafts.push({
      id: uuid(),
      draftType: 'story',
      draftData: {
        title: storyTitle,
        description: text,
        acceptance_criteria: [
          { id: 'AC-1', text: `Implementation directly addresses: "${storyTitle}"` },
          { id: 'AC-2', text: 'At least one automated test exercises the new behavior' },
        ],
        value: 3,
        complexity: 3,
      },
      parentDraftId: epicId,
    });
  }

  return drafts;
}
