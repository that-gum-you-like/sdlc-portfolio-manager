import { z } from 'zod';

export const ENTITY_TYPES = ['portfolio', 'project', 'work_item'] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const RELATIONSHIP_TYPES = [
  'parent_of',
  'blocks',
  'depends_on',
  'duplicates',
  'related_to',
  'predecessor_of',
] as const;
export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

// Inverse labels — what to call this edge when viewed from the target side.
export const INVERSE_LABEL: Record<RelationshipType, string> = {
  parent_of: 'child_of',
  blocks: 'blocked_by',
  depends_on: 'required_by',
  duplicates: 'duplicated_by',
  related_to: 'related_to',
  predecessor_of: 'successor_of',
};

export const SYMMETRIC: Record<RelationshipType, boolean> = {
  parent_of: false,
  blocks: false,
  depends_on: false,
  duplicates: false,
  related_to: true,
  predecessor_of: false,
};

export const CreateRelationshipBody = z.object({
  sourceType: z.enum(ENTITY_TYPES),
  sourceId: z.string().uuid(),
  targetType: z.enum(ENTITY_TYPES),
  targetId: z.string().uuid(),
  type: z.enum(RELATIONSHIP_TYPES),
  note: z.string().max(1000).optional(),
});
export type CreateRelationshipBody = z.infer<typeof CreateRelationshipBody>;

export interface RelationshipGroup {
  type: string;
  direction: 'outgoing' | 'incoming' | 'symmetric';
  edges: Array<{
    id: string;
    relationshipId: string;
    type: EntityType;
    title: string;
    note: string | null;
  }>;
}
