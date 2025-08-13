'use client'

import { createContext, useContext, useState, useCallback, PropsWithChildren } from 'react'
import { nanoid } from 'nanoid'
import type { 
  Attachment, 
  ChatAttachment, 
  KnowledgeAttachment 
} from '@/types/chat'
import { SelectedKnowledgeDocument } from '@/components/knowledge-selector'
import toast from 'react-hot-toast'

// Remove LocalAttachment - use ChatAttachment directly

interface AttachmentsContextType {
  // State
  attachments: Attachment[]
  hasUploading: boolean
  
  // Actions
  addChatAttachment: (file: File) => void
  addKnowledgeAttachment: (doc: SelectedKnowledgeDocument) => void
  addVideoAttachment: (fileKey: string, title: string) => void
  removeAttachment: (params: { id: string }) => void
  clearAttachments: () => void
  
  // Utils
  getAttachmentById: (id: string) => Attachment | undefined
  getAttachmentsByType: (type: Attachment['type']) => Attachment[]
}

const AttachmentsContext = createContext<AttachmentsContextType | null>(null)

// File type detection
function detectFileType(file: File): Attachment['type'] {
  const mimeType = file.type.toLowerCase()
  const extension = file.name.split('.').pop()?.toLowerCase()

  if (mimeType.startsWith('image/')) {
    return 'image'
  }
  
  if (mimeType.startsWith('video/')) {
    return 'video'
  }

  if (mimeType === 'application/pdf' || extension === 'pdf') {
    return 'pdf'
  }

  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    extension === 'docx'
  ) {
    return 'docx'
  }

  if (mimeType === 'text/plain' || extension === 'txt') {
    return 'txt'
  }

  // Default to manual for unknown types
  return 'manual'
}

// File size validation
function validateFileSize(file: File): boolean {
  const maxSize = 50 * 1024 * 1024 // 50MB
  return file.size <= maxSize
}

// File upload function
async function uploadFile(file: File): Promise<{ fileKey: string; uploadProgress: number }> {
  return new Promise((resolve, reject) => {
    const formData = new FormData()
    formData.append('file', file)

    const xhr = new XMLHttpRequest()

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const progress = Math.round((e.loaded / e.total) * 100)
        // Update progress would need to be handled by caller
      }
    })

    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        try {
          const response = JSON.parse(xhr.responseText)
          resolve({
            fileKey: response.key || response.fileKey,
            uploadProgress: 100,
          })
        } catch (error) {
          reject(new Error('Invalid response format'))
        }
      } else {
        reject(new Error(`Upload failed with status: ${xhr.status}`))
      }
    })

    xhr.addEventListener('error', () => {
      reject(new Error('Upload failed'))
    })

    xhr.open('POST', '/api/upload')
    xhr.send(formData)
  })
}

export function AttachmentsProvider({ children }: PropsWithChildren) {
  const [attachments, setAttachments] = useState<Attachment[]>([])

  // Check if any attachments are currently uploading
  const hasUploading = attachments.some(
    (attachment) => 
      attachment.variant === 'chat' && attachment.isUploading
  )

  // Add chat attachment (file upload)
  const addChatAttachment = useCallback(async (file: File) => {
    // Validate file size
    if (!validateFileSize(file)) {
      toast.error('File size must be less than 50MB')
      return
    }

    const id = nanoid()
    const type = detectFileType(file)
    
    // Create initial attachment with uploading state
    const attachment: ChatAttachment = {
      id,
      title: file.name,
      type,
      variant: 'chat',
      // fileKey is optional during upload
      uploadProgress: 0,
      isUploading: true,
    }

    // Add to state immediately
    setAttachments(prev => [...prev, attachment])

    try {
      // Upload file
      const { fileKey } = await uploadFile(file)
      
      // Update attachment with success
      setAttachments(prev => prev.map(att => 
        att.id === id 
          ? { ...att, fileKey, uploadProgress: 100, isUploading: false }
          : att
      ))

      toast.success(`${file.name} uploaded successfully`)
    } catch (error: any) {
      console.error('Upload failed:', error)
      
      // Update attachment with error
      setAttachments(prev => prev.map(att => 
        att.id === id 
          ? { ...att, isUploading: false, error: error.message || 'Upload failed' }
          : att
      ))

      toast.error(`Failed to upload ${file.name}`)
    }
  }, [])

  // Add knowledge attachment (existing document/content)
  const addKnowledgeAttachment = useCallback((doc: SelectedKnowledgeDocument) => {
    const attachment: KnowledgeAttachment = {
      id: doc.id,
      title: doc.title,
      type: doc.type,
      variant: 'knowledge',
      content: doc.description,
    }

    setAttachments(prev => {
      // Check if already exists
      const exists = prev.some(att => att.id === doc.id)
      
      if (exists) {
        toast.error('This document is already attached')
        return prev
      }

      return [...prev, attachment]
    })

    toast.success(`${doc.title} added to chat`)
  }, [])

  // Add video attachment (for transcription)
  const addVideoAttachment = useCallback((fileKey: string, title: string) => {
    const attachment: ChatAttachment = {
      id: nanoid(),
      title,
      type: 'video',
      variant: 'chat',
      fileKey,
      uploadProgress: 100,
      isUploading: false,
    }

    setAttachments(prev => {
      // Check if already exists
      const exists = prev.some(att => 
        att.variant === 'chat' && 
        'fileKey' in att && 
        att.fileKey === fileKey
      )
      
      if (exists) {
        toast.error('This video is already attached')
        return prev
      }

      return [...prev, attachment]
    })

    toast.success('Video added to chat for transcription')
  }, [])

  // Remove attachment
  const removeAttachment = useCallback(({ id }: { id: string }) => {
    setAttachments(prev => {
      const attachment = prev.find(att => att.id === id)
      if (attachment) {
        toast.success(`${attachment.title} removed`)
      }
      return prev.filter(att => att.id !== id)
    })
  }, [])

  // Clear all attachments
  const clearAttachments = useCallback(() => {
    setAttachments([])
  }, [])

  // Get attachment by ID
  const getAttachmentById = useCallback((id: string) => {
    return attachments.find(att => att.id === id)
  }, [attachments])

  // Get attachments by type
  const getAttachmentsByType = useCallback((type: Attachment['type']) => {
    return attachments.filter(att => att.type === type)
  }, [attachments])

  const contextValue: AttachmentsContextType = {
    attachments,
    hasUploading,
    addChatAttachment,
    addKnowledgeAttachment,
    addVideoAttachment,
    removeAttachment,
    clearAttachments,
    getAttachmentById,
    getAttachmentsByType,
  }

  return (
    <AttachmentsContext.Provider value={contextValue}>
      {children}
    </AttachmentsContext.Provider>
  )
}

export function useAttachments(): AttachmentsContextType {
  const context = useContext(AttachmentsContext)
  
  if (!context) {
    throw new Error('useAttachments must be used within an AttachmentsProvider')
  }
  
  return context
}

// Hook for handling file drops and paste
export function useFileHandler() {
  const { addChatAttachment } = useAttachments()

  // Handle file drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    const files = Array.from(e.dataTransfer.files)
    files.forEach(addChatAttachment)
  }, [addChatAttachment])

  // Handle paste event
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData?.items || [])
    
    const files = items
      .filter(item => item.kind === 'file')
      .map(item => item.getAsFile())
      .filter((file): file is File => file !== null)
    
    if (files.length > 0) {
      e.preventDefault()
      files.forEach(addChatAttachment)
    }
  }, [addChatAttachment])

  // Handle file input change
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    files.forEach(addChatAttachment)
    
    // Reset input value
    e.target.value = ''
  }, [addChatAttachment])

  return {
    handleDrop,
    handlePaste,
    handleFileSelect,
  }
}