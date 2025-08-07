import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { r2Client, R2_BUCKET_NAME } from '@/lib/r2'
import { nanoid } from 'nanoid'
import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { filename, contentType } = await request.json()
    
    if (!R2_BUCKET_NAME) {
      return Response.json({ error: 'R2 bucket not configured' }, { status: 500 })
    }

    // Generate unique key
    const ext = filename.split('.').pop() || 'bin'
    const key = `uploads/${nanoid()}.${ext}`
    
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    })
    
    const signedUrl = await getSignedUrl(r2Client, command, {
      expiresIn: 3600, // 1 hour
    })
    
    return Response.json({ url: signedUrl, key })
  } catch (error) {
    console.error('Error generating presigned URL:', error)
    return Response.json({ error: 'Failed to generate upload URL' }, { status: 500 })
  }
}