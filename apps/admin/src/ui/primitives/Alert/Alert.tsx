"use client";

import {
  FaCheckCircle,
  FaExclamationCircle,
  FaExclamationTriangle,
  FaInfoCircle,
} from "react-icons/fa";

import type { AlertProps } from "./Alert.types";

export default function Alert({
  message,
  status = "info",
  icon,
  className = "",
}: AlertProps) {
  if (!message) {
    return null;
  }

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
      className={`admin-alert mb-3 ${className}`}
      data-status={status}
    >
      <span aria-hidden="true">{icon || defaultIcon}</span>
      <span>{message}</span>
    </div>
  );
}
