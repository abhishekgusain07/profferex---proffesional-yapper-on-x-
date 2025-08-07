'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'

const messageSchema = z.object({
  message: z.string().min(1, 'Message is required').max(100, 'Message too long'),
  type: z.enum(['info', 'success', 'warning', 'error']).default('info'),
})

// Simple server action that processes form data
export async function submitMessage(formData: FormData) {
  const rawData = {
    message: formData.get('message'),
    type: formData.get('type') || 'info',
  }

  try {
    const validatedData = messageSchema.parse(rawData)
    
    // Here you would typically save to database
    // For now, just simulate processing
    console.log('Processing message:', validatedData)
    
    // Simulate some processing time
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Revalidate the current path to refresh data
    revalidatePath('/')
    
    return { 
      success: true, 
      data: {
        id: Math.random().toString(36).substr(2, 9),
        ...validatedData,
        timestamp: new Date().toISOString(),
      }
    }
  } catch (error) {
    console.error('Failed to process message:', error)
    
    if (error instanceof z.ZodError) {
      return { 
        success: false, 
        error: error.errors[0]?.message || 'Validation failed' 
      }
    }
    
    return { 
      success: false, 
      error: 'Failed to process message' 
    }
  }
}

// Another example - toggle feature
export async function toggleFeature(formData: FormData) {
  const featureName = formData.get('feature') as string
  const enabled = formData.get('enabled') === 'true'
  
  if (!featureName) {
    return { success: false, error: 'Feature name is required' }
  }
  
  // Here you would update feature flags in your database
  console.log(`Toggling feature ${featureName} to ${enabled}`)
  
  return { 
    success: true, 
    data: { 
      feature: featureName, 
      enabled: !enabled // Toggle the state
    } 
  }
}