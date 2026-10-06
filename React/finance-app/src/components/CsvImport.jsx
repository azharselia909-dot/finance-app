import { useRef, useState } from 'react'
import { getApiErrorMessage, uploadTransactionsCsv } from '../services/transactions'

const MAX_FILE_SIZE = 5 * 1024 * 1024

/**
 * @param {{ onImported: () => void }} props
 */
function CsvImport({ onImported }) {
  const inputRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const uploadFile = async (file) => {
    if (isUploading) return
    setError('')
    setSuccess('')
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.csv') || file.type !== 'text/csv') {
      setError('Choose a .csv file with the text/csv file type.')
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setError('CSV file must be 5 MB or smaller.')
      return
    }

    setIsUploading(true)
    setProgress(0)
    try {
      const response = await uploadTransactionsCsv(file, (event) => {
        if (event.total) setProgress(Math.round((event.loaded / event.total) * 100))
      })
      setSuccess(`${response.imported} transaction${response.imported === 1 ? '' : 's'} imported.`)
      onImported()
    } catch (uploadError) {
      setError(getApiErrorMessage(uploadError, 'CSV upload failed. Check the file and try again.'))
    } finally {
      setIsUploading(false)
    }
  }

  const handleInputChange = async (event) => {
    await uploadFile(event.target.files?.[0])
    event.target.value = ''
  }

  const handleDrop = async (event) => {
    event.preventDefault()
    setIsDragging(false)
    await uploadFile(event.dataTransfer.files?.[0])
  }

  return (
    <section className="csv-import" aria-labelledby="csv-import-title">
      <div className="csv-import-heading">
        <div><p className="section-kicker">Bring your records</p><h2 id="csv-import-title">Import transactions</h2></div>
        <p>CSV up to 5 MB. Headers: date, description, amount, category, type.</p>
      </div>
      <div
        className={`csv-dropzone ${isDragging ? 'dragging' : ''}`}
        onDragOver={(event) => { event.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <input ref={inputRef} className="visually-hidden" type="file" accept=".csv,text/csv" onChange={handleInputChange} disabled={isUploading} />
        <span aria-hidden="true">CSV</span>
        <p>Drop your file here, or <button type="button" className="text-button" onClick={() => inputRef.current?.click()} disabled={isUploading}>browse files</button></p>
      </div>
      {isUploading && (
        <div className="upload-progress" role="status">
          <span>Uploading{progress ? ` ${progress}%` : '...'}</span>
          <progress max="100" value={progress} aria-label="CSV upload progress" />
        </div>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
      {success && <p className="import-success" role="status">{success}</p>}
    </section>
  )
}

export default CsvImport
