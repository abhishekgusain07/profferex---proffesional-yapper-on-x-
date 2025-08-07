import { S3Client } from '@aws-sdk/client-s3'

const accountId = process.env.R2_ACCOUNT_ID
const accessKeyId = process.env.R2_ACCESS_KEY_ID
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY

export const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME
export const R2_ENDPOINT = process.env.R2_ENDPOINT || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined)

console.log('🔧 [R2] Environment Configuration:', {
  hasAccountId: !!accountId,
  hasAccessKeyId: !!accessKeyId,
  hasSecretAccessKey: !!secretAccessKey,
  bucketName: R2_BUCKET_NAME,
  endpoint: R2_ENDPOINT,
  nodeEnv: process.env.NODE_ENV,
})

if (!R2_BUCKET_NAME || !R2_ENDPOINT || !accessKeyId || !secretAccessKey) {
  const missingVars = []
  if (!accountId) missingVars.push('R2_ACCOUNT_ID')
  if (!accessKeyId) missingVars.push('R2_ACCESS_KEY_ID')
  if (!secretAccessKey) missingVars.push('R2_SECRET_ACCESS_KEY')
  if (!R2_BUCKET_NAME) missingVars.push('R2_BUCKET_NAME')
  
  console.error('❌ [R2] Configuration is incomplete. Missing:', missingVars.join(', '))
  
  if (process.env.NODE_ENV !== 'production') {
    console.warn('⚠️  [R2] R2 configuration is incomplete. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_ENDPOINT')
  }
}

const r2Config = {
  region: 'auto',
  endpoint: R2_ENDPOINT,
  // Use path-style URLs to avoid subdomain CORS issues
  forcePathStyle: true,
  credentials: {
    accessKeyId: accessKeyId || '',
    secretAccessKey: secretAccessKey || '',
  },
}

console.log('⚙️  [R2] S3 Client Configuration:', {
  ...r2Config,
  credentials: { ...r2Config.credentials, secretAccessKey: '[REDACTED]', }
})

export const r2Client = new S3Client(r2Config,) 