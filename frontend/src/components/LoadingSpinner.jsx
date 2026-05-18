export default function LoadingSpinner({ text = 'טוען...' }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-500">
      <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-3" />
      <span className="text-sm">{text}</span>
    </div>
  )
}
