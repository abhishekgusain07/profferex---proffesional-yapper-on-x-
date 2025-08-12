'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { trpc } from '@/trpc/client'
import { ArrowLeft, Globe, Upload } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'

export default function NewKnowledgePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const type = searchParams.get('type') || 'upload'

  const [isLoading, setIsLoading] = useState(false)
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  const importUrlMutation = trpc.knowledge.importUrl.useMutation({
    onSuccess: (data) => {
      toast.success('Website imported successfully!')
      router.push('/studio/knowledge')
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to import website')
      setIsLoading(false)
    },
  })

  const createDocumentMutation = trpc.knowledge.create.useMutation({
    onSuccess: () => {
      toast.success('Document created successfully!')
      router.push('/studio/knowledge')
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create document')
      setIsLoading(false)
    },
  })

  const handleUrlImport = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url) return

    setIsLoading(true)
    importUrlMutation.mutate({ url })
  }

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title) {
      toast.error('Please provide a title')
      return
    }

    setIsLoading(true)
    // For now, create a manual document
    // TODO: Implement actual file upload
    createDocumentMutation.mutate({
      title,
      fileName: title,
      type: 'manual',
      s3Key: '',
      description,
    })
  }

  const handleManualCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title) {
      toast.error('Please provide a title')
      return
    }

    setIsLoading(true)
    createDocumentMutation.mutate({
      title,
      fileName: title,
      type: 'manual',
      s3Key: '',
      description,
    })
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="mb-8">
        <Link
          href="/studio/knowledge"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors mb-4"
        >
          <ArrowLeft className="size-4" />
          Back to Knowledge Base
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Add Knowledge</h1>
        <p className="text-gray-600 mt-2">
          Upload documents or import content from websites to teach the AI assistant new knowledge.
        </p>
      </div>

      <Tabs value={type} onValueChange={(value) => router.push(`/studio/knowledge/new?type=${value}`)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="upload">Upload File</TabsTrigger>
          <TabsTrigger value="url">Import URL</TabsTrigger>
          <TabsTrigger value="manual">Manual Entry</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="size-5" />
                Upload Document
              </CardTitle>
              <CardDescription>
                Upload PDF, DOCX, TXT files or images to add to your knowledge base.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleFileUpload} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter document title"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe what this document contains"
                    rows={3}
                  />
                </div>

                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <Upload className="size-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-2">Drag and drop files here, or click to browse</p>
                  <p className="text-sm text-gray-500">Supports PDF, DOCX, TXT, and image files up to 50MB</p>
                  <Button variant="outline" className="mt-4" type="button">
                    Choose Files
                  </Button>
                </div>

                <div className="flex gap-3">
                  <Button type="submit" disabled={isLoading || !title}>
                    {isLoading ? 'Creating...' : 'Create Document'}
                  </Button>
                  <Button variant="outline" type="button" onClick={() => router.back()}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="url" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="size-5" />
                Import from Website
              </CardTitle>
              <CardDescription>
                Extract content from articles, blog posts, or other web pages.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUrlImport} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="url">Website URL</Label>
                  <Input
                    id="url"
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com/article"
                    required
                  />
                  <p className="text-sm text-gray-500">
                    We'll automatically extract the title, content, and metadata from the page.
                  </p>
                </div>

                <div className="flex gap-3">
                  <Button type="submit" disabled={isLoading || !url}>
                    {isLoading ? 'Importing...' : 'Import Website'}
                  </Button>
                  <Button variant="outline" type="button" onClick={() => router.back()}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manual" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Manual Entry</CardTitle>
              <CardDescription>
                Manually create a knowledge document with your own content.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleManualCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="manual-title">Title</Label>
                  <Input
                    id="manual-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter document title"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="manual-description">Content</Label>
                  <Textarea
                    id="manual-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Enter the knowledge content here..."
                    rows={8}
                    required
                  />
                </div>

                <div className="flex gap-3">
                  <Button type="submit" disabled={isLoading || !title || !description}>
                    {isLoading ? 'Creating...' : 'Create Document'}
                  </Button>
                  <Button variant="outline" type="button" onClick={() => router.back()}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}