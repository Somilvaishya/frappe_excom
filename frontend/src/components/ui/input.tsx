import * as React from "react";
import { cn } from "./utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "flex h-9 w-full min-w-0 rounded-md border border-zinc-700 bg-zinc-800/50 px-3 py-1 text-base text-white placeholder:text-zinc-500 transition-colors outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-blue-500 focus-visible:ring-1 focus-visible:ring-blue-500",
        className
      )}
      {...props}
    />
  );
}

export { Input };
