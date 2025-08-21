import { db } from '@/db'
import { knowledgeDocument } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { TAttachment } from '../chat'

export interface ParsedAttachments {
  links: Array<{ link: string; content?: string }>
  attachments: Array<{ type: string; text?: string; title?: string }>
}

// Parse attachments based on ContentPort's working implementation
export async function parseAttachments({
  attachments = [],
  userId,
}: {
  attachments?: Array<TAttachment>
  userId: string
}): Promise<ParsedAttachments> {
  const links: Array<{ link: string; content?: string }> = []
  const parsedAttachments: Array<{ type: string; text?: string; title?: string }> = []

  if (!attachments || attachments.length === 0) {
    return { links, attachments: parsedAttachments }
  }

  console.log('🔍 Processing attachments:', attachments.length, 'items')

  for (const attachment of attachments) {
    console.log('📎 Processing attachment:', attachment.id, attachment.variant, attachment.type)

    if (attachment.variant === 'knowledge') {
      // Handle knowledge documents - query database directly
      try {
        const [document] = await db
          .select()
          .from(knowledgeDocument)
          .where(eq(knowledgeDocument.id, attachment.id))
          .limit(1)
        
        if (document) {
          console.log('📄 Knowledge document found:', document.title, 'type:', document.type)
          
          if (document.type === 'url' && document.sourceUrl) {
            // For URL knowledge documents, add as link with content
            const content = (document.metadata as any)?.content || document.description || ''
            links.push({
              link: document.sourceUrl,
              content: content
            })
            console.log('🔗 Added URL link with content length:', content.length)
          } else {
            // For other knowledge documents, add as text attachment
            const content = (document.metadata as any)?.content || document.description || ''
            if (content) {
              parsedAttachments.push({
                type: 'knowledge',
                title: document.title!,
                text: content.slice(0, 8000), // Limit to 8000 chars
              })
              console.log('📝 Added knowledge doc with content length:', content.length)
            } else {
              console.warn('⚠️  Knowledge document has no content:', document.title)
            }
          }
        } else {
          console.warn('⚠️  Knowledge document not found:', attachment.id)
        }
      } catch (error) {
        console.error('❌ Failed to load knowledge document:', attachment.id, error)
      }
    } else if (attachment.variant === 'chat') {
      // Handle chat attachments
      if (attachment.type === 'url') {
        // For URL chat attachments, use title as the link
        if (attachment.title) {
          links.push({ link: attachment.title })
          console.log('🔗 Added chat URL:', attachment.title)
        }
      } else if (attachment.fileKey) {
        // Handle file attachments - for now, just log (would need R2/file system integration)
        try {
          let fileContent = ''
          
          if (attachment.type === 'txt') {
            // For text files, we should fetch the content from R2/file system
            // For now, using title as placeholder - this needs file fetching implementation
            fileContent = attachment.title || ''
            console.log('📁 Text file attachment (using title for now):', attachment.title)
          } else if (attachment.type === 'pdf' || attachment.type === 'docx') {
            // For other document types, we'd need proper file processing
            // This should be implemented with file readers
            console.log('📄 Document file attachment (needs processing):', attachment.title)
          }
          
          if (fileContent) {
            parsedAttachments.push({
              type: attachment.type,
              title: attachment.title,
              text: fileContent.slice(0, 8000), // Limit to 8000 chars
            })
          }
        } catch (error) {
          console.error('❌ Failed to process file attachment:', attachment.fileKey, error)
        }
      }
    }
  }

  console.log('✅ Parsing complete. Links:', links.length, 'Attachments:', parsedAttachments.length)
  return { links, attachments: parsedAttachments }
}