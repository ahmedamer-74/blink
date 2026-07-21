import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = {
  title: "Create Account",
  description:
    "Create a free Blink account to start chatting with friends and groups in real time.",
};

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <RegisterForm />
    </main>
  );
}
