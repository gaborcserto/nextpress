"use client";

import { useSearchParams } from "next/navigation";

import { ResetPasswordForm } from "@/features/auth/ResetPasswordForm";

export default function ResetPasswordPage() {
  const sp = useSearchParams();
  const token = sp.get("token") ?? "";

  return <ResetPasswordForm token={token} />;
}
