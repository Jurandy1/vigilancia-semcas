import { cn } from "@/lib/utils";

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "destructive" | "success";
}

export function Alert({ className, variant = "default", ...props }: AlertProps) {
  return (
    <div
      role="alert"
      className={cn(
        "relative w-full rounded-md border px-4 py-3 text-sm",
        variant === "destructive" && "border-destructive/50 text-destructive bg-destructive/5",
        variant === "success" && "border-accent/50 text-accent bg-accent/5",
        variant === "default" && "border-border bg-muted/50",
        className
      )}
      {...props}
    />
  );
}
