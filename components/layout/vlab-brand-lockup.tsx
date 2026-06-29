import { withBasePath } from "@/lib/base-path";
import { cn } from "@/lib/utils";

type VlabBrandLockupProps = {
  className?: string;
  logoClassName?: string;
  variant?: "dark" | "light";
};

export function VlabBrandLockup({
  className,
  logoClassName,
  variant = "dark",
}: VlabBrandLockupProps) {
  const vlabLogo = variant === "dark" ? "/brand/logo-vlab-branco.png" : "/brand/logo-vlab.png";

  return (
    <span className={cn("inline-flex items-center gap-4", className)}>
      <img
        alt="INPE"
        className={cn("h-14 w-auto shrink-0 object-contain", logoClassName)}
        decoding="async"
        src={withBasePath("/brand/logo-inpe.png")}
      />
      <span
        aria-hidden="true"
        className={cn("h-12 w-px", variant === "dark" ? "bg-white/24" : "bg-zinc-300")}
      />
      <img
        alt="VLab"
        className={cn("h-14 w-auto shrink-0 object-contain", logoClassName)}
        decoding="async"
        src={withBasePath(vlabLogo)}
      />
    </span>
  );
}
