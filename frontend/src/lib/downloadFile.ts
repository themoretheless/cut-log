/**
 * Trigger a browser download of `content` as a file named `name` with the given
 * MIME type. Shared by the optimizer and box-builder pages, which each used to
 * carry an identical copy. Effectful (touches the DOM) but small and mockable.
 */
export function downloadFile(name: string, content: BlobPart, mime: string): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}
