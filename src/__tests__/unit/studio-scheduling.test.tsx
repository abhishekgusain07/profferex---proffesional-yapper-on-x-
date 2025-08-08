import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TRPCClientError } from '@trpc/client'

// Mock the tRPC client
const mockTrpc = {
  twitter: {
    schedule: {
      mutate: jest.fn(),
      isPending: false,
      error: null,
    },
    getScheduled: {
      useQuery: jest.fn(() => ({
        data: [],
        isLoading: false,
      })),
    },
    cancelScheduled: {
      mutate: jest.fn(),
      isPending: false,
    },
    postNow: {
      mutate: jest.fn(),
      isPending: false,
      error: null,
    },
    getAccounts: {
      useQuery: jest.fn(() => ({
        data: [{ id: 'account-1', accountId: 'twitter-123' }],
        isLoading: false,
      })),
    },
    createLink: {
      useQuery: jest.fn(() => ({
        data: null,
        refetch: jest.fn(),
      })),
    },
    uploadMediaFromR2: {
      useMutation: jest.fn(() => ({
        mutateAsync: jest.fn(),
      })),
    },
  },
  example: {
    hello: {
      useQuery: jest.fn(() => ({
        data: { greeting: 'Hello', timestamp: '2024-01-01' },
        isLoading: false,
      })),
    },
    getUser: {
      useQuery: jest.fn(() => ({
        data: { user: { email: 'test@example.com', name: 'Test User' }, message: 'Success' },
        isLoading: false,
      })),
    },
    updateProfile: {
      useMutation: jest.fn(() => ({
        mutate: jest.fn(),
        isPending: false,
        error: null,
        isSuccess: false,
      })),
    },
  },
}

jest.mock('@/trpc/client', () => ({
  trpc: mockTrpc,
}))

jest.mock('@/lib/auth-client', () => ({
  useSession: () => ({
    data: { user: { id: 'user-123', email: 'test@example.com' } },
    isPending: false,
  }),
  signOut: jest.fn(),
}))

// Mock date-fns functions
jest.mock('date-fns', () => ({
  format: jest.fn((date, formatStr) => {
    if (formatStr === 'PPP') return 'January 1st, 2024'
    if (formatStr === 'HH:mm') return '14:30'
    if (formatStr === 'PPP p') return 'January 1st, 2024 at 2:30 PM'
    return '2024-01-01'
  }),
  addMinutes: jest.fn((date, minutes) => new Date(date.getTime() + minutes * 60000)),
}))

// Import component after mocking
import Studio from '@/app/studio/page'

// Test utilities
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

describe('Studio Scheduling UI', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render compose and scheduled tabs', () => {
    render(<Studio />, { wrapper: createWrapper() })

    expect(screen.getByText('Compose')).toBeInTheDocument()
    expect(screen.getByText(/Scheduled/)).toBeInTheDocument()
  })

  it('should show scheduling toggle in compose tab', () => {
    render(<Studio />, { wrapper: createWrapper() })

    const scheduleToggle = screen.getByLabelText('Schedule for later')
    expect(scheduleToggle).toBeInTheDocument()
    expect(scheduleToggle).not.toBeChecked()
  })

  it('should show date and time pickers when scheduling is enabled', async () => {
    render(<Studio />, { wrapper: createWrapper() })

    const scheduleToggle = screen.getByLabelText('Schedule for later')
    fireEvent.click(scheduleToggle)

    await waitFor(() => {
      expect(screen.getByText('Pick a date')).toBeInTheDocument()
      expect(screen.getByLabelText('Time')).toBeInTheDocument()
    })
  })

  it('should change button text when scheduling is enabled', async () => {
    render(<Studio />, { wrapper: createWrapper() })

    // Initially shows "Post Now"
    expect(screen.getByText('Post Now')).toBeInTheDocument()

    const scheduleToggle = screen.getByLabelText('Schedule for later')
    fireEvent.click(scheduleToggle)

    await waitFor(() => {
      expect(screen.getByText('Schedule Tweet')).toBeInTheDocument()
    })
  })

  it('should update card description when scheduling is enabled', async () => {
    render(<Studio />, { wrapper: createWrapper() })

    // Initially shows immediate posting description
    expect(screen.getByText('Write and post to Twitter immediately')).toBeInTheDocument()

    const scheduleToggle = screen.getByLabelText('Schedule for later')
    fireEvent.click(scheduleToggle)

    await waitFor(() => {
      expect(screen.getByText('Schedule your tweet for later')).toBeInTheDocument()
    })
  })

  it('should validate tweet content before scheduling', async () => {
    const mockSchedule = jest.fn()
    mockTrpc.twitter.schedule.mutate = mockSchedule

    render(<Studio />, { wrapper: createWrapper() })

    const scheduleToggle = screen.getByLabelText('Schedule for later')
    fireEvent.click(scheduleToggle)

    // Try to submit without content
    const submitButton = await screen.findByText('Schedule Tweet')
    fireEvent.click(submitButton)

    expect(mockSchedule).not.toHaveBeenCalled()
  })

  it('should call schedule mutation when form is submitted', async () => {
    const mockSchedule = jest.fn()
    mockTrpc.twitter.schedule.mutate = mockSchedule

    // Mock successful scheduling response
    mockTrpc.twitter.schedule = {
      ...mockTrpc.twitter.schedule,
      mutate: mockSchedule,
      isPending: false,
      error: null,
    }

    render(<Studio />, { wrapper: createWrapper() })

    const scheduleToggle = screen.getByLabelText('Schedule for later')
    fireEvent.click(scheduleToggle)

    // Fill in tweet content
    const textarea = screen.getByPlaceholderText("What's happening?")
    fireEvent.change(textarea, { target: { value: 'Test scheduled tweet' } })

    // Set date and time
    const timeInput = await screen.findByLabelText('Time')
    fireEvent.change(timeInput, { target: { value: '14:30' } })

    // Mock date selection (simulate calendar selection)
    const mockDate = new Date('2024-12-01')
    
    // Submit form
    const submitButton = await screen.findByText('Schedule Tweet')
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockSchedule).toHaveBeenCalled()
    })
  })

  it('should display scheduled tweets in the scheduled tab', async () => {
    const mockScheduledTweets = [
      {
        id: 'tweet-1',
        content: 'First scheduled tweet',
        scheduledFor: new Date('2024-01-01T14:30:00'),
        mediaIds: [],
      },
      {
        id: 'tweet-2',
        content: 'Second scheduled tweet with media',
        scheduledFor: new Date('2024-01-02T10:00:00'),
        mediaIds: ['media-1'],
      },
    ]

    mockTrpc.twitter.getScheduled.useQuery.mockReturnValue({
      data: mockScheduledTweets,
      isLoading: false,
    })

    render(<Studio />, { wrapper: createWrapper() })

    // Switch to scheduled tab
    const scheduledTab = screen.getByText(/Scheduled/)
    fireEvent.click(scheduledTab)

    await waitFor(() => {
      expect(screen.getByText('First scheduled tweet')).toBeInTheDocument()
      expect(screen.getByText('Second scheduled tweet with media')).toBeInTheDocument()
      expect(screen.getByText('📎 1 media attachment')).toBeInTheDocument()
    })
  })

  it('should show empty state when no scheduled tweets', () => {
    mockTrpc.twitter.getScheduled.useQuery.mockReturnValue({
      data: [],
      isLoading: false,
    })

    render(<Studio />, { wrapper: createWrapper() })

    // Switch to scheduled tab
    const scheduledTab = screen.getByText(/Scheduled/)
    fireEvent.click(scheduledTab)

    expect(screen.getByText('No scheduled tweets')).toBeInTheDocument()
    expect(screen.getByText('Use the composer tab to schedule your first tweet!')).toBeInTheDocument()
  })

  it('should handle cancel scheduled tweet', async () => {
    const mockCancel = jest.fn()
    const mockScheduledTweets = [
      {
        id: 'tweet-1',
        content: 'Test scheduled tweet',
        scheduledFor: new Date(),
        mediaIds: [],
      },
    ]

    mockTrpc.twitter.getScheduled.useQuery.mockReturnValue({
      data: mockScheduledTweets,
      isLoading: false,
    })

    mockTrpc.twitter.cancelScheduled.mutate = mockCancel

    render(<Studio />, { wrapper: createWrapper() })

    // Switch to scheduled tab
    const scheduledTab = screen.getByText(/Scheduled/)
    fireEvent.click(scheduledTab)

    // Find and click delete button
    const deleteButton = screen.getByRole('button', { name: /trash/i })
    fireEvent.click(deleteButton)

    expect(mockCancel).toHaveBeenCalledWith({ tweetId: 'tweet-1' })
  })

  it('should display error messages for scheduling failures', async () => {
    const errorMessage = 'Schedule time must be at least 1 minute in the future'
    
    mockTrpc.twitter.schedule = {
      ...mockTrpc.twitter.schedule,
      error: new TRPCClientError(errorMessage),
    }

    render(<Studio />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument()
    })
  })

  it('should show loading state when scheduling', async () => {
    mockTrpc.twitter.schedule = {
      ...mockTrpc.twitter.schedule,
      isPending: true,
      mutate: jest.fn(),
      error: null,
    }

    render(<Studio />, { wrapper: createWrapper() })

    const scheduleToggle = screen.getByLabelText('Schedule for later')
    fireEvent.click(scheduleToggle)

    await waitFor(() => {
      expect(screen.getByText('Scheduling…')).toBeInTheDocument()
    })
  })

  it('should validate character count for scheduled tweets', async () => {
    render(<Studio />, { wrapper: createWrapper() })

    const textarea = screen.getByPlaceholderText("What's happening?")
    const longText = 'a'.repeat(281) // Over 280 character limit
    fireEvent.change(textarea, { target: { value: longText } })

    await waitFor(() => {
      expect(screen.getByText('-1')).toHaveClass('text-red-600')
    })
  })

  it('should show connected accounts count', () => {
    render(<Studio />, { wrapper: createWrapper() })

    expect(screen.getByText('Connected accounts: 1')).toBeInTheDocument()
  })

  it('should disable submit when no accounts connected', () => {
    mockTrpc.twitter.getAccounts.useQuery.mockReturnValue({
      data: [],
      isLoading: false,
    })

    render(<Studio />, { wrapper: createWrapper() })

    const submitButton = screen.getByText('Post Now')
    expect(submitButton).toBeDisabled()
  })
})