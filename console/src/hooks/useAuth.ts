import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { AuthTokens, User } from "@/types/api";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  setAuth: (tokens: AuthTokens) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setAuth: (tokens: AuthTokens) => {
        api.defaults.headers.common.Authorization = `Bearer ${tokens.access_token}`;
        set({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          user: tokens.user,
        });
      },
      clearAuth: () => {
        delete api.defaults.headers.common.Authorization;
        set({ accessToken: null, refreshToken: null, user: null });
      },
    }),
    {
      name: "conduit-auth",
      onRehydrateStorage: () => (state) => {
        if (state?.accessToken) {
          api.defaults.headers.common.Authorization = `Bearer ${state.accessToken}`;
        }
      },
    },
  ),
);

export function useLogin() {
  const { setAuth } = useAuthStore();
  return useMutation({
    mutationFn: async (data: { email: string; password: string }) => {
      const res = await api.post<AuthTokens>("/auth/login", data);
      return res.data;
    },
    onSuccess: (data) => setAuth(data),
  });
}

export function useRegister() {
  const { setAuth } = useAuthStore();
  return useMutation({
    mutationFn: async (data: {
      email: string;
      password: string;
      display_name: string;
    }) => {
      const res = await api.post<AuthTokens>("/auth/register", data);
      return res.data;
    },
    onSuccess: (data) => setAuth(data),
  });
}

export function useCurrentUser() {
  const { accessToken } = useAuthStore();
  return useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      const res = await api.get<User>("/auth/me");
      return res.data;
    },
    enabled: !!accessToken,
  });
}

export function useLogout() {
  const { clearAuth } = useAuthStore();
  const queryClient = useQueryClient();
  return () => {
    clearAuth();
    queryClient.clear();
  };
}
