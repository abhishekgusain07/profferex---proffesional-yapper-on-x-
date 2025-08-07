#!/usr/bin/env node

/**
 * Apply CORS policy to R2 bucket using wrangler CLI
 * Usage: node scripts/apply-cors-policy.js [cors-policy-file] [bucket-name]
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

function checkWranglerInstalled() {
  try {
    execSync('wrangler --version', { stdio: 'pipe' })
    return true
  } catch (error) {
    return false
  }
}

function validateCorsPolicy(policyPath) {
  if (!fs.existsSync(policyPath)) {
    throw new Error(`CORS policy file not found: ${policyPath}`)
  }

  try {
    const content = fs.readFileSync(policyPath, 'utf8')
    const policy = JSON.parse(content)
    
    if (!Array.isArray(policy) || policy.length === 0) {
      throw new Error('CORS policy must be an array with at least one rule')
    }

    const rule = policy[0]
    if (!rule.AllowedOrigins || !Array.isArray(rule.AllowedOrigins)) {
      throw new Error('CORS policy must have AllowedOrigins as an array')
    }

    return policy
  } catch (error) {
    throw new Error(`Invalid CORS policy JSON: ${error.message}`)
  }
}

function applyCorsPolicyToR2(policyPath, bucketName) {
  console.log(`🔄 Applying CORS policy to R2 bucket: ${bucketName}`)
  console.log(`📄 Using policy file: ${policyPath}`)

  try {
    const command = `wrangler r2 bucket cors put ${bucketName} --file ${policyPath}`
    console.log(`🚀 Running: ${command}`)
    
    const result = execSync(command, { 
      stdio: ['inherit', 'pipe', 'pipe'],
      encoding: 'utf8' 
    })
    
    console.log('✅ CORS policy applied successfully!')
    if (result.trim()) {
      console.log('Output:', result)
    }

    // Verify the policy was applied
    console.log('\n🔍 Verifying CORS policy...')
    const listCommand = `wrangler r2 bucket cors list ${bucketName}`
    const listResult = execSync(listCommand, { 
      stdio: ['inherit', 'pipe', 'pipe'], 
      encoding: 'utf8' 
    })
    
    console.log('📋 Current CORS policy:')
    console.log(listResult)

  } catch (error) {
    console.error('❌ Failed to apply CORS policy:', error.message)
    console.error('💡 Make sure:')
    console.error('   1. wrangler is installed and authenticated')
    console.error('   2. You have permission to modify the R2 bucket')
    console.error('   3. The bucket name is correct')
    process.exit(1)
  }
}

function main() {
  const policyFile = process.argv[2] || 'cors-policy.json'
  const bucketName = process.argv[3] || process.env.R2_BUCKET_NAME
  
  if (!bucketName) {
    console.error('❌ Bucket name is required. Provide it as argument or set R2_BUCKET_NAME environment variable')
    process.exit(1)
  }

  if (!checkWranglerInstalled()) {
    console.error('❌ wrangler CLI is not installed or not in PATH')
    console.error('💡 Install with: npm install -g wrangler')
    process.exit(1)
  }

  const policyPath = path.resolve(policyFile)
  
  try {
    const policy = validateCorsPolicy(policyPath)
    console.log(`📋 CORS policy validated:`)
    console.log(`   - ${policy[0].AllowedOrigins.length} allowed origins`)
    console.log(`   - ${policy[0].AllowedMethods.length} allowed methods`)
    console.log(`   - ${policy[0].ExposeHeaders.length} exposed headers`)
    
    applyCorsPolicyToR2(policyPath, bucketName)
  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

module.exports = { applyCorsPolicyToR2, validateCorsPolicy }