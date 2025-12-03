import * as yup from "yup";

export type ValidationIssue = {
  path: string | null;
  message: string;
};

export function yupIssues(err: unknown): ValidationIssue[] | null {
  if (!(err instanceof yup.ValidationError)) return null;

  const issues = err.inner.length > 0 ? err.inner : [err];

  return issues.map((e) => ({
    path: e.path || null,
    message: e.message,
  }));
}
