#!/usr/bin/env node

/**
 * Generate CORS policy for R2 bucket based on environment variables
 * Usage: node scripts/generate-cors-policy.js [output-file]
 */

const fs = require('fs')
const path = require('path')

function generateCorsPolicy() {
  const allowedOrigins = [
    'http://localhost:3000',
    'https://localhost:3000',
    'http://localhost:3001', 
    'https://localhost:3001',
  ]

  // Add production URL if available
  if (process.env.NEXT_PUBLIC_APP_URL) {
    const prodUrl = process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '') // Remove trailing slash
    if (!allowedOrigins.includes(prodUrl)) {
      allowedOrigins.push(prodUrl)
    }
  }

  // Add custom origins from environment
  if (process.env.CORS_ALLOWED_ORIGINS) {
    const customOrigins = process.env.CORS_ALLOWED_ORIGINS.split(',').map(o => o.trim())
    customOrigins.forEach(origin => {
      if (origin && !allowedOrigins.includes(origin)) {
        allowedOrigins.push(origin)
      }
    })
  }

  const corsPolicy = [
    {
      AllowedOrigins: allowedOrigins,
      AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
      AllowedHeaders: ['*'],
      ExposeHeaders: [
        'Content-Length',
        'Content-Type',
        'Content-Encoding',
        'Content-Disposition', 
        'ETag',
        'Last-Modified',
        'Cache-Control'
      ],
      MaxAgeSeconds: 3600
    }
  ]

  return corsPolicy
}

function main() {
  const outputFile = process.argv[2] || 'cors-policy.json'
  const outputPath = path.resolve(outputFile)
  
  try {
    const corsPolicy = generateCorsPolicy()
    const jsonContent = JSON.stringify(corsPolicy, null, 2)
    
    fs.writeFileSync(outputPath, jsonContent)
    console.log(`✅ CORS policy generated successfully: ${outputPath}`)
    console.log(`📄 Allowed origins:`)
    corsPolicy[0].AllowedOrigins.forEach(origin => {
      console.log(`   - ${origin}`)
    })
  } catch (error) {
    console.error('❌ Error generating CORS policy:', error.message)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

module.exports = { generateCorsPolicy }