import Image from "next/image";

interface SemcasLogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

// Proporção real do arquivo (291x94).
const sizes = {
  sm: { width: 130, height: 42 },
  md: { width: 170, height: 55 },
  lg: { width: 220, height: 71 },
};

export function SemcasLogo({ size = "md", className }: SemcasLogoProps) {
  const { width, height } = sizes[size];
  return (
    <div className={className}>
      <Image
        src="/images/logo-prefeitura-saoluis.jpg"
        alt="Prefeitura de São Luís"
        width={width}
        height={height}
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
