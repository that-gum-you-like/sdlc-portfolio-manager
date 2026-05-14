#!/usr/bin/env node
import { Command, Option } from 'commander';
import { readFileSync } from 'node:fs';

import { loadConfig } from './config.js';
import { ApiError, apiRequest } from './http.js';

interface WorkItemSummary {
  id: string;
  title: string;
  type: string;
  status: string;
  assignee: string | null;
  projectId: string;
  parentId: string | null;
  description: string | null;
}

interface Question {
  id: string;
  workItemId: string;
  body: string;
  status: 'open' | 'answered' | 'cancelled';
  answeredAt: string | null;
  answerId: string | null;
}

interface Comment {
  id: string;
  workItemId: string;
  author: string;
  body: string;
  createdAt: string;
}

const program = new Command();
program
  .name('pc')
  .description('CLI for sdlc-portfolio-manager — used by Cursor agents and humans alike')
  .addOption(new Option('--api-url <url>', 'Override PC_API_URL').default(undefined))
  .addOption(new Option('--agent <name>', 'Override PC_AGENT').default(undefined))
  .addOption(new Option('--project <slug>', 'Override PC_PROJECT').default(undefined));

function resolveConfig(opts: { apiUrl?: string; agent?: string; project?: string }) {
  const base = loadConfig();
  return {
    apiUrl: opts.apiUrl ?? base.apiUrl,
    agent: opts.agent ?? base.agent,
    project: opts.project ?? base.defaultProject,
  };
}

function getGlobalOpts() {
  // commander v12: parent opts via program.opts() on subcommands
  const opts = program.opts<{ apiUrl?: string; agent?: string; project?: string }>();
  return resolveConfig(opts);
}

function handleApiError(err: unknown): never {
  if (err instanceof ApiError) {
    process.stderr.write(`${err.code}: ${err.message}\n`);
    if (err.details) process.stderr.write(`${JSON.stringify(err.details)}\n`);
    process.exit(1);
  }
  if (err instanceof Error) {
    process.stderr.write(`${err.message}\n`);
  } else {
    process.stderr.write(`${String(err)}\n`);
  }
  process.exit(1);
}

function readStdinSync(): string {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

// pc next [--type <t,t>] [--label <l>]
program
  .command('next')
  .description('Claim the next ready work item for this agent. Exit 2 if none.')
  .option('--type <types>', 'Comma-separated work-item types to filter (story,task,bug)')
  .option('--label <label>', 'Only items with this label')
  .action(async (opts: { type?: string; label?: string }) => {
    const cfg = getGlobalOpts();
    const params = new URLSearchParams();
    params.set('agent', cfg.agent);
    if (cfg.project) params.set('projectSlug', cfg.project);
    if (opts.type) params.set('type', opts.type);
    if (opts.label) params.set('label', opts.label);

    try {
      const { status, data } = await apiRequest<{ workItem: WorkItemSummary }>(
        cfg.apiUrl,
        'GET',
        `/api/v1/work-items/next-ready?${params.toString()}`,
      );
      if (status === 204 || !data) {
        process.stderr.write('No ready work.\n');
        process.exit(2);
      }
      const w = data.workItem;
      process.stdout.write(
        [
          `id\t${w.id}`,
          `title\t${w.title}`,
          `type\t${w.type}`,
          `status\t${w.status}`,
          `assignee\t${w.assignee ?? ''}`,
          `project_id\t${w.projectId}`,
          ...(w.description ? ['', w.description] : []),
        ].join('\n') + '\n',
      );
    } catch (err) {
      handleApiError(err);
    }
  });

// pc done <id>
program
  .command('done <id>')
  .description('Transition a work item to in_review.')
  .action(async (id: string) => {
    const cfg = getGlobalOpts();
    try {
      const { data } = await apiRequest<{ workItem: WorkItemSummary }>(
        cfg.apiUrl,
        'PATCH',
        `/api/v1/work-items/${id}`,
        { status: 'in_review' },
      );
      process.stdout.write(`${data?.workItem.id}\tin_review\n`);
    } catch (err) {
      handleApiError(err);
    }
  });

// pc comment <id> [message]    (stdin used if message omitted)
program
  .command('comment <id> [message...]')
  .description('Post a comment on a work item. Pipe long bodies via stdin.')
  .option('--author <name>', 'Override author (defaults to PC_AGENT)')
  .option('--kind <kind>', 'note (default) or evidence', 'note')
  .option('--criterion <id>', 'Acceptance criterion id (required when kind=evidence)')
  .action(
    async (
      id: string,
      messageParts: string[],
      opts: { author?: string; kind?: 'note' | 'evidence'; criterion?: string },
    ) => {
      const cfg = getGlobalOpts();
      let body = messageParts.join(' ').trim();
      if (!body) body = readStdinSync().trim();
      if (!body) {
        process.stderr.write('No comment body — pass as args or via stdin\n');
        process.exit(1);
      }
      const payload: Record<string, unknown> = {
        author: opts.author ?? cfg.agent,
        body,
        kind: opts.kind ?? 'note',
      };
      if (opts.criterion) payload.criterionId = opts.criterion;
      try {
        const { data } = await apiRequest<{ comment: Comment; mentionCount?: number }>(
          cfg.apiUrl,
          'POST',
          `/api/v1/work-items/${id}/comments`,
          payload,
        );
        process.stdout.write(
          `${data?.comment.id}${data?.mentionCount ? `\tmentions=${data.mentionCount}` : ''}\n`,
        );
      } catch (err) {
        handleApiError(err);
      }
    },
  );

// pc file <type> <title> [description]   (stdin used if description omitted)
program
  .command('file <type> <title> [description...]')
  .description('Create a work item. Description from args or stdin.')
  .option('--parent <id>', 'Parent work item id')
  .option('--label <label...>', 'Labels (repeatable)')
  .option('--project <id>', 'Override project id (else the API resolves from PC_PROJECT slug)')
  .action(
    async (
      type: string,
      title: string,
      descriptionParts: string[],
      opts: { parent?: string; label?: string[]; project?: string },
    ) => {
      const cfg = getGlobalOpts();
      let description = descriptionParts.join(' ').trim();
      if (!description) description = readStdinSync().trim();

      // Resolve projectId: option takes precedence, else look up by slug via the API.
      let projectId = opts.project;
      if (!projectId) {
        if (!cfg.project) {
          process.stderr.write(
            'No project specified — pass --project <id> or set PC_PROJECT to a project slug\n',
          );
          process.exit(1);
        }
        try {
          const lookup = await apiRequest<{ project: { id: string } }>(
            cfg.apiUrl,
            'GET',
            `/api/v1/projects/${cfg.project}`,
          );
          projectId = lookup.data?.project.id;
        } catch (err) {
          handleApiError(err);
        }
      }

      const payload: Record<string, unknown> = { projectId, type, title };
      if (description) payload.description = description;
      if (opts.parent) payload.parentId = opts.parent;
      if (opts.label?.length) payload.labels = opts.label;

      try {
        const { data } = await apiRequest<{ workItem: WorkItemSummary }>(
          cfg.apiUrl,
          'POST',
          '/api/v1/work-items',
          payload,
        );
        process.stdout.write(`${data?.workItem.id}\n`);
      } catch (err) {
        handleApiError(err);
      }
    },
  );

// pc ask <id> <message...>    [--wait <seconds>]
program
  .command('ask <id> [message...]')
  .description('File a HITL question on a work item. Use --wait to block until answered.')
  .option('--asked-by <name>', 'Override askedBy (defaults to PC_AGENT)')
  .option('--addressed-to <handle>', 'Specific recipient handle')
  .option('--wait <seconds>', 'Block until answered or timeout', (s) => Number.parseInt(s, 10))
  .action(
    async (
      id: string,
      messageParts: string[],
      opts: { askedBy?: string; addressedTo?: string; wait?: number },
    ) => {
      const cfg = getGlobalOpts();
      let body = messageParts.join(' ').trim();
      if (!body) body = readStdinSync().trim();
      if (!body) {
        process.stderr.write('No question body\n');
        process.exit(1);
      }
      const askedBy = opts.askedBy ?? cfg.agent;
      try {
        const { data } = await apiRequest<{ question: Question }>(
          cfg.apiUrl,
          'POST',
          `/api/v1/work-items/${id}/questions`,
          {
            askedBy,
            body,
            ...(opts.addressedTo ? { addressedTo: opts.addressedTo } : {}),
          },
        );
        const questionId = data?.question.id;
        if (!questionId) {
          process.stderr.write('Question created but no id returned\n');
          process.exit(1);
        }
        if (typeof opts.wait !== 'number' || opts.wait <= 0) {
          process.stdout.write(`${questionId}\n`);
          return;
        }
        const deadline = Date.now() + opts.wait * 1000;
        while (Date.now() < deadline) {
          await new Promise((r) => setTimeout(r, Math.min(2000, deadline - Date.now())));
          const poll = await apiRequest<{ workItem: WorkItemSummary }>(
            cfg.apiUrl,
            'GET',
            `/api/v1/work-items/${id}`,
          );
          void poll;
          // Inspect the per-item questions for status
          const list = await apiRequest<{ questions: Question[] }>(
            cfg.apiUrl,
            'GET',
            `/api/v1/work-items/${id}/questions`,
          );
          const found = list.data?.questions.find((q) => q.id === questionId);
          if (found && found.status === 'answered' && found.answerId) {
            const comments = await apiRequest<{ comments: Comment[] }>(
              cfg.apiUrl,
              'GET',
              `/api/v1/work-items/${id}/comments`,
            );
            const answer = comments.data?.comments.find((c) => c.id === found.answerId);
            if (answer) {
              process.stdout.write(`${answer.body}\n`);
              return;
            }
          }
        }
        process.stderr.write(`Timeout waiting ${opts.wait}s for answer\n`);
        process.exit(4);
      } catch (err) {
        handleApiError(err);
      }
    },
  );

// pc check-answer <question-id> <work-item-id>
program
  .command('check-answer <question-id> <work-item-id>')
  .description('Print the answer body and exit 0; exit 5 if still unanswered.')
  .action(async (qid: string, wid: string) => {
    const cfg = getGlobalOpts();
    try {
      const list = await apiRequest<{ questions: Question[] }>(
        cfg.apiUrl,
        'GET',
        `/api/v1/work-items/${wid}/questions`,
      );
      const found = list.data?.questions.find((q) => q.id === qid);
      if (!found) {
        process.stderr.write('Question not found on that work item\n');
        process.exit(1);
      }
      if (found.status !== 'answered' || !found.answerId) {
        process.exit(5);
      }
      const comments = await apiRequest<{ comments: Comment[] }>(
        cfg.apiUrl,
        'GET',
        `/api/v1/work-items/${wid}/comments`,
      );
      const answer = comments.data?.comments.find((c) => c.id === found.answerId);
      if (!answer) {
        process.stderr.write('Answer comment not found\n');
        process.exit(1);
      }
      process.stdout.write(`${answer.body}\n`);
    } catch (err) {
      handleApiError(err);
    }
  });

program.parseAsync().catch((err: unknown) => handleApiError(err));
