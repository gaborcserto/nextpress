export function AdminLogo({ collapsed }: { collapsed: boolean }) {
  return (
    <span className="admin-wordmark" aria-label="nextpress.">
      {collapsed ? "np" : "nextpress"}
      <span aria-hidden="true">.</span>
    </span>
  );
}
