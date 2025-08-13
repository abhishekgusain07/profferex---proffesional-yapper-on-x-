'use client'

import { motion } from 'framer-motion'
import { 
  X, 
  FileText, 
  Image, 
  Video, 
  FileIcon, 
  Link, 
  Loader2,
  AlertCircle
} from 'lucide-react'
import type { Attachment } from '@/types/chat'
import type { LocalAttachment } from '@/hooks/use-attachments'
import { useAttachments } from '@/hooks/use-attachments'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface AttachmentItemProps {
  attachment: Attachment | LocalAttachment
  index: number
}

// Get icon based on attachment type
function getAttachmentIcon(type: Attachment['type']) {
  switch (type) {
    case 'image':
      return Image
    case 'video':
      return Video
    case 'pdf':
    case 'docx':
    case 'txt':
      return FileText
    case 'url':
      return Link
    case 'manual':
    default:
      return FileIcon
  }
}

// Get color scheme based on attachment type
function getColorScheme(type: Attachment['type']) {
  switch (type) {
    case 'image':
      return {
        bg: 'bg-green-50',
        border: 'border-green-200',
        text: 'text-green-700',
        icon: 'text-green-500'
      }
    case 'video':
      return {
        bg: 'bg-purple-50',
        border: 'border-purple-200',
        text: 'text-purple-700',
        icon: 'text-purple-500'
      }
    case 'pdf':
      return {
        bg: 'bg-red-50',
        border: 'border-red-200',
        text: 'text-red-700',
        icon: 'text-red-500'
      }
    case 'docx':
      return {
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        text: 'text-blue-700',
        icon: 'text-blue-500'
      }
    case 'txt':
      return {
        bg: 'bg-gray-50',
        border: 'border-gray-200',
        text: 'text-gray-700',
        icon: 'text-gray-500'
      }
    case 'url':
      return {
        bg: 'bg-indigo-50',
        border: 'border-indigo-200',
        text: 'text-indigo-700',
        icon: 'text-indigo-500'
      }
    default:
      return {
        bg: 'bg-gray-50',
        border: 'border-gray-200',
        text: 'text-gray-700',
        icon: 'text-gray-500'
      }
  }
}

export function AttachmentItem({ attachment, index }: AttachmentItemProps) {
  const { removeAttachment } = useAttachments()
  const Icon = getAttachmentIcon(attachment.type)
  const colors = getColorScheme(attachment.type)

  const isUploading = (attachment as any).variant === 'chat' && (attachment as any).isUploading
  const hasError = (attachment as any).variant === 'chat' && (attachment as any).error
  const progress = (attachment as any).variant === 'chat' ? (attachment as any).uploadProgress || 0 : 100

  const handleRemove = () => {
    removeAttachment({ id: attachment.id })
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: -10 }}
      transition={{ 
        duration: 0.2, 
        delay: index * 0.05,
        type: "spring",
        stiffness: 300,
        damping: 25
      }}
      className={cn(
        'relative group inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm max-w-xs',
        colors.bg,
        colors.border,
        hasError && 'border-red-300 bg-red-50'
      )}
    >
      {/* Icon */}
      <div className={cn('flex-shrink-0', hasError ? 'text-red-500' : colors.icon)}>
        {isUploading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : hasError ? (
          <AlertCircle className="w-4 h-4" />
        ) : (
          <Icon className="w-4 h-4" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className={cn(
          'font-medium truncate',
          hasError ? 'text-red-700' : colors.text
        )}>
          {attachment.title || 'Untitled'}
        </div>

        {/* Upload progress */}
        {isUploading && (
          <div className="mt-1">
            <Progress value={progress} className="h-1" />
          </div>
        )}

        {/* Error message */}
        {hasError && (
          <div className="text-xs text-red-600 mt-1">
            {(attachment as any).error}
          </div>
        )}

        {/* File type indicator */}
        {!isUploading && !hasError && (
          <div className={cn('text-xs opacity-75', colors.text)}>
            {attachment.type.toUpperCase()}
            {(attachment as any).variant === 'knowledge' && ' • Knowledge'}
            {(attachment as any).variant === 'chat' && ' • Uploaded'}
          </div>
        )}
      </div>

      {/* Remove button */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRemove}
              className={cn(
                'h-6 w-6 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity',
                'hover:bg-red-100 hover:text-red-600',
                hasError && 'opacity-100'
              )}
            >
              <X className="w-3 h-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Remove attachment</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Upload progress overlay */}
      {isUploading && (
        <div className="absolute inset-0 bg-white/50 backdrop-blur-sm rounded-lg flex items-center justify-center">
          <div className="text-xs font-medium text-gray-600">
            {progress < 100 ? `${Math.round(progress)}%` : 'Processing...'}
          </div>
        </div>
      )}
    </motion.div>
  )
}