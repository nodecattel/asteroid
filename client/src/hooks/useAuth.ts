import { useQuery } from "@tanstack/react-query";

interface AuthStatus {
  authenticated: boolean;
}

export function useAuth() {
  const { data, isLoading } = useQuery<AuthStatus>({
    queryKey: ["/api/auth/status"],
    retry: false,
    refetchOnWindowFocus: true,
  });

  return {
    isAuthenticated: data?.authenticated ?? false,
    isLoading,
  };
}
