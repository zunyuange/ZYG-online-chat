# Project Rules

## Environment Variables

All environment variables must be defined in:

1. `.env.example` - Template file (committed to Git)
2. Actual `.env` file (not committed)

Required variables:

```bash
API_BASE_URL=http://localhost:3010
```

## Path Aliases

Use path aliases instead of relative imports:

```typescript
// ✅ Good
import { Todo } from '@shared/types';
import { useTodoStore } from '@client/stores/todoStore';

// ❌ Bad
import { Todo } from '../../../shared/types';
```

## Module Structure

Each backend module follows this pattern:

```
module-{feature}/
├── routes/         # API endpoints
├── services/       # Business logic
└── __tests__/      # Unit tests
```

## Testing

- Unit tests: `__tests__/*.test.ts`
- Integration tests: `src/server/integration/*.test.ts`
- Always test services and routes
- Aim for >80% coverage

## Code Style

- Use Prettier for formatting
- Follow ESLint rules
- No console.log in production code
- Use TypeScript strict mode
