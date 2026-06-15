/**
 * Unit tests for App component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../../App';

// Mock the todo store
vi.mock('../../stores/todoStore', () => ({
  useTodoStore: vi.fn(() => ({
    todos: [],
    loading: false,
    error: null,
    fetchTodos: vi.fn(),
    createTodo: vi.fn(),
    updateTodo: vi.fn(),
    deleteTodo: vi.fn(),
  })),
}));

describe('App Component', () => {
  it('should render title', () => {
    render(<App />);
    expect(screen.getByText('Todo List')).toBeInTheDocument();
  });

  it('should render create form', () => {
    render(<App />);
    expect(screen.getByPlaceholderText('Todo title...')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Description (optional)...')).toBeInTheDocument();
  });

  it('should render add todo button', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: /add todo/i })).toBeInTheDocument();
  });
});
