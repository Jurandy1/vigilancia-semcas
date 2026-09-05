import { cn } from "@/lib/utils";
import { ORG_SHORT, CITY_NAME } from "@/lib/branding";

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
        "min-h-[100dvh] bg-[#eef2f7] flex flex-col items-center p-4",
        className
      )}
    >
      <div style={{ border: "1px solid #dbe4ef", borderRadius: "14px", background: "#fff", overflow: "hidden", minHeight: "600px", width: "100%", maxWidth: "460px", display: "flex", flexDirection: "column", boxShadow: "0 10px 30px rgba(18,43,70,0.05)" }}>
        <header style={{ padding: "14px 18px", borderBottom: "1px solid #eef1f5", display: "flex", alignItems: "center", gap: "12px" }}>
          {/* Logo prefeitura */}
          <img src="/logo-prefeitura-saoluis.jpg" alt={CITY_NAME} style={{ height: "26px", width: "auto", display: "block" }} />
          <span aria-hidden="true" style={{ width: "1px", height: "22px", background: "#e6ecf4" }}></span>
          <span style={{ fontSize: "12px", fontWeight: 700, letterSpacing: ".12em", color: "#0B3A6E" }}>{ORG_SHORT}</span>
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
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "14px 14px",
        border: `1px solid ${selected ? "#0B3A6E" : "#c9d4e2"}`,
        background: selected ? "#f4f8fc" : "#fff",
        borderRadius: "10px",
        fontSize: "14.5px",
        color: "#11243c",
        cursor: "pointer",
        minHeight: "52px",
        fontWeight: selected ? "600" : "400",
        textAlign: "left",
      }}
    >
      <span
        aria-hidden
        style={{
          width: "18px",
          height: "18px",
          borderRadius: multi ? "4px" : "99px",
          border: `1px solid ${selected ? "#0B3A6E" : "#c9d4e2"}`,
          background: selected && multi ? "#0B3A6E" : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          color: "#fff",
          fontSize: "12px",
        }}
      >
        {selected && multi ? "✓" : null}
        {selected && !multi ? (
          <span style={{ width: "8px", height: "8px", borderRadius: "99px", background: "#0B3A6E" }}></span>
        ) : null}
      </span>
      <span style={{ lineHeight: 1.4 }}>
        {label}
      </span>
    </button>
  );
}
