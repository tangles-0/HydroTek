"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signIn, useSession } from "next-auth/react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const { data: session } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (session?.user?.id) {
    redirect("/dashboard");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      setError("Invalid email or password");
      return;
    }
    redirect("/dashboard");
  }

  return (
    <div className="min-h-[75vh] grid place-items-center">
      <div className="surface-card w-full max-w-md p-6 sm:p-8">
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">HydroTek</p>
        <h1 className="text-2xl font-semibold mb-1">Sign in</h1>
        <p className="text-sm text-muted-foreground mb-6">Access your device telemetry and controls.</p>
        <form onSubmit={onSubmit} className="space-y-4">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            required
          />
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>
        <p className="text-sm mt-5 text-muted-foreground">
          No account yet?{" "}
          <Link href="/register" className="underline underline-offset-4">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
