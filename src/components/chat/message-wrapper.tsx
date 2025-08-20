import { Copy, MoreHorizontal, RotateCcw, User } from 'lucide-react'
import { useState } from 'react'
import DuolingoButton from '../ui/duolingo-button'
import { AnimatedLogo } from './animated-logo'
import { PropsWithChildren } from 'react'

interface MessageWrapperProps {
  id: string
  metadata?: any
  disableAnimation: boolean
  isUser: boolean
  showOptions: boolean
  animateLogo: boolean
}

export const MessageWrapper = ({
  id,
  metadata,
  disableAnimation,
  isUser,
  showOptions,
  animateLogo,
  children,
}: PropsWithChildren<MessageWrapperProps>) => {
  const [showActions, setShowActions] = useState(false)

  return (
    <div
      className="group relative flex gap-3"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Avatar */}
      <div className="flex-shrink-0">
        {isUser ? (
          <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center shadow-sm">
            <User className="w-4 h-4 text-gray-600" />
          </div>
        ) : (
          <AnimatedLogo animate={animateLogo} />
        )}
      </div>

      {/* Message content */}
      <div className="flex-1 max-w-[80%]">
        <div
          className={`rounded-2xl px-4 py-3 shadow-sm ${
            isUser
              ? 'bg-blue-500 text-white ml-12'
              : 'bg-white border border-gray-200 text-gray-900'
          }`}
        >
          {children}
        </div>

        {/* Message actions */}
        {showActions && showOptions && (
          <div className="absolute -right-20 top-0 flex items-center gap-1 z-10">
            <DuolingoButton
              variant="secondary"
              size="icon"
              className="h-8 w-8 bg-white shadow-md hover:bg-gray-50 border border-gray-200"
              onClick={() => {
                // Copy functionality
              }}
            >
              <Copy className="w-3 h-3" />
            </DuolingoButton>

            {!isUser && (
              <DuolingoButton
                variant="secondary"
                size="icon"
                className="h-8 w-8 bg-white shadow-md hover:bg-gray-50 border border-gray-200"
                onClick={() => {
                  // Regenerate functionality
                }}
              >
                <RotateCcw className="w-3 h-3" />
              </DuolingoButton>
            )}

            <DuolingoButton
              variant="secondary"
              size="icon"
              className="h-8 w-8 bg-white shadow-md hover:bg-gray-50 border border-gray-200"
              onClick={() => {
                // More options
              }}
            >
              <MoreHorizontal className="w-3 h-3" />
            </DuolingoButton>
          </div>
        )}
      </div>
    </div>
  )
}