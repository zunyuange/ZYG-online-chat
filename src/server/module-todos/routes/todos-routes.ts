/**
 * Todo API routes using Hono RPC
 * Type-safe API endpoints with Zod validation
 *
 * CRITICAL: Uses CHAIN SYNTAX for proper Hono RPC type inference
 */

import { createRoute, z } from '@hono/zod-openapi';
import { OpenAPIHono } from '@hono/zod-openapi';
import * as todoService from '../services/todo-service';

// Schemas
const TodoSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  status: z.enum(['pending', 'in_progress', 'completed']),
  createdAt: z.date(),
  updatedAt: z.date(),
});

const CreateTodoSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
});

const UpdateTodoSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  status: z.enum(['pending', 'in_progress', 'completed']).optional(),
});

const ErrorResponseSchema = z.object({
  success: z.boolean().optional(),
  error: z.string().optional(),
});

// Define routes
const listRoute = createRoute({
  method: 'get',
  path: '/todos',
  tags: ['todos'],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.array(TodoSchema),
          }),
        },
      },
      description: 'List all todos',
    },
  },
});

const getRoute = createRoute({
  method: 'get',
  path: '/todos/{id}',
  tags: ['todos'],
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: TodoSchema,
          }),
        },
      },
      description: 'Get a todo by ID',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Todo not found',
    },
  },
});

const createRouteDef = createRoute({
  method: 'post',
  path: '/todos',
  tags: ['todos'],
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateTodoSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: TodoSchema,
          }),
        },
      },
      description: 'Create a new todo',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Invalid input',
    },
  },
});

const updateRoute = createRoute({
  method: 'put',
  path: '/todos/{id}',
  tags: ['todos'],
  request: {
    params: z.object({
      id: z.string(),
    }),
    body: {
      content: {
        'application/json': {
          schema: UpdateTodoSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: TodoSchema,
          }),
        },
      },
      description: 'Update a todo',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Todo not found',
    },
  },
});

const deleteRoute = createRoute({
  method: 'delete',
  path: '/todos/{id}',
  tags: ['todos'],
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              id: z.number(),
            }),
          }),
        },
      },
      description: 'Delete a todo',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Todo not found',
    },
  },
});

// Register routes using CHAIN SYNTAX for proper Hono RPC type inference
export const apiRoutes = new OpenAPIHono()
  .openapi(listRoute, async (c) => {
    const todos = await todoService.listTodos();
    return c.json({ success: true, data: todos });
  })
  .openapi(getRoute, async (c) => {
    const id = parseInt(c.req.param('id'));
    const todo = await todoService.getTodo(id);
    if (!todo) {
      return c.json({ success: false, error: 'Todo not found' }, 404);
    }
    return c.json({ success: true, data: todo });
  })
  .openapi(createRouteDef, async (c) => {
    const data = c.req.valid('json');
    const todo = await todoService.createTodo(data);
    return c.json({ success: true, data: todo }, 201);
  })
  .openapi(updateRoute, async (c) => {
    const id = parseInt(c.req.param('id'));
    const data = c.req.valid('json');
    const todo = await todoService.updateTodo(id, data);
    if (!todo) {
      return c.json({ success: false, error: 'Todo not found' }, 404);
    }
    return c.json({ success: true, data: todo });
  })
  .openapi(deleteRoute, async (c) => {
    const id = parseInt(c.req.param('id'));
    const result = await todoService.deleteTodo(id);
    if (!result) {
      return c.json({ success: false, error: 'Todo not found' }, 404);
    }
    return c.json({ success: true, data: { id } });
  })
  .doc('/docs', {
    openapi: '3.0.0',
    info: {
      version: '1.0.0',
      title: 'Todo API',
    },
  });
