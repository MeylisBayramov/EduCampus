import { Loader2 } from 'lucide-react'

export function LoadingSpinner({ text = 'Yükleniyor...' }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      <p className="mt-3 text-sm text-gray-500">{text}</p>
    </div>
  )
}
