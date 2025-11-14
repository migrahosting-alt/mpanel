/**
 * AuthContext Tests
 * Tests authentication context provider, login, logout, and auth state
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { renderHook, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from '../context/AuthContext';
import * as apiClient from '../lib/apiClient';

// Mock apiClient
vi.mock('../lib/apiClient');

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('AuthProvider initialization', () => {
    it('should initialize with no user when no token in localStorage', () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.loading).toBe(false);
    });

    it('should check token on mount if token exists', async () => {
      localStorage.setItem('token', 'fake-token');
      const mockUser = { id: 1, email: 'test@example.com', name: 'Test User' };
      
      vi.mocked(apiClient.get).mockResolvedValueOnce(mockUser);

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
        expect(result.current.isAuthenticated).toBe(true);
      });
    });
  });

  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      const mockResponse = {
        token: 'new-token',
        user: { id: 1, email: 'test@example.com', name: 'Test User' },
      };

      vi.mocked(apiClient.post).mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await act(async () => {
        await result.current.login('test@example.com', 'password123');
      });

      expect(result.current.user).toEqual(mockResponse.user);
      expect(result.current.isAuthenticated).toBe(true);
      expect(localStorage.getItem('token')).toBe('new-token');
    });

    it('should handle login failure', async () => {
      vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('Invalid credentials'));

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await expect(
        act(async () => {
          await result.current.login('test@example.com', 'wrongpassword');
        })
      ).rejects.toThrow('Invalid credentials');

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(localStorage.getItem('token')).toBeNull();
    });

    it('should set loading state during login', async () => {
      let resolveLogin: (value: any) => void;
      const loginPromise = new Promise((resolve) => {
        resolveLogin = resolve;
      });

      vi.mocked(apiClient.post).mockReturnValueOnce(loginPromise as any);

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      const loginAction = act(async () => {
        await result.current.login('test@example.com', 'password123');
      });

      // Should be loading immediately
      expect(result.current.loading).toBe(true);

      // Resolve the login
      resolveLogin!({
        token: 'token',
        user: { id: 1, email: 'test@example.com' },
      });

      await loginAction;

      expect(result.current.loading).toBe(false);
    });
  });

  describe('logout', () => {
    it('should successfully logout', async () => {
      localStorage.setItem('token', 'fake-token');
      const mockUser = { id: 1, email: 'test@example.com', name: 'Test User' };
      
      vi.mocked(apiClient.get).mockResolvedValueOnce(mockUser);

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      // Wait for initial user load
      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      // Logout
      act(() => {
        result.current.logout();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(localStorage.getItem('token')).toBeNull();
    });

    it('should clear token from localStorage on logout', () => {
      localStorage.setItem('token', 'fake-token');

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      act(() => {
        result.current.logout();
      });

      expect(localStorage.getItem('token')).toBeNull();
    });
  });

  describe('checkAuth', () => {
    it('should verify valid token', async () => {
      const mockUser = { id: 1, email: 'test@example.com', name: 'Test User' };
      localStorage.setItem('token', 'valid-token');
      
      vi.mocked(apiClient.get).mockResolvedValueOnce(mockUser);

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
        expect(result.current.isAuthenticated).toBe(true);
      });
    });

    it('should logout on invalid token', async () => {
      localStorage.setItem('token', 'invalid-token');
      
      vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('Unauthorized'));

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.user).toBeNull();
        expect(result.current.isAuthenticated).toBe(false);
        expect(localStorage.getItem('token')).toBeNull();
      });
    });
  });

  describe('updateUser', () => {
    it('should update user data', async () => {
      const initialUser = { id: 1, email: 'test@example.com', name: 'Test User' };
      const updatedUser = { id: 1, email: 'test@example.com', name: 'Updated Name' };
      
      localStorage.setItem('token', 'fake-token');
      vi.mocked(apiClient.get).mockResolvedValueOnce(initialUser);

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.user).toEqual(initialUser);
      });

      act(() => {
        result.current.updateUser(updatedUser);
      });

      expect(result.current.user).toEqual(updatedUser);
    });
  });
});
