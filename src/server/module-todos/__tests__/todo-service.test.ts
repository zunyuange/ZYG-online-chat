/**
 * Unit tests for Todo service
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../../shared/db';
import { todos } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import * as todoService from '../services/todo-service';

describe('Todo Service', () => {
  beforeEach(async () => {
    // Clean up database before each test
    await db.delete(todos);
  });

  afterEach(async () => {
    // Clean up after each test
    await db.delete(todos);
  });

  describe('listTodos', () => {
    it('should return empty array when no todos exist', async () => {
      const result = await todoService.listTodos();
      expect(result).toEqual([]);
    });

    it('should return all todos', async () => {
      // Create test todos
      await db.insert(todos).values([
        { title: 'Todo 1', status: 'pending', createdAt: new Date(), updatedAt: new Date() },
        { title: 'Todo 2', status: 'completed', createdAt: new Date(), updatedAt: new Date() },
      ]);

      const result = await todoService.listTodos();
      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Todo 1');
      expect(result[1].title).toBe('Todo 2');
    });
  });

  describe('getTodo', () => {
    it('should return null for non-existent todo', async () => {
      const result = await todoService.getTodo(999);
      expect(result).toBeNull();
    });

    it('should return todo by id', async () => {
      const [newTodo] = await db.insert(todos).values({
        title: 'Test Todo',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();

      const result = await todoService.getTodo(newTodo.id);
      expect(result).not.toBeNull();
      expect(result?.title).toBe('Test Todo');
    });
  });

  describe('createTodo', () => {
    it('should create a new todo', async () => {
      const input = {
        title: 'New Todo',
        description: 'Test description',
      };

      const result = await todoService.createTodo(input);

      expect(result.id).toBeDefined();
      expect(result.title).toBe(input.title);
      expect(result.description).toBe(input.description);
      expect(result.status).toBe('pending');
    });

    it('should create todo without description', async () => {
      const input = {
        title: 'Todo without description',
      };

      const result = await todoService.createTodo(input);

      expect(result.title).toBe(input.title);
      expect(result.description).toBeNull();
    });
  });

  describe('updateTodo', () => {
    it('should update todo', async () => {
      const [newTodo] = await db.insert(todos).values({
        title: 'Original Title',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();

      const updates = {
        title: 'Updated Title',
        status: 'completed' as const,
      };

      const result = await todoService.updateTodo(newTodo.id, updates);

      expect(result).not.toBeNull();
      expect(result?.title).toBe(updates.title);
      expect(result?.status).toBe(updates.status);
    });

    it('should return null for non-existent todo', async () => {
      const result = await todoService.updateTodo(999, { title: 'Updated' });
      expect(result).toBeNull();
    });
  });

  describe('deleteTodo', () => {
    it('should delete todo', async () => {
      const [newTodo] = await db.insert(todos).values({
        title: 'To Delete',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();

      const result = await todoService.deleteTodo(newTodo.id);

      expect(result).toBe(true);

      // Verify deletion
      const deleted = await db.select().from(todos).where(eq(todos.id, newTodo.id));
      expect(deleted).toHaveLength(0);
    });

    it('should return false for non-existent todo', async () => {
      const result = await todoService.deleteTodo(999);
      expect(result).toBe(false);
    });
  });
});
