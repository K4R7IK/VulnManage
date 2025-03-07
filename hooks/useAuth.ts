import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

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
  login: (
    email: string,
    password: string,
    rememberMe?: boolean,
  ) => Promise<void>;
  logout: () => Promise<void>;
};

const LOGIN_FAILED_ERROR = "Login failed";

// Ensure consistent behavior on server and client
const isServer = typeof window === "undefined";

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isLoading: false,
      error: null,
      login: async (email: string, password: string, rememberMe = false) => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ email, password, rememberMe }),
          });

          if (!response.ok) {
            const data = await response.json();
            throw new Error(data.message || LOGIN_FAILED_ERROR);
          }

          // Fetch the actual user data after successful login
          const userResponse = await fetch("/api/auth/user", {
            credentials: "include",
          });

          if (!userResponse.ok) {
            throw new Error("Failed to fetch user data");
          }

          const userData = await userResponse.json();
          set({ user: userData, isLoading: false, error: null });
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
    }),
    {
      name: "auth-storage",
      storage: isServer
        ? createJSONStorage(() => ({
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
          }))
        : createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);
