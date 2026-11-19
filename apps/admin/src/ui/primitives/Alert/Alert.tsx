"use client";

import {
  FaCheckCircle,
  FaExclamationCircle,
  FaExclamationTriangle,
  FaInfoCircle,
} from "react-icons/fa";

import type { AlertProps } from "@/ui/primitives/Alert/Alert.types";

export default function Alert({
  message,
  status = "info",
  icon,
  className = "",
}: AlertProps) {
  if (!message) {
    return null;
  }

  const variantClass = `alert alert-${status}`;

  const defaultIcon =
    status === "success" ? (
      <FaCheckCircle />
    ) : status === "warning" ? (
      <FaExclamationTriangle />
    ) : status === "error" ? (
      <FaExclamationCircle />
    ) : (
      <FaInfoCircle />
    );

  return (
    <div
      role={status === "error" || status === "warning" ? "alert" : "status"}
      className={`${variantClass} mb-3 ${className}`}
    >
      <span aria-hidden="true">{icon || defaultIcon}</span>
      {message}
    </div>
  );
}
