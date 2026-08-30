import { cn } from "@/lib/utils";

function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      role="img"
      aria-label="Hyper Copilot logo"
      fill="none"
    >
      <defs>
        <linearGradient id="hyper-mark" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FF5C39" />
          <stop offset="0.5" stopColor="#B44CFF" />
          <stop offset="1" stopColor="#3D7BFF" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#hyper-mark)" />
      <path
        d="M9.5 8v16M22.5 8v16M9.5 16h13"
        stroke="#fff"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Wordmark uses currentColor, so it adapts to both light and dark themes. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5 text-foreground", className)}>
      <LogoMark className="h-7 w-7 rounded-md" />
      <span className="text-[15px] font-extrabold tracking-tight">Hyper Copilot</span>
    </span>
  );
}
