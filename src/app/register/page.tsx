import { Suspense } from "react";
import { RegisterForm } from "@/features/auth";

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-grad-dark" />}>
      <RegisterForm />
    </Suspense>
  );
}
