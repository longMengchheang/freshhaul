import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[0.95rem] text-slate-900 transition-all duration-150 outline-none shadow-[0_1px_2px_rgba(50,50,93,0.04),0_1px_1px_rgba(0,0,0,0.03)] file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-slate-900 placeholder:text-slate-400 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15 focus-visible:shadow-[0_0_0_1px_rgba(5,150,105,0.15)] hover:border-slate-300 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20",
        className
      )}
      {...props}
    />
  )
}

export { Input }
