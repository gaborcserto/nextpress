import { ThemeToggle } from "@/ui/components/ThemeToggle";

import type { AuthShellProps } from "./AuthShell.types";

export function AuthShell({
  title,
  description,
  icon,
  children,
  asForm = false,
  onSubmitAction,
}: AuthShellProps) {
  const inner = (
    <>
      <header>
        {icon && (
          <span className="mb-3 block text-primary" aria-hidden="true">
            {icon}
          </span>
        )}
        <h1 className="admin-page-title">{title}</h1>
        {description && <p className="admin-page-description">{description}</p>}
      </header>
      {children}
    </>
  );

  return (
    <div className="admin-auth">
      <header className="admin-auth-header">
        <span className="admin-wordmark">NextPress</span>
        <ThemeToggle />
      </header>
      <main className="admin-auth-content">
        {asForm ? (
          <form
            className="admin-auth-panel"
            method="post"
            onSubmit={onSubmitAction}
          >
            {inner}
          </form>
        ) : (
          <div className="admin-auth-panel">{inner}</div>
        )}
      </main>
    </div>
  );
}
