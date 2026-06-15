# Design Document

## Architecture Overview

This template implements a **monorepo-style architecture** with client/server separation while maintaining a single development port.

### Key Design Decisions

#### 1. Single-Port Development
- **Why**: Simplifies local development, no CORS issues
- **How**: `@hono/vite-dev-server` serves both React and Hono
- **Benefit**: Developer experience, type safety across boundary

#### 2. Hono RPC
- **Why**: End-to-end type safety between frontend and backend
- **How**: Shared types exported from `src/server/index.ts`
- **Benefit**: Compile-time error detection, better DX

#### 3. Modular Backend
- **Why**: Scalability, clear separation of concerns
- **How**: Feature-based modules (`module-todos/`, `module-users/`, etc.)
- **Benefit**: Easy to add new features, maintainable codebase

#### 4. Zustand for State
- **Why**: Minimal boilerplate, no context provider hell
- **How**: Global store with selector hooks
- **Benefit**: Performance (minimal re-renders), simplicity

## Module Pattern

Each backend module follows this structure:

```
module-{feature}/
├── routes/         # API endpoints (Hono RPC)
├── services/       # Business logic
└── __tests__/      # Unit tests
```

### Example: Adding a New Module

1. Create directory: `src/server/module-users/`
2. Add routes: `src/server/module-users/routes/users-routes.ts`
3. Add service: `src/server/module-users/services/user-service.ts`
4. Add tests: `src/server/module-users/__tests__/user-service.test.ts`
5. Register in `src/server/index.ts`:

```typescript
import { userRoutes } from './module-users/routes/users-routes';
app.route('/api', userRoutes);
```

## Testing Strategy

### Unit Tests
- Location: `src/**/__tests__/*.test.ts`
- Framework: Vitest
- Environment: `jsdom` (client), `node` (server)
- Coverage: Services, stores, utilities

### Integration Tests
- Location: `src/server/integration/*.test.ts`
- Framework: Vitest
- Environment: `node`
- Coverage: API endpoints

### E2E Tests
- Location: `src/client/e2e/*.spec.ts`
- Framework: Playwright
- Environment: Browser
- Coverage: User workflows

## Type Safety Flow

```
┌─────────────────┐
│  Server Routes  │ ──export──> AppType
└─────────────────┘                          │
                                             │
┌─────────────────┐                          ▼
│  RPC Client     │ <──import── AppType
│  (Frontend)     │
└─────────────────┘
```

1. Define routes in server (`src/server/index.ts`)
2. Export `AppType` from server
3. Import in RPC client (`src/shared/rpc-server.ts`)
4. Use in frontend with full type safety

## Database Schema

Using Drizzle ORM with SQLite:

```typescript
export const todos = sqliteTable('todos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').notNull().default('pending'),
  createdAt: integer('created_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});
```

## Performance Considerations

### Frontend
- **Selector Hooks**: Use precise selectors to minimize re-renders
- **Code Splitting**: Lazy load routes/components
- **Bundle Size**: Tree-shaking with Vite

### Backend
- **Connection Pooling**: Reuse database connections
- **Query Optimization**: Index frequently queried columns
- **Caching**: Consider Redis for production

## Security Best Practices

1. **Input Validation**: Zod schemas on all endpoints
2. **SQL Injection**: Drizzle ORM parameterized queries
3. **CORS**: Whitelist origins in production
4. **Environment Variables**: Never commit `.env` files
5. **Error Messages**: Don't leak sensitive info

## Migration Path

### From Mock to Real Backend
1. Set `USE_MOCK_SERVER = false` in `apiClient.ts`
2. Configure production API base URL
3. Deploy backend separately
4. Update CORS configuration

### From SQLite to PostgreSQL
1. Update `drizzle.config.ts`
2. Change `sqliteTable` to `pgTable`
3. Update column types
4. Run `drizzle-kit push`
