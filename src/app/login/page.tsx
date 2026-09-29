import { Suspense } from "react";
import { LoginForm } from "@/features/auth";

export default function LogInPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-grad-dark" />}>
      <LoginForm />
    </Suspense>
  );
}
