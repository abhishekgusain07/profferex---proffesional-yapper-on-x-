import { AnimatedLogo } from './animated-logo'
import { MessageWrapper } from './message-wrapper'
import { ChatStatus } from 'ai'

export const LoadingMessage = ({
  hasImage,
  status,
}: {
  hasImage: boolean
  status: ChatStatus
}) => {
  return (
    <MessageWrapper
      id="loading"
      disableAnimation={false}
      isUser={false}
      showOptions={false}
      animateLogo={true}
    >
      <div className="text-slate-700">
        {hasImage && status === 'submitted' && (
          <div className="mb-3 space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5">
                <div className="w-1 h-1 bg-slate-400 rounded-full animate-pulse"></div>
                <div
                  className="w-1 h-1 bg-slate-400 rounded-full animate-pulse"
                  style={{ animationDelay: '0.1s' }}
                ></div>
                <div
                  className="w-1 h-1 bg-slate-400 rounded-full animate-pulse"
                  style={{ animationDelay: '0.2s' }}
                ></div>
              </div>
              <span className="text-sm">Reading images...</span>
            </div>
          </div>
        )}
        Thinking...
      </div>
    </MessageWrapper>
  )
}