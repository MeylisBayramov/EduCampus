'use client'

import DOMPurify from 'dompurify'

export function sanitizeHtml(html: string): string {
  if (typeof window === 'undefined') return html
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'a', 'blockquote', 'code', 'pre', 'hr', 'span',
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
  })
}

// Server-side sanitize (strips all HTML)
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '')
}
