import { Button, type ButtonProps } from "@/ui/primitives";

export function AuthSubmitButton({
  children,
  className,
  ...props
}: ButtonProps) {
  return (
    <Button
      variant="solid"
      color="primary"
      size="md"
      fullWidth
      className={["mt-2 min-h-11", className].filter(Boolean).join(" ")}
      {...props}
    >
      {children}
    </Button>
  );
}
