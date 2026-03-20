"use client"

import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center whitespace-nowrap text-sm font-semibold transition-all duration-150 outline-none select-none focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 aria-invalid:ring-2 aria-invalid:ring-destructive/25 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "rounded-full bg-slate-900 text-white shadow-[0_1px_2px_rgba(0,0,0,0.12),0_4px_8px_-2px_rgba(0,0,0,0.1)] hover:bg-slate-800 hover:shadow-[0_2px_4px_rgba(0,0,0,0.12),0_6px_12px_-2px_rgba(0,0,0,0.12)] active:scale-[0.98] active:shadow-[0_1px_2px_rgba(0,0,0,0.12)]",
        primary:
          "rounded-full bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(0,0,0,0.12),0_4px_8px_-2px_rgba(5,150,105,0.2)] hover:bg-primary/90 hover:shadow-[0_2px_4px_rgba(0,0,0,0.1),0_6px_12px_-2px_rgba(5,150,105,0.25)] active:scale-[0.98]",
        outline:
          "rounded-full border border-slate-200 bg-white text-slate-700 shadow-[0_1px_2px_rgba(50,50,93,0.06)] hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 hover:shadow-[0_2px_5px_rgba(50,50,93,0.08)] active:scale-[0.98] active:bg-slate-100 aria-expanded:bg-slate-50",
        secondary:
          "rounded-full bg-slate-100 text-slate-800 hover:bg-slate-200 active:scale-[0.98] aria-expanded:bg-slate-200",
        ghost:
          "rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:scale-[0.98] aria-expanded:bg-slate-100",
        destructive:
          "rounded-full bg-red-600 text-white shadow-[0_1px_2px_rgba(0,0,0,0.12)] hover:bg-red-700 active:scale-[0.98]",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-10 gap-2 px-5 has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        xs: "h-7 gap-1 px-3 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 gap-1.5 px-4 text-sm [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-12 gap-2.5 px-7 text-base",
        icon: "size-10 rounded-lg",
        "icon-xs": "size-7 rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-9 rounded-lg",
        "icon-lg": "size-12 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
