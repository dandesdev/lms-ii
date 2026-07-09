import { cn } from "@/lib/utils";

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  variant?: "default" | "success" | "warning" | "muted";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variant === "default" && "bg-[#e6ddc8] text-[#1e4d3a]",
        variant === "success" && "bg-[#d4edda] text-[#155724]",
        variant === "warning" && "bg-[#fff3cd] text-[#856404]",
        variant === "muted" && "bg-[#f0ebe0] text-[#6b6558]",
        className
      )}
      {...props}
    />
  );
}
