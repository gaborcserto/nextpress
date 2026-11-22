import { type ReactNode } from "react";

import { AdminHeaderActions } from "../AdminHeaderActions";

type AdminPageLayoutProps = {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  workspace?: "wide" | "editor" | "settings" | "focused";
  children: ReactNode;
};

export function AdminPageLayout({
  title,
  description,
  actions,
  workspace = "wide",
  children,
}: AdminPageLayoutProps) {
  return (
    <div className="admin-page" data-workspace={workspace}>
      <header className="admin-page-header">
        <h1 className="admin-page-title">{title}</h1>
        {description && (
          <div className="admin-page-description">{description}</div>
        )}
      </header>
      {actions && <AdminHeaderActions>{actions}</AdminHeaderActions>}
      {children}
    </div>
  );
}

type AdminPageColumnsProps = {
  sidebar: ReactNode;
  children: ReactNode;
};

export function AdminPageColumns({ sidebar, children }: AdminPageColumnsProps) {
  return (
    <div className="admin-writing-workspace">
      <div className="admin-writing-layout">
        <div className="min-w-0 space-y-5">{children}</div>
        <aside className="min-w-0 space-y-5">{sidebar}</aside>
      </div>
    </div>
  );
}
