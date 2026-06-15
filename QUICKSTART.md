# Quick Start Guide

## Prerequisites

- Node.js 18+
- npm or yarn

## Installation

```bash
# Install dependencies
npm install

# Setup pre-commit hooks (already done via husky install in package.json)
```

## Development

```bash
# Start development server (port 3010)
npm run dev

# The app will be available at http://localhost:3010
```

## Project Structure

```
template/
├── src/
│   ├── client/              # React frontend
│   │   ├── App.tsx         # Main component
│   │   ├── stores/         # Zustand state management
│   │   ├── services/       # API client
│   │   └── test/           # Test setup
│   ├── server/             # Hono backend
│   │   ├── module-todos/   # Todo feature module
│   │   ├── shared/         # Database config
│   │   ├── integration/    # Integration tests
│   │   └── index.ts        # Server entry
│   └── shared/             # Shared types
├── scripts/                # Validation scripts
├── .husky/                 # Git hooks
└── [config files]
```

## Key Files to Understand

1. **src/shared/types.ts** - Shared TypeScript types
2. **src/server/index.ts** - Hono server with RPC
3. **src/server/module-todos/routes/todos-routes.ts** - API endpoints
4. **src/client/App.tsx** - React UI component
5. **src/client/stores/todoStore.ts** - Zustand state management

## Testing

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run tests with coverage
npm test -- --coverage
```

## Adding a New Feature

### 1. Create Server Module

```bash
mkdir -p src/server/module-{feature}/routes
mkdir -p src/server/module-{feature}/services
mkdir -p src/server/module-{feature}/__tests__
```

### 2. Define Types

Add to `src/shared/types.ts`:
```typescript
export interface NewFeature {
  id: number;
  name: string;
}
```

### 3. Create Service

`src/server/module-{feature}/services/feature-service.ts`:
```typescript
export async function listFeatures() {
  // Business logic
}
```

### 4. Create Routes

`src/server/module-{feature}/routes/feature-routes.ts`:
```typescript
import { createRoute } from '@hono/zod-openapi';
import { OpenAPIHono } from '@hono/zod-openapi';

const app = new OpenAPIHono();

const listRoute = createRoute({
  method: 'get',
  path: '/features',
  // ... route definition
});

app.openapi(listRoute, async (c) => {
  const features = await featureService.listFeatures();
  return c.json({ success: true, data: features });
});

export const featureRoutes = app;
```

### 5. Register Routes

Add to `src/server/index.ts`:
```typescript
import { featureRoutes } from './module-features/routes/feature-routes';

app.route('/api', featureRoutes);
```

### 6. Create Client Store

`src/client/stores/featureStore.ts`:
```typescript
import { create } from 'zustand';
import { rpcClient } from '@shared/rpc-server';

export const useFeatureStore = create((set) => ({
  features: [],
  fetchFeatures: async () => {
    const response = await rpcClient.api.features.$get();
    const result = await response.json();
    set({ features: result.data });
  },
}));
```

### 7. Create UI Component

```typescript
import { useFeatureStore } from '@client/stores/featureStore';

export function FeatureList() {
  const features = useFeatureStore((state) => state.features);

  return (
    <div>
      {features.map((feature) => (
        <div key={feature.id}>{feature.name}</div>
      ))}
    </div>
  );
}
```

## Code Quality

```bash
# Format code
npm run format

# Lint code
npm run lint

# Run validation script
node --import tsx/esm scripts/validate-all.ts
```

## Pre-commit Hooks

The project uses Husky for Git hooks:

- **lint-staged**: Format staged files
- **npm test**: Run test suite
- **validate-all**: Custom validation

To skip hooks (not recommended):
```bash
git commit --no-verify -m "message"
```

## Troubleshooting

### Port Already in Use

```bash
# Kill process on port 3010
lsof -ti:3010 | xargs kill -9
```

### Database Errors

```bash
# Remove database and restart
rm -f data/todos.db
npm run dev
```

### Type Errors

```bash
# Clean and rebuild
rm -rf dist node_modules
npm install
npm run dev
```

## Next Steps

- Read `DESIGN.md` for architecture details
- Check `CLAUDE.md` for development guidelines
- Explore test files for examples
- Add your own features!
