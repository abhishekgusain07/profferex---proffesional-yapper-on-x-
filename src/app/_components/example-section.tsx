'use client'

import { trpc } from '@/trpc/client'
import { submitMessage } from '@/actions/example-actions'
import { useState } from 'react'

export function ExampleSection() {
  const [message, setMessage] = useState('')
  
  // tRPC queries
  const helloQuery = trpc.example.hello.useQuery({ text: 'tRPC' })
  const userQuery = trpc.example.getUser.useQuery()
  
  // tRPC mutation
  const updateProfileMutation = trpc.example.updateProfile.useMutation()

  return (
    <div className="space-y-8">
      {/* tRPC Public Query Example */}
      <div className="p-4 border rounded-lg">
        <h3 className="font-semibold mb-3">Public tRPC Query</h3>
        {helloQuery.isLoading ? (
          <p>Loading...</p>
        ) : helloQuery.error ? (
          <p className="text-red-500">Error: {helloQuery.error.message}</p>
        ) : (
          <div>
            <p><strong>Message:</strong> {helloQuery.data?.greeting}</p>
            <p><strong>Timestamp:</strong> {helloQuery.data?.timestamp}</p>
          </div>
        )}
      </div>

      {/* tRPC Protected Query Example */}
      <div className="p-4 border rounded-lg">
        <h3 className="font-semibold mb-3">Protected tRPC Query</h3>
        {userQuery.isLoading ? (
          <p>Loading...</p>
        ) : userQuery.error ? (
          <p className="text-red-500">Error: {userQuery.error.message}</p>
        ) : userQuery.data ? (
          <div>
            <p><strong>User:</strong> {userQuery.data.user?.name || 'Unknown'}</p>
            <p><strong>Message:</strong> {userQuery.data.message}</p>
          </div>
        ) : (
          <p className="text-gray-500">Sign in to see protected data</p>
        )}
      </div>

      {/* tRPC Mutation Example */}
      <div className="p-4 border rounded-lg">
        <h3 className="font-semibold mb-3">tRPC Mutation Example</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const formData = new FormData(e.currentTarget)
            updateProfileMutation.mutate({
              name: formData.get('name') as string,
              bio: formData.get('bio') as string,
            })
          }}
          className="space-y-3"
        >
          <input
            name="name"
            type="text"
            placeholder="Your name"
            required
            className="w-full p-2 border rounded"
          />
          <textarea
            name="bio"
            placeholder="Your bio"
            className="w-full p-2 border rounded h-20 resize-none"
          />
          <button
            type="submit"
            disabled={updateProfileMutation.isPending}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300"
          >
            {updateProfileMutation.isPending ? 'Updating...' : 'Update Profile (tRPC)'}
          </button>
        </form>
        {updateProfileMutation.error && (
          <p className="text-red-500 text-sm mt-2">
            Error: {updateProfileMutation.error.message}
          </p>
        )}
        {updateProfileMutation.data && (
          <p className="text-green-500 text-sm mt-2">
            Profile updated! Name: {updateProfileMutation.data.user.name}
          </p>
        )}
      </div>

      {/* Server Action Example */}
      <div className="p-4 border rounded-lg">
        <h3 className="font-semibold mb-3">Server Action Example</h3>
        <form
          action={async (formData) => {
            const result = await submitMessage(formData)
            if (result.success) {
              console.log('Message submitted:', result.data)
              setMessage('') // Clear the form
            } else {
              console.error('Error:', result.error)
            }
          }}
          className="space-y-3"
        >
          <input
            name="message"
            type="text"
            placeholder="Your message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            className="w-full p-2 border rounded"
          />
          <select
            name="type"
            className="w-full p-2 border rounded"
          >
            <option value="info">Info</option>
            <option value="success">Success</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
          </select>
          <button
            type="submit"
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Submit Message (Server Action)
          </button>
        </form>
      </div>
    </div>
  )
}