import { useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { AlertCircle, CheckCircle2, Loader2, UserPlus } from "lucide-react";
import { AuthLayout } from "@/components/auth-layout";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";

export function RegisterPage() {
  const { register } = useAuth();
  const [, setLocation] = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name || !email || !password) return;
    setLoading(true);
    setError(null);
    try {
      await register(name, email, password);
      setSuccess(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError("An account with this email already exists.");
      } else {
        setError(err instanceof ApiError ? err.message : "Registration failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <AuthLayout
        title="Account requested"
        description="Your request has been submitted."
        icon={<CheckCircle2 className="h-4 w-4 text-primary" />}
      >
        <p className="text-sm text-muted-foreground text-center">
          Your account is pending admin approval. You&apos;ll be able to sign in once an
          administrator approves it.
        </p>
        <Button variant="outline" className="mt-5 w-full" onClick={() => setLocation("/login")}>
          Back to sign in
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create account"
      description="Request access — admin approval required."
      icon={<UserPlus className="h-4 w-4 text-primary" />}
      footer={
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline font-medium">
            Sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Full name</Label>
          <Input
            id="name"
            type="text"
            autoFocus
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            disabled={loading}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            disabled={loading}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            disabled={loading}
            minLength={6}
          />
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button type="submit" className="w-full" disabled={loading || !name || !email || !password}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Requesting access…
            </>
          ) : (
            "Request access"
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
