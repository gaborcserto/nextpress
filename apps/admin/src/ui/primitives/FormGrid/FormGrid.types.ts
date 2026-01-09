import type { ReactNode } from "react";

export type Span = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export type FormGrid12Props = {
  children: ReactNode;
};

export type FieldProps = {
  label: string;
  children: ReactNode;
  hint?: string;
  span?: Span;
};
