import { SemcasBrand } from "@/components/branding/SemcasBrand";

interface SemcasLogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function SemcasLogo({ size = "md", className }: SemcasLogoProps) {
  const variant = size === "sm" ? "compact" : size === "lg" ? "poster" : "header";
  return <SemcasBrand variant={variant} className={className} />;
}

export function SemcasHeader({ title, subtitle }: { title?: string; subtitle?: string }) {
  return (
    <header className="mb-8 space-y-3 text-center">
      <SemcasBrand variant="header" className="mx-auto" />
      {title && <h1 className="text-lg font-semibold leading-snug text-foreground">{title}</h1>}
      {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
    </header>
  );
}
