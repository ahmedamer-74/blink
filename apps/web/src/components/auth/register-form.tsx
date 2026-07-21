"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { registerAction } from "@/lib/actions/auth";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

type FormState = { error: string } | { success: true; accessToken: string; user: { id: string; email: string; username: string; role: string } };

const initialState: FormState = { error: "" };

export function RegisterForm() {
  const router = useRouter();
  const { setAuth } = useAuth();
  const [state, formAction, isPending] = useActionState<FormState, FormData>(
    async (_prev, formData) => {
      const result = await registerAction(null, formData);
      return result;
    },
    initialState,
  );

  useEffect(() => {
    if (state && "success" in state) {
      setAuth(state.user, state.accessToken);
      router.push("/chat");
    }
  }, [state, setAuth, router]);

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="mb-6 text-center">
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: "var(--accent)" }}>
          Blink
        </h1>
      </div>
      <Card>
        <CardHeader className="text-center px-4 sm:px-6 pt-6 pb-2">
          <CardTitle className="text-xl sm:text-2xl">Create an account</CardTitle>
          <CardDescription>Enter your details to get started</CardDescription>
        </CardHeader>
      <form action={formAction}>
        <CardContent className="space-y-4 px-4 sm:px-6">
          {state && "error" in state && state.error && (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-red-400">
              {state.error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              name="username"
              placeholder="johndoe"
              required
              autoComplete="username"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4 px-4 sm:px-6 pb-6">
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Creating account..." : "Create account"}
          </Button>
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary underline-offset-4 hover:underline">
              Sign in
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
    </div>
  );
}
