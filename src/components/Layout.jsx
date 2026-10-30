export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-gray-50 font-[Inter,sans-serif]">
      <div className="max-w-5xl mx-auto p-6">
        {children}
      </div>
    </div>
  )
}
