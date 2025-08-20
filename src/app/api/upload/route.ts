import { PutObjectCommand } from '@aws-sdk/client-s3'
import { r2Client, R2_BUCKET_NAME } from '@/lib/r2'
import { nanoid } from 'nanoid'
import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    console.log(`🚀 [API-UPLOAD] ========== R2 UPLOAD DEBUG ==========`)
    
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      console.log(`❌ [API-UPLOAD] No file provided`)
      return Response.json({ error: 'No file provided' }, { status: 400 })
    }

    console.log(`📄 [API-UPLOAD] File details:`, {
      name: file.name,
      type: file.type,
      size: file.size,
      lastModified: file.lastModified
    })

    // Enforce allowed types only
    const allowedTypes = new Set(['image/png', 'image/jpeg'])
    if (!allowedTypes.has(file.type)) {
      console.log(`❌ [API-UPLOAD] Disallowed content type: ${file.type}`)
      return Response.json({ error: 'Only PNG or JPEG images are allowed' }, { status: 400 })
    }

    if (!R2_BUCKET_NAME) {
      console.log(`❌ [API-UPLOAD] R2 bucket not configured`)
      return Response.json({ error: 'R2 bucket not configured' }, { status: 500 })
    }
    
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    
    // Generate unique key - preserve original extension from filename
    const originalExt = file.name.split('.').pop()?.toLowerCase() || 'bin'
    console.log(`🔍 [API-UPLOAD] Original file extension: "${originalExt}"`)
    console.log(`🔍 [API-UPLOAD] File type from browser: "${file.type}"`)
    
    // Use proper extension based on actual file type
    let correctExt = originalExt
    if (file.type === 'image/png') correctExt = 'png'
    else if (file.type === 'image/jpeg') correctExt = 'jpg'
    
    const key = `uploads/${nanoid()}.${correctExt}`
    console.log(`🎯 [API-UPLOAD] Using corrected extension: "${correctExt}"`)
    
    console.log(`🔑 [API-UPLOAD] Generated R2 key: "${key}"`)
    console.log(`📋 [API-UPLOAD] Setting ContentType: "${file.type}"`)
    
    // Sanitize filename for HTTP header - remove/replace invalid characters
    const sanitizedFilename = file.name
      .replace(/[^\w\-_.]/g, '-') // Replace non-alphanumeric chars (except dash, underscore, dot) with dash
      .replace(/-+/g, '-') // Replace multiple consecutive dashes with single dash
      .replace(/^-|-$/g, '') // Remove leading/trailing dashes
    
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: file.type,
      // Add cache control and metadata for better identification
      CacheControl: 'max-age=31536000',
      Metadata: {
        'original-filename': sanitizedFilename,
        'upload-timestamp': Date.now().toString(),
        'content-type-original': file.type
      }
    })
    
    console.log(`📤 [API-UPLOAD] Uploading to R2...`)
    await r2Client.send(command)
    console.log(`✅ [API-UPLOAD] R2 upload successful`)
    
    return Response.json({ success: true, key })
  } catch (error) {
    console.error('Upload error:', error)
    return Response.json({ error: 'Upload failed' }, { status: 500 })
  }
}