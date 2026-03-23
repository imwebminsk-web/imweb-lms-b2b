import * as React from "react";

import { cn } from "@/lib/utils";

import { buttonVariants, type ButtonVariantProps } from "./button-variants";

const Button = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> & ButtonVariantProps
>(({ className, variant, size, type = "button", ...props }, ref) => {
  return (
    <button
      ref={ref}
      type={type}
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
});
Button.displayName = "Button";

export { Button, buttonVariants };
