import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../../context/AuthContext';
import { ProtectedRoute } from './ProtectedRoute';
import { TOKEN_KEY } from '../../api/client';

function Harness({ initialPath = '/protected' }: { initialPath?: string }) {
  return (
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<div>login page</div>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/protected" element={<div>secret content</div>} />
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('<ProtectedRoute />', () => {
  beforeEach(() => {
    localStorage.removeItem(TOKEN_KEY);
  });

  it('redirects to /login when no token is set', () => {
    render(<Harness />);
    expect(screen.getByText('login page')).toBeInTheDocument();
  });

  it.todo('renders children when authenticated');
});
