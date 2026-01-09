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
    <div className="p-6 sm:p-8">
      {icon && (
        <div className="flex justify-center mb-4">
          <div className="size-16 rounded-full bg-linear-to-r from-emerald-400 to-cyan-400 text-primary-content grid place-items-center shadow-md">
            {icon}
          </div>
        </div>
      )}

      <h1 className="text-center text-2xl font-semibold">{title}</h1>

      {description && (
        <p className="text-center text-sm text-base-content/70 mt-1 mb-5">
          {description}
        </p>
      )}

      {children}
    </div>
  );

  return (
    <div className="min-h-dvh grid place-items-center px-4 bg-linear-to-br from-base-200 to-base-300">
      {asForm ? (
        <form
          onSubmit={onSubmitAction}
          className="relative w-full max-w-md rounded-3xl border border-base-300 bg-base-100 shadow-xl overflow-hidden"
        >
          {inner}
        </form>
      ) : (
        <div className="relative w-full max-w-md rounded-3xl border border-base-300 bg-base-100 shadow-xl overflow-hidden">
          {inner}
        </div>
      )}
    </div>
  );
}
