import { cn } from "@/lib/utils";
import logoLight from "@/assets/hyper-logo-light.svg";
import logoDark from "@/assets/hyper-logo-dark.svg";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center", className)}>
      <img
        src={logoLight}
        alt="Hyper Copilot"
        className="h-7 w-auto dark:hidden"
        width={140}
        height={28}
      />
      <img
        src={logoDark}
        alt="Hyper Copilot"
        className="hidden h-7 w-auto dark:block"
        width={140}
        height={28}
      />
    </span>
  );
}
