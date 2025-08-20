import { CoreMessage } from 'ai'

// ==================== Attachment Types ====================

export interface BaseAttachment {
  id: string
  title?: string | null
  type: 'url' | 'txt' | 'docx' | 'pdf' | 'image' | 'manual' | 'video'
  variant: 'knowledge' | 'chat'
}

export interface ChatAttachment extends BaseAttachment {
  fileKey?: string // Optional during upload
  variant: 'chat'
  uploadProgress?: number
  isUploading?: boolean
  error?: string
  // Enhanced properties for thread support
  size?: number
  threadContext?: { isThreadGeneration?: boolean; threadId?: string }
  uploadStartTime?: number
}

export interface KnowledgeAttachment extends BaseAttachment {
  variant: 'knowledge'
  content?: string
}

export type Attachment = ChatAttachment | KnowledgeAttachment

// ==================== Message Types ====================

export interface MessageMetadata {
  attachments?: Attachment[]
  userMessage?: string
  editorContent?: string
  timestamp?: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  parts?: MessagePart[] // Add parts for AI SDK compatibility
  metadata?: MessageMetadata
  chatId: string
  createdAt: Date
  updatedAt?: Date
}

// ==================== AI Message Types ====================

export type AIMessageDataType = {
  'main-response': {
    text: string
    status: 'streaming' | 'complete'
  }
  'tool-output': {
    text: string
    status: 'processing' | 'streaming' | 'complete'
  }
  'data-tool-output': {
    text: string
    status: 'processing' | 'streaming' | 'complete'
  }
  'tweet-generation': {
    status: 'processing' | 'complete'
    tweet?: string
  }
}

// ==================== Message Parts for AI SDK ====================

export interface TextMessagePart {
  type: 'text'
  text: string
}

export interface DataToolOutputPart {
  type: 'data-tool-output'
  id: string
  data: {
    text: string
    status: 'processing' | 'streaming' | 'complete'
  }
}

export interface ToolReadWebsiteContentPart {
  type: 'tool-readWebsiteContent'
  state: 'input-available' | 'input-streaming' | 'complete'
  output?: {
    url: string
    title: string
    content: string
  }
}

export type MessagePart = TextMessagePart | DataToolOutputPart | ToolReadWebsiteContentPart

export interface ExtendedChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  parts: MessagePart[]
  metadata?: {
    attachments: Attachment[]
    userMessage?: string
  }
}

export type AIMessageToolType = {
  generateTweet: {
    input: { 
      prompt: string
      context?: string
      style?: 'casual' | 'professional' | 'witty' | 'informative'
    }
    output: {
      tweet: string
      explanation?: string
    }
  }
  readWebsiteContent: {
    input: { website_url: string }
    output: {
      url: string
      title: string
      content: string
    }
  }
}

// ==================== Chat Conversation Types ====================

export interface ChatConversation {
  id: string
  title: string
  userId: string
  createdAt: Date
  updatedAt: Date
  lastMessageAt: Date
  messageCount: number
}

export interface ChatHistoryItem {
  id: string
  title: string
  lastUpdated: string
  messageCount: number
  preview?: string
}

// ==================== Chat Context Types ====================

export interface ChatContextType {
  // Current conversation
  conversationId: string | null
  id: string // Current chat id for compatibility
  messages: ChatMessage[]
  
  // Chat state
  isLoading: boolean
  isStreaming: boolean
  status: 'idle' | 'loading'
  error: string | null
  
  // Actions
  sendMessage: (content: string, metadata?: MessageMetadata) => Promise<void>
  regenerateResponse: (messageId: string) => Promise<void>
  clearChat: () => void
  startNewConversation: () => void
  loadConversation: (id: string) => Promise<void>
  setId: (id: string) => Promise<void> // Add setId for compatibility
  
  // Message management
  deleteMessage: (messageId: string) => Promise<void>
  editMessage: (messageId: string, content: string) => Promise<void>
  
  // Stop streaming
  stop: () => void
  stopGeneration: () => void
}

// ==================== API Request/Response Types ====================

export interface SendMessageRequest {
  content: string
  conversationId?: string
  metadata?: MessageMetadata
}

export interface SendMessageResponse {
  conversationId: string
  message: ChatMessage
}

export interface GetConversationHistoryRequest {
  conversationId: string
  limit?: number
  offset?: number
}

export interface GetConversationHistoryResponse {
  messages: ChatMessage[]
  total: number
  hasMore: boolean
}

export interface GetConversationsRequest {
  limit?: number
  offset?: number
}

export interface GetConversationsResponse {
  conversations: ChatHistoryItem[]
  total: number
  hasMore: boolean
}

// ==================== Rate Limiting Types ====================

export interface RateLimitInfo {
  success: boolean
  limit: number
  remaining: number
  reset: number
}

// ==================== Tweet Generation Types ====================

export interface TweetGenerationRequest {
  prompt: string
  context?: string
  style?: 'casual' | 'professional' | 'witty' | 'informative'
  maxLength?: number
  includeHashtags?: boolean
}

export interface TweetGenerationResponse {
  tweet: string
  explanation?: string
  confidence: number
  suggestions?: string[]
}

// ==================== Error Types ====================

export interface ChatError {
  code: string
  message: string
  details?: any
}

export type ChatErrorCode = 
  | 'RATE_LIMIT_EXCEEDED'
  | 'INVALID_REQUEST'
  | 'CONVERSATION_NOT_FOUND'
  | 'MESSAGE_NOT_FOUND'
  | 'AI_SERVICE_ERROR'
  | 'ATTACHMENT_UPLOAD_FAILED'
  | 'UNAUTHORIZED'
  | 'SERVER_ERROR'

// ==================== UI State Types ====================

export interface ChatUIState {
  sidebarOpen: boolean
  activeConversationId: string | null
  isTyping: boolean
  showAttachments: boolean
  showHistory: boolean
  selectedMessages: string[]
}

// ==================== Configuration Types ====================

export interface ChatConfig {
  maxMessageLength: number
  maxAttachmentSize: number
  supportedFileTypes: string[]
  aiModel: string
  temperature: number
  maxTokens: number
}