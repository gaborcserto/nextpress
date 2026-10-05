import type { ZodIssue } from "zod";

export function fieldErrorsFromIssues(issues: readonly ZodIssue[]) {
  const errors: Record<string, string> = {};

  for (const issue of issues) {
    const field = issue.path[0];
    if (typeof field === "string" && !errors[field]) {
      errors[field] = issue.message;
    }
  }

  return errors;
}
