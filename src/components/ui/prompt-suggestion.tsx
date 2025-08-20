"use client"

import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { VariantProps } from "class-variance-authority"

export type PromptSuggestionProps = {
  children: React.ReactNode
  variant?: VariantProps<typeof buttonVariants>["variant"]
  size?: VariantProps<typeof buttonVariants>["size"]
  className?: string
  highlight?: string
  icon?: React.ReactNode
  // Thread-aware props
  isThreadSuggestion?: boolean
  category?: 'thread' | 'tweet' | 'general'
} & React.ButtonHTMLAttributes<HTMLButtonElement>

function PromptSuggestion({
  children,
  variant,
  size,
  className,
  highlight,
  icon,
  isThreadSuggestion = false,
  category = 'general',
  ...props
}: PromptSuggestionProps) {
  const isHighlightMode = highlight !== undefined && highlight.trim() !== ""
  const content = typeof children === "string" ? children : ""

  // Enhanced contentport-style suggestions
  const getDefaultStyling = () => {
    if (category === 'thread') {
      return "border-blue-200 bg-blue-50/50 hover:bg-blue-100/80 hover:border-blue-300 text-blue-800"
    }
    if (category === 'tweet') {
      return "border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 text-gray-700"
    }
    return "border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 text-gray-700"
  }

  if (!isHighlightMode) {
    return (
      <Button
        variant={variant || "outline"}
        size={size || "sm"}
        className={cn(
          "w-full justify-start gap-2 rounded-xl p-3 h-auto text-left font-normal transition-all duration-200",
          getDefaultStyling(),
          isThreadSuggestion && "ring-1 ring-blue-200/50",
          className
        )}
        {...props}
      >
        {icon && <span className="flex-shrink-0">{icon}</span>}
        <span className="flex-1 text-sm leading-relaxed">{children}</span>
      </Button>
    )
  }

  if (!content) {
    return (
      <Button
        variant={variant || "ghost"}
        size={size || "sm"}
        className={cn(
          "w-full cursor-pointer justify-start gap-2 rounded-xl p-3 h-auto text-left font-normal",
          "hover:bg-accent transition-all duration-200",
          getDefaultStyling(),
          className
        )}
        {...props}
      >
        {icon && <span className="flex-shrink-0">{icon}</span>}
        <span className="flex-1">{children}</span>
      </Button>
    )
  }

  const trimmedHighlight = highlight.trim()
  const contentLower = content.toLowerCase()
  const highlightLower = trimmedHighlight.toLowerCase()
  const shouldHighlight = contentLower.includes(highlightLower)

  return (
    <Button
      variant={variant || "ghost"}
      size={size || "sm"}
      className={cn(
        "w-full cursor-pointer justify-start gap-2 rounded-xl p-3 h-auto text-left font-normal",
        "hover:bg-accent transition-all duration-200",
        getDefaultStyling(),
        className
      )}
      {...props}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span className="flex-1">
        {shouldHighlight ? (
        (() => {
          const index = contentLower.indexOf(highlightLower)
          if (index === -1)
            return (
              <span className="text-muted-foreground whitespace-pre-wrap">
                {content}
              </span>
            )

          const actualHighlightedText = content.substring(
            index,
            index + highlightLower.length
          )

          const before = content.substring(0, index)
          const after = content.substring(index + actualHighlightedText.length)

          return (
            <>
              {before && (
                <span className="text-muted-foreground whitespace-pre-wrap">
                  {before}
                </span>
              )}
              <span className="text-primary font-medium whitespace-pre-wrap">
                {actualHighlightedText}
              </span>
              {after && (
                <span className="text-muted-foreground whitespace-pre-wrap">
                  {after}
                </span>
              )}
            </>
          )
        })()
        ) : (
          <span className="text-muted-foreground whitespace-pre-wrap">
            {content}
          </span>
        )}
      </span>
    </Button>
  )
}

export { PromptSuggestion }
