import { ZodError } from "zod";

export type ValidationIssue = {
  path: string | null;
  message: string;
};

export function zodIssues(err: unknown): ValidationIssue[] | null {
  if (!(err instanceof ZodError)) return null;

  return err.issues.map((issue) => ({
    path: issue.path.length ? issue.path.join(".") : null,
    message: issue.message,
  }));
}
