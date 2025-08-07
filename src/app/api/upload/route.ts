import { PutObjectCommand } from '@aws-sdk/client-s3'
import { r2Client, R2_BUCKET_NAME } from '@/lib/r2'
import { nanoid } from 'nanoid'
import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return Response.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!R2_BUCKET_NAME) {
      return Response.json({ error: 'R2 bucket not configured' }, { status: 500 })
    }
    
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    
    // Generate unique key
    const ext = file.name.split('.').pop() || 'bin'
    const key = `uploads/${nanoid()}.${ext}`
    
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: file.type,
    })
    
    await r2Client.send(command)
    
    return Response.json({ success: true, key })
  } catch (error) {
    console.error('Upload error:', error)
    return Response.json({ error: 'Upload failed' }, { status: 500 })
  }
}