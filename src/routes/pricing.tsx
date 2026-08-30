import { createFileRoute } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { Sidebar } from "@/components/hyper/Sidebar";
import { TopBar } from "@/components/hyper/TopBar";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing & Plans — Hyper Copilot Generative AI" },
      {
        name: "description",
        content:
          "Compare Hyper Copilot plans: free starter credits, Pro unlimited fast renders with 4K upscaling, and Studio for teams shipping generative AI at scale.",
      },
      { property: "og:title", content: "Pricing & Plans — Hyper Copilot" },
      {
        property: "og:description",
        content: "Starter, Pro and Studio plans for image, video, vector and audio generation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PricingPage,
});

const plans = [
  {
    name: "Starter",
    price: "$0",
    note: "per month",
    features: ["150 credits monthly", "Standard queue", "Personal use license"],
  },
  {
    name: "Pro",
    price: "$29",
    note: "per month",
    highlight: true,
    features: ["Unlimited fast renders", "4K upscaling", "Private models", "Commercial license"],
  },
  {
    name: "Studio",
    price: "$89",
    note: "per seat / month",
    features: ["Shared workspaces", "Brand kits & HEAVEN presets", "Priority GPUs", "SSO & audit log"],
  },
];

function PricingPage() {
  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-background">
      <Sidebar />
      <div className="lg:pl-[248px]">
        <TopBar />
        <main className="mx-auto max-w-5xl px-4 pb-28 pt-6 lg:px-8 lg:pb-20">
          <div className="grid gap-4 md:grid-cols-3">
            {plans.map((p) => (
              <div
                key={p.name}
                className={cn(
                  "rounded-3xl border border-border bg-surface/60 p-5",
                  p.highlight && "ring-spectral bg-surface",
                )}
              >
                <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  {p.name}
                </p>
                <p className="mt-3 text-3xl font-extrabold tracking-tight">{p.price}</p>
                <p className="text-[12px] text-muted-foreground">{p.note}</p>
                <ul className="mt-4 space-y-2 text-[13px]">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-spectral-3" strokeWidth={2.2} />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="mt-5 w-full rounded-full bg-primary px-4 py-2 text-[13px] font-bold text-primary-foreground transition-opacity hover:opacity-90"
                >
                  Choose {p.name}
                </button>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
