'use client'

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-lg px-4 py-2 text-sm font-medium"
      style={{ background: '#8a6a3f', color: '#fff' }}
    >
      🖨️ Print
    </button>
  )
}
