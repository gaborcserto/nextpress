import type { FormEventHandler, ReactNode } from "react";

export type AuthShellProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
  asForm?: boolean;
  onSubmitAction?: FormEventHandler<HTMLFormElement>;
};
