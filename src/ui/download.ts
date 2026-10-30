/** Let the browser save `content` as a file. */
export function download(content: string, type: string, fileName: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([content], { type }))
  a.download = fileName
  a.click()
  window.setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
