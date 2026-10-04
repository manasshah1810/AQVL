# Agent rules for this repo

These rules apply to every AI coding agent working in this repository, including Claude Code, Antigravity, Gemini, Codex, Copilot, Cursor, and other coding agents.

## Agent permissions and precedence

- **All authorized AI coding agents have write authority in this repository.**
- Agents may inspect, create, modify, delete, rename, reorder, and regenerate project files when required to complete the user's requested task.
- Agents must follow the user's task requirements and preserve existing functionality unless a change is explicitly required.
- No specific AI coding agent has exclusive write authority.
- Claude Code, Antigravity, Gemini, Codex, Copilot, Cursor, and other authorized coding agents are treated equally for repository modification purposes.
- This file must not be interpreted as granting one specific agent exclusive control over the repository.

## Task progress

- The command center at `/tasks` reads `packages/demo/src/pages/tasks/ledger/ledger.jsonl`.
- Agents may update task state through the repository's normal task-management mechanisms when required by the user's request.
- Prefer the standard task-completion mechanism:

```bash
pnpm task done <id>
```

- Agents should not manually modify the task ledger when the normal task-management command can perform the required operation.
- Agents should preserve the integrity of the task ledger and its hash chain.
- Agents must not bypass repository safeguards merely for convenience.

## Maintainer-sensitive files

The following files and directories may contain repository infrastructure or task-management logic:

- `scripts/task-ledger.ts`
- `packages/demo/src/pages/tasks/{ledger,model,roadmapData,teamData,types}.ts`
- `.husky/`
- `.github/`
- `.claude/`
- `AGENTS.md`

These files are **not restricted to a particular AI agent**.

An agent may modify them when the user's requested task genuinely requires such a change. Changes should be minimal, intentional, and consistent with the repository's existing architecture.

## Repository safeguards

- Agents should use the repository's existing commands, hooks, tests, and validation mechanisms.
- Do not use `--no-verify`, disable hooks, change `core.hooksPath`, or otherwise bypass safeguards unless the task specifically requires it and there is a clear technical reason.
- If a safeguard fails, investigate and resolve the underlying issue rather than assuming that another AI agent is required.
- Do not disable CI, hooks, validation, or security mechanisms merely to make a task pass.

## Developer Gateway

- If the Developer Gateway at `/developer` is available to the executing agent, the agent may use it according to its available permissions and operations.
- Gateway operations should be used only for their intended repository/task-management purposes.
- Agents must not attempt to bypass gateway permissions or security controls.
- Gateway audit and validation mechanisms should be preserved.

## General agent behavior

- Inspect the relevant code before making changes.
- Make the smallest set of changes necessary to satisfy the user's request.
- Follow the repository's existing coding conventions and architecture.
- Run relevant tests, type checks, linting, or build checks after making changes when practical.
- Do not revert unrelated work already present in the working tree.
- Clearly report what was changed and any validation that was performed.

## Agent neutrality

No rule in this file grants exclusive authority to Claude Code or denies write authority to Antigravity, Gemini, Codex, Copilot, Cursor, or another authorized coding agent.

**Any authorized coding agent may modify the repository when required to fulfill the user's request.**
