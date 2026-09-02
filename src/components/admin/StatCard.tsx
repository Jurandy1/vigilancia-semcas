import { Users, CheckCircle2, Clock, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  variant?: "blue" | "green" | "orange" | "purple";
  icon?: "users" | "check" | "clock" | "trend";
}

const variants = {
  blue: { bg: "bg-blue-50", text: "text-blue-700", icon: "text-blue-500" },
  green: { bg: "bg-green-50", text: "text-green-700", icon: "text-green-500" },
  orange: { bg: "bg-orange-50", text: "text-orange-600", icon: "text-orange-500" },
  purple: { bg: "bg-purple-50", text: "text-purple-700", icon: "text-purple-500" },
};

const icons = {
  users: Users,
  check: CheckCircle2,
  clock: Clock,
  trend: TrendingUp,
};

export function StatCard({ label, value, subtitle, variant = "blue", icon = "users" }: StatCardProps) {
  const v = variants[variant];
  const Icon = icons[icon];

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-start justify-between mb-3">
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", v.bg)}>
          <Icon className={cn("w-5 h-5", v.icon)} />
        </div>
      </div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={cn("text-3xl font-bold", v.text)}>{value}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  );
}
