'use client'

import { ArrowUp, History, Paperclip, Plus, Square, X } from 'lucide-react'
import { useCallback, useContext, useEffect, useState } from 'react'
import { trpc } from '@/trpc/client'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { PlainTextPlugin } from '@lexical/react/LexicalPlainTextPlugin'
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_HIGH,
  KEY_ENTER_COMMAND,
  PASTE_COMMAND,
} from 'lexical'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar'
import { useAttachments } from '@/hooks/use-attachments'
import { useChatContext } from '@/hooks/use-chat'
import { motion } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'
import { useRouter, useSearchParams } from 'next/navigation'
import { AttachmentItem } from './chat/attachment-item'
import { Messages } from './chat/messages'
import { KnowledgeSelector, SelectedKnowledgeDocument } from './knowledge-selector'
import { Button } from './ui/button'
import { FileUpload, FileUploadContext, FileUploadTrigger } from './ui/file-upload'
import { PromptSuggestion } from './ui/prompt-suggestion'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { Input } from './ui/input'
import type { Attachment, ChatAttachment } from '@/types/chat'
import { SheetContent, SheetTitle } from '@/components/ui/sheet'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import * as SheetPrimitive from '@radix-ui/react-dialog'

const ChatInput2 = ({
  onSubmit,
  onStop,
  disabled,
  handleFilesAdded,
}: {
  onSubmit: (text: string) => void
  onStop: () => void
  disabled: boolean
  handleFilesAdded: (files: File[]) => void
}) => {
  const [editor] = useLexicalComposerContext()
  const { isDragging } = useContext(FileUploadContext)
  const [hasText, setHasText] = useState(false)

  const { attachments, removeAttachment, addKnowledgeAttachment, hasUploading } =
    useAttachments()

  const handleSubmit = () => {
    const text = editor.read(() => $getRoot().getTextContent().trim())
    
    if (!text) return

    onSubmit(text)

    editor.update(() => {
      const root = $getRoot()
      root.clear()
      root.append($createParagraphNode())
    })
  }

  useEffect(() => {
    const removeCommand = editor?.registerCommand(
      KEY_ENTER_COMMAND,
      (event: KeyboardEvent | null) => {
        if (event && !event.shiftKey) {
          event.preventDefault()

          editor.update(() => {
            const root = $getRoot()
            const text = root.getTextContent().trim()
            if (!text) return

            onSubmit(text)

            root.clear()
            const paragraph = $createParagraphNode()
            root.append(paragraph)
          })
        }

        return true
      },
      COMMAND_PRIORITY_HIGH,
    )

    const removePasteCommand = editor.registerCommand<ClipboardEvent>(
      PASTE_COMMAND,
      (event) => {
        const pastedText = event.clipboardData?.getData('Text')

        if (pastedText) {
          const trimmedText = pastedText.trim()

          if (trimmedText !== pastedText) {
            editor.update(() => {
              const selection = $getSelection()
              if ($isRangeSelection(selection)) {
                selection.insertText(trimmedText)
              }
            })
            return true
          }
        }

        return false
      },
      COMMAND_PRIORITY_HIGH,
    )

    return () => {
      removeCommand?.()
      removePasteCommand?.()
    }
  }, [editor, onSubmit])

  useEffect(() => {
    const updateHasText = () => {
      editor.read(() => {
        const text = $getRoot().getTextContent().trim()
        setHasText(!!text)
      })
    }

    const removeUpdateListener = editor.registerUpdateListener(updateHasText)
    updateHasText() // Initial check

    return () => {
      removeUpdateListener()
    }
  }, [editor])

  const handleAddKnowledgeDoc = useCallback(
    (doc: SelectedKnowledgeDocument) => {
      addKnowledgeAttachment(doc)
    },
    [addKnowledgeAttachment],
  )

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return

      const files: File[] = []
      Array.from(items).forEach((item) => {
        if (item.kind === 'file') {
          const file = item.getAsFile()
          if (file) {
            files.push(file)
          }
        }
      })

      if (files.length > 0) {
        e.preventDefault()
        handleFilesAdded(files)
        return
      }
    },
    [handleFilesAdded, editor],
  )

  return (
    <div>
      <div className="mb-2 flex gap-2 items-center">
        {attachments.map((attachment, i) => {
          const onRemove = () => removeAttachment({ id: attachment.id })
          return (
            <motion.div
              key={attachment.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.2, delay: i * 0.1 }}
            >
              <AttachmentItem
                attachment={attachment as Attachment | ChatAttachment}
                index={i}
              />
            </motion.div>
          )
        })}
      </div>

      <div className="space-y-3">
        <div
          className={`relative transition-all rounded-xl duration-300 ease-out ${
            isDragging ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-gray-100' : ''
          }`}
        >
          {isDragging && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-indigo-50/90 to-blue-50/90 backdrop-blur-md rounded-xl z-20 border-2 border-dashed border-indigo-300">
              <div className="flex items-center gap-2 text-indigo-700">
                <Paperclip className="size-5" />
                <p className="font-medium">Drop files to attach</p>
              </div>
              <p className="text-sm text-indigo-500 mt-1">
                Supports images, documents, and more
              </p>
            </div>
          )}
          <div className="relative">
            <div
              className={`rounded-xl bg-white border-2 shadow-[0_2px_0_#E5E7EB] font-medium transition-all duration-300 focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-600 ${
                isDragging
                  ? 'border-indigo-200 shadow-[0_4px_12px_rgba(99,102,241,0.15)]'
                  : 'border-gray-200'
              }`}
            >
              <PlainTextPlugin
                contentEditable={
                  <ContentEditable
                    autoFocus
                    className="w-full px-4 py-3 outline-none min-h-[4.5rem] text-base placeholder:text-gray-400"
                    style={{ minHeight: '4.5rem' }}
                    onPaste={handlePaste}
                  />
                }
                placeholder={<div className="absolute top-3 left-4 text-gray-400 pointer-events-none">Tweet about...</div>}
                ErrorBoundary={LexicalErrorBoundary}
              />
              <HistoryPlugin />

              <div className="flex items-center justify-between px-3 pb-3">
                <div className="flex gap-1.5 items-center">
                  <FileUploadTrigger asChild>
                    <Button type="button" variant="secondary" size="icon">
                      <Paperclip className="text-stone-600 size-5" />
                    </Button>
                  </FileUploadTrigger>

                  <KnowledgeSelector onSelectDocument={handleAddKnowledgeDoc} />
                </div>

                {disabled ? (
                  <Button
                    onClick={onStop}
                    variant="default"
                    size="icon"
                    aria-label="Stop message"
                  >
                    <Square className="size-3 fill-white" />
                  </Button>
                ) : (
                  <Button
                    disabled={hasUploading || !hasText}
                    onClick={handleSubmit}
                    variant="default"
                    size="icon"
                    aria-label="Send message"
                  >
                    <ArrowUp className="size-5" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
const ChatInput = ({
  onSubmit,
  onStop,
  disabled,
  handleFilesAdded,
}: {
  onSubmit: (text: string) => void
  onStop: () => void
  disabled: boolean
  handleFilesAdded: (files: File[]) => void
}) => {
  const [message, setMessage] = useState('')
  const { isDragging } = useContext(FileUploadContext)

  const { attachments, removeAttachment, addKnowledgeAttachment, hasUploading } =
    useAttachments()

  const handleSubmit = () => {
    if (!message.trim()) return
    onSubmit(message.trim())
    setMessage('')
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleAddKnowledgeDoc = useCallback(
    (doc: SelectedKnowledgeDocument) => {
      addKnowledgeAttachment(doc)
    },
    [addKnowledgeAttachment],
  )

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return

      const files: File[] = []
      Array.from(items).forEach((item) => {
        if (item.kind === 'file') {
          const file = item.getAsFile()
          if (file) {
            files.push(file)
          }
        }
      })

      if (files.length > 0) {
        e.preventDefault()
        handleFilesAdded(files)
      }
    },
    [handleFilesAdded],
  )

  return (
    <div>
      <div className="mb-2 flex gap-2 items-center">
        {attachments.map((attachment, i) => {
          const onRemove = () => removeAttachment({ id: attachment.id })
          return (
            <motion.div
              key={attachment.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.2, delay: i * 0.1 }}
            >
              <AttachmentItem
                attachment={attachment as Attachment | ChatAttachment}
                index={i}
              />
            </motion.div>
          )
        })}
      </div>

      <div className="space-y-3">
        <div
          className={`relative transition-all rounded-xl duration-300 ease-out ${
            isDragging ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-gray-100' : ''
          }`}
        >
          {isDragging && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-indigo-50/90 to-blue-50/90 backdrop-blur-md rounded-xl z-20 border-2 border-dashed border-indigo-300">
              <div className="flex items-center gap-2 text-indigo-700">
                <Paperclip className="size-5" />
                <p className="font-medium">Drop files to attach</p>
              </div>
              <p className="text-sm text-indigo-500 mt-1">
                Supports images, documents, and more
              </p>
            </div>
          )}
          <div className="relative">
            <div
              className={`rounded-xl bg-white border-2 shadow-[0_2px_0_#E5E7EB] font-medium transition-all duration-300 focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-600 ${
                isDragging
                  ? 'border-indigo-200 shadow-[0_4px_12px_rgba(99,102,241,0.15)]'
                  : 'border-gray-200'
              }`}
            >
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                onPaste={handlePaste}
                placeholder="Tweet about..."
                className="w-full px-4 py-3 outline-none min-h-[4.5rem] text-base border-0 bg-transparent resize-none focus:ring-0 focus:outline-none"
                disabled={disabled}
              />

              <div className="flex items-center justify-between px-3 pb-3 mt-2">
                <div className="flex gap-1.5 items-center">
                  <FileUploadTrigger asChild>
                    <Button type="button" variant="secondary" size="icon">
                      <Paperclip className="text-stone-600 size-5" />
                    </Button>
                  </FileUploadTrigger>

                  <KnowledgeSelector onSelectDocument={handleAddKnowledgeDoc} />
                </div>

                {disabled ? (
                  <Button
                    onClick={onStop}
                    variant="default"
                    size="icon"
                    aria-label="Stop message"
                  >
                    <Square className="size-3 fill-white" />
                  </Button>
                ) : (
                  <Button
                    disabled={hasUploading || !message.trim()}
                    onClick={handleSubmit}
                    variant="default"
                    size="icon"
                    aria-label="Send message"
                  >
                    <ArrowUp className="size-5" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function AppSidebar({ children }: { children: React.ReactNode }) {
  const { toggleSidebar } = useSidebar()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)

  const { data: chatConversations, isPending: isHistoryPending } = trpc.chat.history.useQuery(
    undefined,
    {
      enabled: isHistoryOpen,
    }
  )

  const { 
    messages, 
    status,
    sendMessage, 
    startNewChat,
    id,
    setId,
    stop
  } = useChatContext()
  
  const { attachments, removeAttachment, addChatAttachment } = useAttachments()

  const updateURL = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(window.location.search)
      params.set(key, value)
      router.replace(`${window.location.pathname}?${params.toString()}`, {
        scroll: false,
      })
    },
    [router],
  )

  const handleSubmit = useCallback(
    async (text: string) => {
      if (!text.trim()) return

      if (!Boolean(searchParams.get('chatId'))) {
        updateURL('chatId', id)
      }

      // Properly narrow to Attachment[] (exclude uploading chat files)
      const normalized: Attachment[] = attachments.flatMap((a) => {
        if (a.variant === 'knowledge') return [a as Attachment]
        if (a.variant === 'chat' && 'fileKey' in (a as any) && (a as any).fileKey && !(a as any).isUploading) {
          return [a as Attachment]
        }
        return []
      })

      sendMessage({ text, metadata: { attachments: normalized, userMessage: text } })

      if (attachments.length > 0) {
        requestAnimationFrame(() => {
          attachments.forEach((a) => {
            removeAttachment({ id: a.id })
          })
        })
      }
    },
    [searchParams, updateURL, id, sendMessage, attachments, removeAttachment],
  )

  const handleNewChat = useCallback(() => {
    startNewChat()
  }, [startNewChat])

  const handleFilesAdded = useCallback(
    (files: File[]) => {
      files.forEach(addChatAttachment)
    },
    [addChatAttachment],
  )

  const utils = trpc.useUtils()

  const handleChatSelect = async (chatId: string) => {
    setIsHistoryOpen(false)
    
    // Invalidate the current chat messages query to ensure fresh data
    await utils.chat.get_message_history.invalidate()
    
    await setId(chatId)
    updateURL('chatId', chatId)
  }

  return (
    <>
      {children}

      <Sidebar side="right" collapsible="offcanvas">
        <SidebarHeader className="flex flex-col border-b border-stone-200 bg-stone-100 items-center justify-end gap-2 px-4">
          <div className="w-full flex items-center justify-between">
            <p className="text-sm/6 font-medium">Assistant</p>
            <div className="flex gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={handleNewChat}
                      size="sm"
                      variant="secondary"
                      className="inline-flex items-center gap-1.5"
                    >
                      <Plus className="size-4" />
                      <p className="text-sm">New Chat</p>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Start a new conversation</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={() => setIsHistoryOpen(true)}
                      size="icon"
                      variant="secondary"
                      className="aspect-square"
                    >
                      <History className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Open chat history</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={toggleSidebar}
                      variant="secondary"
                      className="aspect-square"
                      size="icon"
                    >
                      <X className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Close sidebar</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent className="relative h-full py-0 bg-gray-50 bg-opacity-25">
          {messages.length === 0 ? (
            <div className="absolute z-10 p-3 pb-5 inset-x-0 bottom-0">
              <p className="text-sm text-gray-500 mb-2">Examples</p>
              <div className="space-y-2">
                <PromptSuggestion
                  onClick={() => {
                    handleSubmit('Help me create a viral tweet about productivity tips for remote workers')
                  }}
                >
                  Create a viral tweet about productivity tips
                </PromptSuggestion>

                <PromptSuggestion
                  onClick={() => {
                    handleSubmit('Write a Twitter thread explaining AI in simple terms for beginners')
                  }}
                >
                  Write a Twitter thread about AI for beginners
                </PromptSuggestion>

                <PromptSuggestion
                  onClick={() => {
                    handleSubmit('Help me craft a tweet about overcoming imposter syndrome in tech')
                  }}
                >
                  Tweet about overcoming imposter syndrome
                </PromptSuggestion>

                <PromptSuggestion
                  onClick={() => {
                    handleSubmit('Suggest tweets about the latest trends in web development')
                  }}
                >
                  Tweet about web development trends
                </PromptSuggestion>
              </div>
            </div>
          ) : null}

          <SidebarGroup className="h-full py-0 px-0">
            <div className="h-full space-y-6">
              <Messages status={status} messages={messages} />
            </div>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="relative p-3 border-t border-t-gray-300 bg-gray-100">
          <FileUpload onFilesAdded={handleFilesAdded}>
            <ChatInput2
              onStop={stop}
              onSubmit={handleSubmit}
              handleFilesAdded={handleFilesAdded}
              disabled={status === 'submitted' || status === 'streaming'}
            />
          </FileUpload>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="bg-white rounded-2xl p-6 max-w-2xl max-h-[80vh] overflow-hidden">
          <div className="size-12 bg-gray-100 rounded-full flex items-center justify-center">
            <History className="size-6" />
          </div>
          <DialogHeader className="py-2">
            <DialogTitle className="text-lg font-semibold leading-6">
              Chat History
            </DialogTitle>
            <DialogDescription className="leading-none">
              {isHistoryPending
                ? 'Loading...'
                : chatConversations?.chatHistory?.length
                  ? `Showing ${chatConversations?.chatHistory?.length} most recent chats`
                  : 'No chat history yet'}
            </DialogDescription>
          </DialogHeader>

          {
            <div className="overflow-y-auto max-h-[60vh] -mx-2 px-2">
              <div className="space-y-2">
                {chatConversations?.chatHistory?.length ? (
                  chatConversations.chatHistory.map((chat) => (
                    <button
                      key={chat.id}
                      onClick={() => handleChatSelect(chat.id)}
                      className="w-full text-left p-4 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm text-gray-900 truncate">
                            {chat.title}
                          </h3>
                        </div>
                        <span className="text-xs text-gray-400 whitespace-nowrap">
                          {formatDistanceToNow(new Date(chat.lastUpdated), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p className="text-sm">No chat history yet</p>
                    <p className="text-xs mt-1">Start a conversation to see it here</p>
                  </div>
                )}
              </div>
            </div>
          }
        </DialogContent>
      </Dialog>
    </>
  )
}