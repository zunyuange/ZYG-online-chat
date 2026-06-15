/**
 * Main Application Component
 * Handles routing between Todo, Chat, and Staff pages
 */

import { useState, useEffect } from 'react';
import { useTodoStore } from './stores/todoStore';
import type { Todo } from '@shared/types';
import { ChatPage } from './pages/ChatPage';
import { StaffPage } from './pages/StaffPage';

type Page = 'todo' | 'chat' | 'staff';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>(() => {
    // Determine initial page based on URL path
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (path === '/staff') return 'staff';
      if (path === '/chat' || path === '/') return 'chat';
    }
    return 'chat';
  });

  const todos = useTodoStore((state) => state.todos);
  const loading = useTodoStore((state) => state.loading);
  const error = useTodoStore((state) => state.error);
  const { fetchTodos, createTodo, updateTodo, deleteTodo } = useTodoStore();

  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [newTodoDescription, setNewTodoDescription] = useState('');

  // Load todos on mount when on todo page
  useEffect(() => {
    if (currentPage === 'todo') {
      fetchTodos();
    }
  }, [currentPage, fetchTodos]);

  // Update URL when page changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const path = currentPage === 'todo' ? '/todo' : currentPage === 'staff' ? '/staff' : '/chat';
      window.history.pushState({}, '', path);
    }
  }, [currentPage]);

  // Handle browser back/forward
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path === '/staff') setCurrentPage('staff');
      else if (path === '/todo') setCurrentPage('todo');
      else setCurrentPage('chat');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodoTitle.trim()) return;

    await createTodo({
      title: newTodoTitle,
      description: newTodoDescription || undefined,
    });

    setNewTodoTitle('');
    setNewTodoDescription('');
  };

  const handleStatusChange = async (todo: Todo, status: Todo['status']) => {
    await updateTodo(todo.id, { status });
  };

  const handleDelete = async (id: number) => {
    await deleteTodo(id);
  };

  // Navigation header styles (only for todo page)
  const navStyle: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
    padding: '8px 16px',
    backgroundColor: '#001529',
    marginBottom: '16px',
  };

  const navButtonStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 16px',
    backgroundColor: active ? '#1890ff' : 'transparent',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
  });

  // Render Chat or Staff page directly without navigation (full-page layouts)
  if (currentPage === 'chat') {
    return <ChatPage />;
  }

  if (currentPage === 'staff') {
    return <StaffPage />;
  }

  // Render Todo page
  return (
    <>
      <nav style={navStyle}>
        <button style={navButtonStyle(true)} onClick={() => setCurrentPage('todo')}>
          Todo
        </button>
      </nav>
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 2rem' }}>
        <h1>Todo List</h1>

        {/* Create Form */}
        <form onSubmit={handleCreate} style={{ marginBottom: '2rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <input
              type="text"
              value={newTodoTitle}
              onChange={(e) => setNewTodoTitle(e.target.value)}
              placeholder="Todo title..."
              style={{
                width: '100%',
                padding: '0.5rem',
                fontSize: '1rem',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <textarea
              value={newTodoDescription}
              onChange={(e) => setNewTodoDescription(e.target.value)}
              placeholder="Description (optional)..."
              style={{
                width: '100%',
                padding: '0.5rem',
                fontSize: '1rem',
                boxSizing: 'border-box',
                minHeight: '80px',
              }}
            />
          </div>
          <button
            type="submit"
            disabled={!newTodoTitle.trim() || loading}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '1rem',
              cursor: 'pointer',
            }}
          >
            Add Todo
          </button>
        </form>

        {/* Error Message */}
        {error && (
          <div style={{ color: 'red', marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading && <div>Loading...</div>}

        {/* Todo List */}
        <div>
          {todos.map((todo) => (
            <div
              key={todo.id}
              style={{
                border: '1px solid #ddd',
                borderRadius: '4px',
                padding: '1rem',
                marginBottom: '1rem',
              }}
            >
              <h3>{todo.title}</h3>
              {todo.description && <p>{todo.description}</p>}
              <div style={{ marginTop: '0.5rem' }}>
                <select
                  value={todo.status}
                  onChange={(e) =>
                    handleStatusChange(todo, e.target.value as Todo['status'])
                  }
                  style={{ marginRight: '1rem' }}
                >
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
                <button
                  onClick={() => handleDelete(todo.id)}
                  style={{ padding: '0.25rem 0.5rem' }}
                >
                  Delete
                </button>
              </div>
              <small>
                Created: {new Date(todo.createdAt).toLocaleString()}
              </small>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {!loading && todos.length === 0 && (
          <p style={{ color: '#666' }}>No todos yet. Add one above!</p>
        )}
      </div>
    </>
  );
}

export default App;
