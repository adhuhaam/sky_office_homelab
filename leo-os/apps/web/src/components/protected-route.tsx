import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, networkError, refreshing, refresh } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && !networkError && !user) {
      setLocation("/login");
    }
  }, [loading, networkError, user, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-app-shell">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (networkError) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-app-shell px-4">
        <div className="max-w-sm rounded-xl border border-card-border bg-card p-6 text-center shadow">
          <AlertTriangle className="mx-auto h-8 w-8 text-amber-500" />
          <h2 className="mt-3 text-base font-semibold">Couldn’t reach the server</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Check your connection and try again.
          </p>
          <Button className="mt-4" onClick={() => void refresh()} disabled={refreshing}>
            {refreshing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}

export function RoleRoute({
  roles,
  children,
}: {
  roles: string[];
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (user && user.role && !roles.includes(user.role)) {
      setLocation("/");
    }
  }, [user, roles, setLocation]);

  if (!user?.role || !roles.includes(user.role)) {
    return (
      <div className="p-8">
        <p className="text-red-400">You do not have permission to view this page.</p>
      </div>
    );
  }

  return <>{children}</>;
}
