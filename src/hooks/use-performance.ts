import { useEffect, useRef, useState } from 'react'

interface PerformanceMetrics {
  renderTime: number
  memoryUsage?: number
  componentCount: number
  lastUpdate: Date
}

interface SessionLoadingMetrics {
  sessionLoadTime: number
  pageLoadTime: number
  firstContentfulPaint: number
  timeToInteractive: number
}

export function usePerformanceMonitor(componentName: string, deps: any[] = []) {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    renderTime: 0,
    componentCount: 0,
    lastUpdate: new Date()
  })
  
  const renderStartTime = useRef<number>(0)
  const renderCount = useRef(0)

  useEffect(() => {
    renderStartTime.current = performance.now()
    renderCount.current++
  })

  useEffect(() => {
    if (renderStartTime.current) {
      const renderTime = performance.now() - renderStartTime.current
      
      setMetrics({
        renderTime,
        memoryUsage: (performance as any).memory?.usedJSHeapSize || 0,
        componentCount: renderCount.current,
        lastUpdate: new Date()
      })

      // Log performance in development
      if (process.env.NODE_ENV === 'development' && renderTime > 100) {
        console.warn(`🐌 Slow render detected in ${componentName}: ${renderTime.toFixed(2)}ms`)
      }
    }
  }, deps)

  return metrics
}

export function useMemoryMonitor() {
  const [memoryInfo, setMemoryInfo] = useState<{
    used: number
    total: number
    percentage: number
  } | null>(null)

  useEffect(() => {
    const updateMemory = () => {
      if ((performance as any).memory) {
        const memory = (performance as any).memory
        setMemoryInfo({
          used: memory.usedJSHeapSize,
          total: memory.totalJSHeapSize,
          percentage: (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100
        })
      }
    }

    updateMemory()
    const interval = setInterval(updateMemory, 5000) // Update every 5 seconds

    return () => clearInterval(interval)
  }, [])

  return memoryInfo
}

export function useRenderTracker(componentName: string) {
  const renderCount = useRef(0)
  const startTime = useRef(Date.now())

  useEffect(() => {
    renderCount.current++
    
    if (process.env.NODE_ENV === 'development') {
      const timeSinceMount = Date.now() - startTime.current
      console.log(`📊 ${componentName} rendered ${renderCount.current} times (${timeSinceMount}ms since mount)`)
    }
  })

  return {
    renderCount: renderCount.current,
    timeSinceMount: Date.now() - startTime.current
  }
}

export function useSessionLoadingPerformance() {
  const [metrics, setMetrics] = useState<SessionLoadingMetrics | null>(null)
  const pageStartTime = useRef(performance.now())
  const sessionStartTime = useRef<number | null>(null)

  const startSessionTimer = () => {
    sessionStartTime.current = performance.now()
  }

  const endSessionTimer = () => {
    if (sessionStartTime.current) {
      const sessionLoadTime = performance.now() - sessionStartTime.current
      const pageLoadTime = performance.now() - pageStartTime.current

      // Get web vitals if available
      const paintEntries = performance.getEntriesByType('paint')
      const fcpEntry = paintEntries.find(entry => entry.name === 'first-contentful-paint')
      const firstContentfulPaint = fcpEntry?.startTime || 0

      const navigationEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[]
      const navEntry = navigationEntries[0]
      const timeToInteractive = navEntry?.domInteractive - navEntry?.startTime || 0

      const loadMetrics = {
        sessionLoadTime,
        pageLoadTime,
        firstContentfulPaint,
        timeToInteractive
      }

      setMetrics(loadMetrics)

      // Log performance metrics in development
      if (process.env.NODE_ENV === 'development') {
        console.group('📊 Performance Metrics')
        console.log(`Session Load Time: ${sessionLoadTime.toFixed(2)}ms`)
        console.log(`Page Load Time: ${pageLoadTime.toFixed(2)}ms`)
        console.log(`First Contentful Paint: ${firstContentfulPaint.toFixed(2)}ms`)
        console.log(`Time to Interactive: ${timeToInteractive.toFixed(2)}ms`)
        
        // Performance targets based on contentport analysis
        if (sessionLoadTime > 500) {
          console.warn('⚠️ Session loading exceeds 500ms target')
        } else {
          console.log('✅ Session loading within 500ms target')
        }
        
        console.groupEnd()
      }

      sessionStartTime.current = null
    }
  }

  return {
    metrics,
    startSessionTimer,
    endSessionTimer
  }
}