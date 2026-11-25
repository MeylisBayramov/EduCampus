'use client'

import { sanitizeHtml } from '@/lib/sanitize'

interface RichTextContentProps {
  content: string
  className?: string
}

export function RichTextContent({ content, className = '' }: RichTextContentProps) {
  const sanitized = sanitizeHtml(content)

  return (
    <div
      className={`prose prose-sm max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  )
}
