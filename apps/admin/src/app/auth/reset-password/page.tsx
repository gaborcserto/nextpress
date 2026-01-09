"use client";

import { useSearchParams } from "next/navigation";

import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export default function ResetPasswordPage() {
  const sp = useSearchParams();
  const token = sp.get("token") ?? "";

  return (
    <ResetPasswordForm token={token} />
  );
}
