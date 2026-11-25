import { AdminAsyncButton, type AdminAsyncButtonProps } from "@/ui/primitives";

export function AuthSubmitButton({
  children,
  className,
  ...props
}: AdminAsyncButtonProps) {
  return (
    <AdminAsyncButton
      variant="solid"
      color="primary"
      size="md"
      fullWidth
      className={["mt-2 min-h-11", className].filter(Boolean).join(" ")}
      {...props}
    >
      {children}
    </AdminAsyncButton>
  );
}
