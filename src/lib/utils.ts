import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('tr-TR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleDateString('tr-TR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function isOverdue(dueDate: string): boolean {
  return new Date(dueDate) < new Date()
}

export function getAssignmentStatus(dueDate: string): 'open' | 'overdue' {
  return isOverdue(dueDate) ? 'overdue' : 'open'
}

// Demo account protection
const DEMO_EMAILS = ['ogretmen@demo.com', 'ogrenci@demo.com']

export function isDemoAccount(email: string): boolean {
  return DEMO_EMAILS.includes(email)
}
