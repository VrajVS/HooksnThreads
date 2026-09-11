import * as React from "react";

import { cn } from "@/lib/utils";

const GRADIENT =
  "bg-gradient-to-r from-[#84a9fa] via-[#fb6fec] via-[#fba69e] via-[#fdd4a3] via-[#fb6fec] to-[#84a9fa] bg-[length:200%]";

type GradientButtonOwnProps = {
  className?: string;
  innerClassName?: string;
  children?: React.ReactNode;
};

type GradientButtonProps<T extends React.ElementType> =
  GradientButtonOwnProps & {
    as?: T;
  } & Omit<React.ComponentPropsWithoutRef<T>, keyof GradientButtonOwnProps | "as">;

function GradientButton<T extends React.ElementType = "button">({
  as,
  className,
  innerClassName,
  children,
  ...props
}: GradientButtonProps<T>) {
  const Comp = as ?? "button";
  return (
    <Comp
      className={cn(
        "group inline-flex rounded-full p-[2px] transition-[background-position] [transition-duration:800ms] ease-out",
        GRADIENT,
        "[background-position:0%_0%] hover:[background-position:200%_0%]",
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          "inline-flex w-full items-center justify-center gap-2 rounded-full bg-background px-6 py-2.5 text-sm font-medium text-foreground transition-colors",
          innerClassName,
        )}
      >
        {children}
      </span>
    </Comp>
  );
}

export { GradientButton };
