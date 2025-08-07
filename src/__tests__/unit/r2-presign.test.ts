import { filesRouter } from '@/trpc/routers/files'
import { createTRPCContext } from '@/trpc/init'
import * as presignMod from '@aws-sdk/s3-presigned-post'

// Mock env
process.env.R2_BUCKET_NAME = 'test-bucket'
process.env.R2_ENDPOINT = 'https://acc.r2.cloudflarestorage.com'
process.env.R2_ACCESS_KEY_ID = 'AKIA_TEST'
process.env.R2_SECRET_ACCESS_KEY = 'SECRET_TEST'

// Mock createPresignedPost
jest.spyOn(presignMod, 'createPresignedPost').mockImplementation(async () => {
  return {
    url: 'https://test-bucket.acc.r2.cloudflarestorage.com/test-bucket',
    fields: {
      key: 'user123/abc.png',
      'Content-Type': 'image/png',
      Policy: 'base64-policy',
      'X-Amz-Signature': 'sig',
    },
  } as any
})

describe('files.createPresignedPost', () => {
  const caller = filesRouter.createCaller as any

  const ctxBase = async () => {
    const ctx = await createTRPCContext()
    // Inject a fake user
    ;(ctx as any).user = { id: 'user123', email: 'u@example.com' }
    return ctx
  }

  it('returns URL and fields for valid image type', async () => {
    const ctx = await ctxBase()
    const res = await caller({ ctx }).createPresignedPost({ fileName: 'a.png', fileType: 'image/png' })
    expect(res.url).toContain('https://test-bucket.acc.r2.cloudflarestorage.com')
    expect(res.fields['Content-Type']).toBe('image/png')
    expect(typeof res.fields['Policy']).toBe('string')
    expect(typeof res.fields['X-Amz-Signature']).toBe('string')
    expect(res.key).toMatch(/user123\//)
  })

  it('rejects unsupported file type', async () => {
    const ctx = await ctxBase()
    await expect(
      caller({ ctx }).createPresignedPost({ fileName: 'a.exe', fileType: 'application/x-msdownload' })
    ).rejects.toThrow('Unsupported file type')
  })
}) 