import type { ReactNode } from "react";

type AdminPageLayoutProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
};

export function AdminPageLayout({
  title,
  description,
  actions,
  children,
}: AdminPageLayoutProps) {
  return (
    <div className="mx-auto w-full max-w-screen-2xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">{title}</h1>
          {description && <p className="text-base-content/70">{description}</p>}
        </div>
        {actions}
      </header>
      {children}
    </div>
  );
}

type AdminPageColumnsProps = {
  sidebar: ReactNode;
  children: ReactNode;
};

export function AdminPageColumns({
  sidebar,
  children,
}: AdminPageColumnsProps) {
  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
      <aside className="space-y-6 lg:col-span-4">{sidebar}</aside>
      <div className="min-w-0 space-y-6 lg:col-span-8">{children}</div>
    </div>
  );
}
