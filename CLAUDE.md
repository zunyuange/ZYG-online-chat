# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Todo Application Template - A full-stack React + Hono application demonstrating best practices for monorepo-style architecture with single-port development.

## Commands

```bash
npm run dev          # Start Vite dev server on port 3010 with Hono backend
npm run build        # Production build
npm run preview      # Preview production build
npm run test         # Run all Vitest tests
npm run test:unit    # Run unit tests only
npm run test:integration  # Run integration tests only
npm run lint         # Run ESLint
npm run format       # Run Prettier format
```

## Architecture Overview

**Monorepo-style structure** with client/server separation and shared types:

```
src/
├── client/          # React frontend
│   ├── components/  # UI components
│   ├── stores/      # Zustand state management
│   ├── services/    # API clients
│   ├── test/        # Test setup
│   └── App.tsx
├── server/          # Hono backend
│   ├── module-todos/ # Todo module
│   │   ├── routes/
│   │   ├── services/
│   │   └── __tests__/
│   ├── shared/      # Database configuration
│   ├── integration/ # Integration tests
│   └── index.ts
└── shared/          # Shared types
    ├── types.ts
    ├── rpc-server.ts
    └── schemas.ts
```

**Path Aliases** (configured in vite.config.ts and tsconfig.json):

- `@shared/*` → src/shared/*
- `@client/*` → src/client/*
- `@server/*` → src/server/*

## Key Technical Concepts

### Single-Port Development

Uses `@hono/vite-dev-server` to run both frontend and backend on port 3010:

- No CORS issues in development
- Type safety across the boundary
- Simplified developer experience

### Hono RPC

Type-safe API calls from frontend to backend:

```typescript
import { rpcClient } from '@shared/rpc-server';

// Fully typed API call
const response = await rpcClient.api.todos.$get();
const result = await response.json();
```

### Module Pattern

Backend organized by feature modules:

```
module-{feature}/
├── routes/         # API endpoints (Hono RPC)
├── services/       # Business logic
└── __tests__/      # Unit tests
```

### State Management with Zustand

Global application state in `src/client/stores/todoStore.ts`:

- **Minimal Re-renders**: Use precise selector hooks
- **Selector Pattern**: `const todos = useTodoStore((state) => state.todos)`
- **Action Selectors**: Stable function references

### Testing Strategy

- **Unit Tests**: `__tests__/*.test.ts` (jsdom for client, node for server)
- **Integration Tests**: `src/server/integration/*.test.ts`
- **Frameworks**: Vitest + @testing-library/react

## Important Conventions

### Import Path Aliases

Always use path aliases instead of relative imports:

```typescript
import { Todo } from '@shared/types';
import { useTodoStore } from '@client/stores/todoStore';
```

### Environment Variables

Required variables (see `.env.example`):

```bash
API_BASE_URL=http://localhost:3010
```

### Module Creation

To add a new feature module:

1. Create `src/server/module-{feature}/`
2. Add routes, services, tests
3. Register in `src/server/index.ts`
4. Add client store if needed
5. Add integration tests

### API Route Pattern

Use Hono RPC with chain syntax:

```typescript
app.openapi(listRoute, async (c) => {
  const todos = await todoService.listTodos();
  return c.json({ success: true, data: todos });
});
```

## Project Rules

See `.claude/rules/` for detailed development constraints:

- `project_rules.md` - Environment & constants management
- `client-component-rules.md` - React component patterns
- `client-service-rules.md` - Service layer patterns
- `client-store-rules.md` - Zustand store patterns
- `server-rules.md` - Server-side patterns
- `testing-standards.md` - Testing conventions

## Documentation

- `README.md` - User-facing feature overview
- `DESIGN.md` - Technical architecture
