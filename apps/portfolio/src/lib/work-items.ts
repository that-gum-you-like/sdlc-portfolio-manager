import { z } from 'zod';

export const WORK_ITEM_TYPES = [
  'epic',
  'story',
  'task',
  'bug',
  'requirement',
  'roadmap-item',
  'parallelization-stream',
  'devlog-entry',
] as const;

export type WorkItemType = (typeof WORK_ITEM_TYPES)[number];

export const WORK_ITEM_STATUSES = [
  'backlog',
  'ready',
  'in_progress',
  'needs-human',
  'in_review',
  'done',
  'cancelled',
] as const;

export type WorkItemStatus = (typeof WORK_ITEM_STATUSES)[number];

export const BOARD_COLUMN_ORDER: WorkItemStatus[] = [
  'backlog',
  'ready',
  'in_progress',
  'needs-human',
  'in_review',
  'done',
];

const TRANSITIONS: Record<WorkItemStatus, WorkItemStatus[]> = {
  backlog: ['ready', 'cancelled'],
  ready: ['in_progress', 'backlog', 'cancelled'],
  in_progress: ['needs-human', 'in_review', 'ready', 'cancelled'],
  'needs-human': ['in_progress', 'cancelled'],
  in_review: ['done', 'in_progress', 'cancelled'],
  done: ['in_review'],
  cancelled: ['backlog'],
};

export function allowedNextStatuses(from: WorkItemStatus): WorkItemStatus[] {
  return TRANSITIONS[from];
}

export function isTransitionAllowed(from: WorkItemStatus, to: WorkItemStatus): boolean {
  if (from === to) return true;
  return TRANSITIONS[from].includes(to);
}

export const AcceptanceCriterion = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  evidence_refs: z.array(z.string()).optional(),
});
export type AcceptanceCriterion = z.infer<typeof AcceptanceCriterion>;

export const CreateWorkItemBody = z.object({
  projectId: z.string().uuid(),
  type: z.enum(WORK_ITEM_TYPES),
  title: z.string().min(1).max(200),
  description: z.string().max(50_000).optional(),
  parentId: z.string().uuid().nullish(),
  assignee: z.string().max(120).nullish(),
  labels: z.array(z.string().min(1).max(40)).optional(),
  acceptanceCriteria: z.array(AcceptanceCriterion).optional(),
  subtypeData: z.record(z.unknown()).optional(),
  status: z.enum(WORK_ITEM_STATUSES).optional(),
});
export type CreateWorkItemBody = z.infer<typeof CreateWorkItemBody>;

export const PatchWorkItemBody = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(50_000).nullish(),
  status: z.enum(WORK_ITEM_STATUSES).optional(),
  assignee: z.string().max(120).nullish(),
  parentId: z.string().uuid().nullish(),
  labels: z.array(z.string().min(1).max(40)).optional(),
  acceptanceCriteria: z.array(AcceptanceCriterion).optional(),
  subtypeData: z.record(z.unknown()).optional(),
  rank: z.number().int().optional(),
});
export type PatchWorkItemBody = z.infer<typeof PatchWorkItemBody>;

export const ClaimBody = z.object({
  agent: z.string().min(1).max(120),
});

const REQ_COUNTER = { next: 1 };

export function generateReqId(): string {
  return `REQ-${REQ_COUNTER.next++}`;
}

export function validateSubtypeOnCreate(
  type: WorkItemType,
  criteria: AcceptanceCriterion[] | undefined,
): { ok: true } | { ok: false; code: string; message: string } {
  if (type === 'requirement') {
    if (!criteria || criteria.length === 0) {
      return {
        ok: false,
        code: 'acceptance_criteria_required',
        message: 'requirement-type work items require at least one acceptance criterion',
      };
    }
  }
  return { ok: true };
}
