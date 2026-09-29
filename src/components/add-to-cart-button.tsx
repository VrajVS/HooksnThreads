import * as React from "react";

import { cn } from "@/lib/utils";

export const AddToCartButton = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, children = "Add to Cart", type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex h-9 items-center justify-center whitespace-nowrap rounded-full border-[1.5px] border-brand-gold bg-background px-4 text-sm font-medium text-brand-navy transition-colors",
        "hover:bg-brand-gold hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/50",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  ),
);
AddToCartButton.displayName = "AddToCartButton";
