import { create } from "zustand";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

type AuthState = {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const LOGIN_FAILED_ERROR = "Login failed";

export const useAuth = create<AuthState>()((set) => ({
  user: null,
  isLoading: false,
  error: null,
  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || LOGIN_FAILED_ERROR);
      }

      const data = await response.json();
      set({ user: data.user, isLoading: false, error: null });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : LOGIN_FAILED_ERROR,
        isLoading: false,
      });
      throw error;
    }
  },
  logout: async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      set({ user: null, isLoading: false, error: null });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Logout failed",
        isLoading: false,
      });
      throw error;
    }
  },
}));
