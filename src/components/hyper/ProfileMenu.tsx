import { Link } from "@tanstack/react-router";
import { CreditCard, FileText, Settings, ShieldCheck, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const links = [
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/pricing", label: "Pricing", icon: CreditCard },
  { to: "/terms", label: "Terms of Service", icon: FileText },
  { to: "/privacy", label: "Privacy Policy", icon: ShieldCheck },
] as const;

export function ProfileMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className="grid h-9 w-9 bg-primary place-items-center rounded-full text-[12px] font-extrabold text-primary-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          TK
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 rounded-2xl">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="text-[13px] font-bold">TK Das</span>
          <span className="text-[11.5px] font-medium text-muted-foreground">Hyper Pro trial</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {links.map((l) => {
          const Icon = l.icon;
          return (
            <DropdownMenuItem key={l.to} asChild className="cursor-pointer rounded-lg">
              <Link to={l.to} className="flex items-center gap-2.5 text-[13px] font-medium">
                <Icon className="h-4 w-4" strokeWidth={1.8} />
                {l.label}
              </Link>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer rounded-lg text-[13px] font-medium">
          <LogOut className="h-4 w-4" strokeWidth={1.8} />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
