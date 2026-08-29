import type { ButtonHTMLAttributes, ReactNode } from "react";
import { forwardRef } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: "light" | "dark" | "ghost" | "danger";
  fullWidth?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    children,
    className = "",
    variant = "light",
    fullWidth = false,
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      className={`button button--${variant}${fullWidth ? " button--full" : ""} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
});
