"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signIn, useSession } from "next-auth/react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { useState } from "react";

export default function RegisterPage() {
  const { data: session } = useSession();
  const [name, setName] = useState("");
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
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to register");
      setLoading(false);
      return;
    }
    await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    redirect("/dashboard");
  }

  return (
    <div className="min-h-[75vh] grid place-items-center">
      <div className="surface-card w-full max-w-md p-6 sm:p-8">
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">HydroTek</p>
        <h1 className="text-2xl font-semibold mb-1">Create account</h1>
        <p className="text-sm text-muted-foreground mb-6">Set up your dashboard in under a minute.</p>
        <form onSubmit={onSubmit} className="space-y-4">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
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
            placeholder="Password (min 8 chars)"
            required
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating..." : "Create account"}
          </Button>
        </form>
        <p className="text-sm mt-5 text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
