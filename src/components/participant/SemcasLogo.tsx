import Image from "next/image";

interface SemcasLogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = { sm: 40, md: 56, lg: 80 };

export function SemcasLogo({ size = "md", className }: SemcasLogoProps) {
  const px = sizes[size];
  return (
    <div className={className}>
      <Image
        src="/images/logo-semcas.svg"
        alt="SEMCAS"
        width={px}
        height={px}
        priority
        className="mx-auto"
      />
    </div>
  );
}

export function SemcasHeader({ title, subtitle }: { title?: string; subtitle?: string }) {
  return (
    <header className="text-center space-y-3 mb-8">
      <SemcasLogo size="md" />
      {title && <h1 className="text-lg font-semibold text-foreground leading-snug">{title}</h1>}
      {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
    </header>
  );
}
