'use client'

import { ArrowUp, History, Paperclip, Plus, Square, X, Zap, MessageSquare, Twitter, TrendingUp, Target, Sparkles } from 'lucide-react'
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
import PlaceholderPlugin from './ui/placeholder-plugin'

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

  const { 
    attachments, 
    removeAttachment, 
    addKnowledgeAttachment, 
    hasUploading,
    hasImageAttachments,
    getThreadRelevantAttachments 
  } = useAttachments()

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
                onRemove={onRemove}
                key={attachment.id}
                attachment={attachment}
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
                ErrorBoundary={LexicalErrorBoundary}
              />
              <PlaceholderPlugin 
                placeholder="Ask to generate threads or tweets..." 
                threadOptimized={true}
                showHints={true}
                className="text-gray-400"
              />
              <HistoryPlugin />

              <div className="flex items-center justify-between px-3 pb-3">
                <div className="flex gap-1.5 items-center">
                  <FileUploadTrigger asChild>
                    <Button type="button" variant="secondary" size="icon">
                      <Paperclip className="text-stone-600 size-5" />
                    </Button>
                  </FileUploadTrigger>

                  <KnowledgeSelector 
                    onSelectDocument={handleAddKnowledgeDoc}
                    threadContext={{
                      isGeneratingThread: true,
                      currentTopic: editor.read(() => $getRoot().getTextContent().trim()),
                      preferredTypes: ['txt', 'pdf', 'url']
                    }}
                  />
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
// const ChatInput = ({
//   onSubmit,
//   onStop,
//   disabled,
//   handleFilesAdded,
// }: {
//   onSubmit: (text: string) => void
//   onStop: () => void
//   disabled: boolean
//   handleFilesAdded: (files: File[]) => void
// }) => {
//   const [message, setMessage] = useState('')
//   const { isDragging } = useContext(FileUploadContext)

//   const { attachments, removeAttachment, addKnowledgeAttachment, hasUploading } =
//     useAttachments()

//   const handleSubmit = () => {
//     if (!message.trim()) return
//     onSubmit(message.trim())
//     setMessage('')
//   }

//   const handleKeyPress = (e: React.KeyboardEvent) => {
//     if (e.key === 'Enter' && !e.shiftKey) {
//       e.preventDefault()
//       handleSubmit()
//     }
//   }

//   const handleAddKnowledgeDoc = useCallback(
//     (doc: SelectedKnowledgeDocument) => {
//       addKnowledgeAttachment(doc)
//     },
//     [addKnowledgeAttachment],
//   )

//   const handlePaste = useCallback(
//     (e: React.ClipboardEvent) => {
//       const items = e.clipboardData?.items
//       if (!items) return

//       const files: File[] = []
//       Array.from(items).forEach((item) => {
//         if (item.kind === 'file') {
//           const file = item.getAsFile()
//           if (file) {
//             files.push(file)
//           }
//         }
//       })

//       if (files.length > 0) {
//         e.preventDefault()
//         handleFilesAdded(files)
//       }
//     },
//     [handleFilesAdded],
//   )

//   return (
//     <div>
//       <div className="mb-2 flex gap-2 items-center">
//         {attachments.map((attachment, i) => {
//           const onRemove = () => removeAttachment({ id: attachment.id })
//           return (
//             <motion.div
//               key={attachment.id}
//               initial={{ opacity: 0, y: 10 }}
//               animate={{ opacity: 1, y: 0 }}
//               exit={{ opacity: 0, y: 10 }}
//               transition={{ duration: 0.2, delay: i * 0.1 }}
//             >
//               <AttachmentItem
//                 onRemove={onRemove}
//                 key={attachment.id}
//                 attachment={attachment}
//               />
//             </motion.div>
//           )
//         })}
//       </div>

//       <div className="space-y-3">
//         <div
//           className={`relative transition-all rounded-xl duration-300 ease-out ${
//             isDragging ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-gray-100' : ''
//           }`}
//         >
//           {isDragging && (
//             <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-indigo-50/90 to-blue-50/90 backdrop-blur-md rounded-xl z-20 border-2 border-dashed border-indigo-300">
//               <div className="flex items-center gap-2 text-indigo-700">
//                 <Paperclip className="size-5" />
//                 <p className="font-medium">Drop files to attach</p>
//               </div>
//               <p className="text-sm text-indigo-500 mt-1">
//                 Supports images, documents, and more
//               </p>
//             </div>
//           )}
//           <div className="relative">
//             <div
//               className={`rounded-xl bg-white border-2 shadow-[0_2px_0_#E5E7EB] font-medium transition-all duration-300 focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-600 ${
//                 isDragging
//                   ? 'border-indigo-200 shadow-[0_4px_12px_rgba(99,102,241,0.15)]'
//                   : 'border-gray-200'
//               }`}
//             >
//               <Input
//                 value={message}
//                 onChange={(e) => setMessage(e.target.value)}
//                 onKeyDown={handleKeyPress}
//                 onPaste={handlePaste}
//                 placeholder="Tweet about..."
//                 className="w-full px-4 py-3 outline-none min-h-[4.5rem] text-base border-0 bg-transparent resize-none focus:ring-0 focus:outline-none"
//                 disabled={disabled}
//               />

//               <div className="flex items-center justify-between px-3 pb-3 mt-2">
//                 <div className="flex gap-1.5 items-center">
//                   <FileUploadTrigger asChild>
//                     <Button type="button" variant="secondary" size="icon">
//                       <Paperclip className="text-stone-600 size-5" />
//                     </Button>
//                   </FileUploadTrigger>

//                   <KnowledgeSelector onSelectDocument={handleAddKnowledgeDoc} />
//                 </div>

//                 {disabled ? (
//                   <Button
//                     onClick={onStop}
//                     variant="default"
//                     size="icon"
//                     aria-label="Stop message"
//                   >
//                     <Square className="size-3 fill-white" />
//                   </Button>
//                 ) : (
//                   <Button
//                     disabled={hasUploading || !message.trim()}
//                     onClick={handleSubmit}
//                     variant="default"
//                     size="icon"
//                     aria-label="Send message"
//                   >
//                     <ArrowUp className="size-5" />
//                   </Button>
//                 )}
//               </div>
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   )
// }

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
        <SidebarHeader className="flex flex-col border-b border-gray-200 bg-white items-center justify-end gap-3 px-4 py-4">
          {/* Enhanced header with thread context */}
          <div className="w-full flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-sm">
                <MessageSquare className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">AI Assistant</p>
                <p className="text-xs text-gray-500">Thread & Tweet Generator</p>
              </div>
            </div>
            <div className="flex gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={() => setIsHistoryOpen(true)}
                      size="icon"
                      variant="ghost"
                      className="w-8 h-8"
                    >
                      <History className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Chat history</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={toggleSidebar}
                      variant="ghost"
                      size="icon"
                      className="w-8 h-8"
                    >
                      <X className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Close assistant</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          {/* Thread generation quick actions */}
          <div className="w-full grid grid-cols-2 gap-2">
            <Button
              onClick={handleNewChat}
              size="sm"
              variant="outline"
              className="h-9 gap-1.5 text-xs"
            >
              <Plus className="size-3" />
              New Chat
            </Button>
            <Button
              onClick={() => {
                handleSubmit('Generate a Twitter thread about the latest trends in AI and technology')
              }}
              size="sm"
              variant="default"
              className="h-9 gap-1.5 text-xs bg-blue-600 hover:bg-blue-700"
            >
              <Zap className="size-3" />
              Generate Thread
            </Button>
          </div>
        </SidebarHeader>
        <SidebarContent className="relative h-full py-0 bg-gray-50/30">
          {messages.length === 0 ? (
            <div className="absolute z-10 p-4 pb-5 inset-x-0 bottom-0">
              {/* Thread-focused examples */}
              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="size-4 text-blue-600" />
                    <p className="text-sm font-medium text-gray-900">Thread Ideas</p>
                  </div>
                  <div className="space-y-2">
                    <PromptSuggestion
                      onClick={() => {
                        handleSubmit('Create a Twitter thread about the future of AI and its impact on different industries')
                      }}
                      icon={<TrendingUp className="size-3" />}
                    >
                      AI's impact on industries
                    </PromptSuggestion>

                    <PromptSuggestion
                      onClick={() => {
                        handleSubmit('Generate a thread about productivity hacks for remote workers with actionable tips')
                      }}
                      icon={<Target className="size-3" />}
                    >
                      Remote productivity hacks
                    </PromptSuggestion>

                    <PromptSuggestion
                      onClick={() => {
                        handleSubmit('Write a thread about building a personal brand on social media step by step')
                      }}
                      icon={<Sparkles className="size-3" />}
                    >
                      Personal branding guide
                    </PromptSuggestion>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Twitter className="size-4 text-blue-500" />
                    <p className="text-sm font-medium text-gray-900">Single Tweets</p>
                  </div>
                  <div className="space-y-2">
                    <PromptSuggestion
                      onClick={() => {
                        handleSubmit('Create a viral tweet about overcoming imposter syndrome in tech')
                      }}
                    >
                      Imposter syndrome advice
                    </PromptSuggestion>

                    <PromptSuggestion
                      onClick={() => {
                        handleSubmit('Write an engaging tweet about the latest web development trends')
                      }}
                    >
                      Web dev trends
                    </PromptSuggestion>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <SidebarGroup className="h-full py-0 px-0">
            <div className="h-full space-y-6">
              <Messages status={status} messages={messages} />
            </div>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="relative p-4 border-t border-gray-200 bg-white">
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
          <div className="flex items-center gap-3">
            <div className="size-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <History className="size-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold leading-6 text-gray-900">
                Chat History
              </DialogTitle>
              <DialogDescription className="text-sm text-gray-500">
                {isHistoryPending
                  ? 'Loading conversations...'
                  : chatConversations?.chatHistory?.length
                    ? `${chatConversations?.chatHistory?.length} conversation${chatConversations?.chatHistory?.length === 1 ? '' : 's'}`
                    : 'No conversations yet'}
              </DialogDescription>
            </div>
          </div>

          <div className="overflow-y-auto max-h-[60vh] -mx-2 px-2 mt-4">
            <div className="space-y-2">
              {chatConversations?.chatHistory?.length ? (
                chatConversations.chatHistory.map((chat) => (
                  <button
                    key={chat.id}
                    onClick={() => handleChatSelect(chat.id)}
                    className="w-full text-left p-4 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all duration-200 group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-sm text-gray-900 truncate group-hover:text-blue-900">
                            {chat.title}
                          </h3>
                          {/* Thread indicator */}
                          {chat.lastMessage?.includes('---') && (
                            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                              <Zap className="size-2" />
                              Thread
                            </div>
                          )}
                        </div>
                        {chat.lastMessage && (
                          <p className="text-xs text-gray-500 line-clamp-1 leading-relaxed">
                            {chat.lastMessage.slice(0, 80)}{chat.lastMessage.length > 80 ? '...' : ''}
                          </p>
                        )}
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
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <MessageSquare className="size-8 text-gray-400" />
                  </div>
                  <p className="text-gray-600 font-medium mb-1">No conversations yet</p>
                  <p className="text-sm text-gray-500">Start chatting to generate threads and tweets</p>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}