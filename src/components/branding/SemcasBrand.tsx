import { cn } from "@/lib/utils";
import { ORG_SHORT, SECRETARIAT_NAME } from "@/lib/branding";

type SemcasBrandVariant = "sidebar" | "header" | "login" | "footer" | "compact" | "poster";

interface SemcasBrandProps {
  variant?: SemcasBrandVariant;
  className?: string;
  inverted?: boolean;
}

export function SemcasBrand({
  variant = "header",
  className,
  inverted = false,
}: SemcasBrandProps) {
  const titleClass = cn(
    "font-bold tracking-[0.12em] leading-none",
    variant === "sidebar" && "text-xl text-white",
    variant === "login" && "text-[34px] text-white",
    variant === "header" && "text-[12.5px] text-[#0b3a6e]",
    variant === "compact" && "text-[11px] text-[#0b3a6e]",
    variant === "footer" && "text-[15px] text-[#5b6b7f]",
    variant === "poster" && "text-2xl text-[#0b3a6e]",
    inverted && variant !== "sidebar" && variant !== "login" && "text-white"
  );

  const subtitleClass = cn(
    "leading-snug",
    variant === "sidebar" && "mt-1.5 text-[10.5px] text-white/60",
    variant === "login" && "mt-3.5 text-[15px] text-white/72 max-w-[28ch]",
    variant === "header" && "mt-0.5 text-[11px] text-[#8a97a8]",
    variant === "compact" && "mt-0.5 text-[10px] text-[#8a97a8] line-clamp-2",
    variant === "footer" && "text-[15px] text-[#5b6b7f]",
    variant === "poster" && "mt-2 text-sm text-[#5b6b7f] max-w-[36ch] mx-auto"
  );

  const eyebrowClass = cn(
    "font-bold uppercase tracking-[0.16em]",
    variant === "sidebar" && "text-[9.5px] text-white/55",
    variant === "login" && "text-[10.5px] text-white/60 tracking-[0.18em]"
  );

  return (
    <div className={className}>
      {(variant === "login") && (
        <p className={cn("m-0", eyebrowClass)}>{SECRETARIAT_NAME}</p>
      )}
      <p className={cn("m-0", titleClass, (variant === "sidebar" || variant === "login") && "mt-1.5")}>
        {ORG_SHORT}
      </p>
      {variant !== "compact" && (
        <p className={cn("m-0", subtitleClass)}>
          {variant === "footer" ? `${ORG_SHORT} · ${SECRETARIAT_NAME}` : SECRETARIAT_NAME}
        </p>
      )}
    </div>
  );
}
