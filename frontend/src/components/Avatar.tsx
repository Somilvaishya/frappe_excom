import { clsx } from "clsx";

interface AvatarProps {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const COLORS = [
  "bg-emerald-600",
  "bg-blue-600",
  "bg-purple-600",
  "bg-rose-600",
  "bg-amber-600",
  "bg-cyan-600",
  "bg-indigo-600",
  "bg-teal-600",
  "bg-pink-600",
  "bg-orange-600",
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function getColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

const sizeClasses = {
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-12 h-12 text-base",
};

export default function Avatar({ name, size = "md", className }: AvatarProps) {
  return (
    <div
      className={clsx(
        "rounded-full flex items-center justify-center font-medium text-white shrink-0",
        getColor(name),
        sizeClasses[size],
        className
      )}
    >
      {getInitials(name)}
    </div>
  );
}
