import Image from "next/image";
import { cn } from "@/lib/utils";

interface ParticipantShellProps {
  eventTitle?: string;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

export function ParticipantShell({
  eventTitle,
  children,
  className,
  contentClassName,
}: ParticipantShellProps) {
  return (
    <main
      className={cn(
        "min-h-[100dvh] bg-[radial-gradient(circle_at_top,#eef6fb_0,#e8eef5_44%,#e3e9f0_100%)] flex flex-col items-center sm:px-5 sm:py-8",
        className
      )}
    >
      <div className="flex min-h-[100dvh] w-full max-w-[460px] flex-col overflow-hidden bg-white shadow-none sm:min-h-[min(760px,calc(100dvh-4rem))] sm:rounded-[24px] sm:border sm:border-[#d6e0eb] sm:shadow-[0_18px_50px_rgba(18,43,70,.10)]">
        <header className="shrink-0 border-b border-[#edf1f5] px-5 py-4 flex items-center gap-3 sm:px-6 sm:py-5">
          <Image
            src="/images/logo-prefeitura-saoluis.jpg"
            alt="Prefeitura de São Luís"
            width={92}
            height={30}
            priority
            className="block w-[96px] h-auto"
          />
          <div className="border-l border-[#e2e8f0] pl-3 min-w-0">
            <p className="m-0 text-[12.5px] font-bold tracking-[0.1em] text-[#0b3a6e]">SEMCAS</p>
            {eventTitle && (
              <p className="mt-0.5 mb-0 text-[11px] text-[#8a97a8] leading-snug truncate">
                {eventTitle}
              </p>
            )}
          </div>
        </header>
        <div className={cn("flex-1 flex flex-col min-h-0", contentClassName)}>{children}</div>
      </div>
    </main>
  );
}

export function ParticipantOptionButton({
  selected,
  onClick,
  label,
  multi = false,
  role = "radio",
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  multi?: boolean;
  role?: "radio" | "checkbox";
}) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3.5 text-left min-h-[56px] rounded-xl border px-4 py-3.5 transition-all active:scale-[.99]",
        selected
          ? "border-[#0b4a83] bg-[#edf5fc] shadow-[0_0_0_1px_#0b4a83]"
          : "border-[#cbd7e4] bg-white hover:border-[#6f98bd] hover:bg-[#f8fbfd]"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "w-5 h-5 shrink-0 border-2 flex items-center justify-center text-[11px] font-bold",
          multi ? "rounded-[4px]" : "rounded-full",
          selected
            ? "border-[#0b3a6e] bg-[#0b3a6e] text-white"
            : "border-[#c9d4e2] bg-white text-transparent"
        )}
      >
        {selected && multi ? "✓" : null}
        {selected && !multi ? <span className="w-2 h-2 rounded-full bg-white" /> : null}
      </span>
      <span className={cn("flex-1 text-base", selected ? "font-semibold" : "font-normal")}>
        {label}
      </span>
    </button>
  );
}
