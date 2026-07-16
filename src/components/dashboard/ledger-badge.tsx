import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const ledgerBadgeVariants = cva(
  "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[11px] font-mono font-medium uppercase tracking-wide whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "text-foreground",
        present: "border-[#1e4d3a]/25 bg-[#dceadf] text-[#1e4d3a]",
        absent: "border-[#8a9a8e]/30 bg-[#e4ebe6] text-[#6b7468]",
        ready: "border-[#1e4d3a]/25 bg-[#e6f0e8] text-[#1e4d3a]",
        danger: "border-[#a3341f]/35 bg-[#f7e4de] text-[#a3341f]",
        cancelled: "border-[#77694f]/25 bg-[#e9e1d0] text-[#77694f]",
        noclass: "border-dashed border-[#77694f]/40 bg-transparent text-[#77694f]",
        makeup: "border-[#8a5a10]/25 bg-[#f2e6c9] text-[#8a5a10]",
        rescheduled: "border-[#26547c]/25 bg-[#dbe7f1] text-[#26547c]",
        experimental: "border-[#5b3d84]/25 bg-[#e8dff2] text-[#5b3d84]",
        partial: "border-[#b8860b]/30 bg-[#f7ebc8] text-[#6b5624]",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface LedgerBadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof ledgerBadgeVariants> {}

export function LedgerBadge({ className, variant, ...props }: LedgerBadgeProps) {
  return <div className={cn(ledgerBadgeVariants({ variant }), className)} {...props} />;
}
