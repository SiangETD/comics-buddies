import { useState, useRef } from 'react'
import { useTopics } from '../../hooks/useTopics'
import type { Topic } from '../../hooks/useTopics'
import styles from './GenerateTopicsView.module.css'

type Mode = 'upload' | 'manual' | 'paste' | null

export default function GenerateTopicsView() {
  const { topics, replaceTopics, addTopics, toggleTopic, removeTopic, updateTopic, clearTopics } = useTopics('__unused__')
  const [mode, setMode] = useState<Mode>(null)
  const [extracting, setExtracting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [extractedTopics, setExtractedTopics] = useState<string[]>([])
  const [selectedExtracted, setSelectedExtracted] = useState<Set<number>>(new Set())
  const [manualInputs, setManualInputs] = useState<string[]>(['', '', ''])
  const [pasteText, setPasteText] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  function goBack() {
    setMode(null)
    setError(null)
    setExtractedTopics([])
    setSelectedExtracted(new Set())
    setSaved(false)
  }

  // ── Upload mode ──────────────────────────────────────────────────────────

  async function handleFileUpload(file: File) {
    setError(null)
    setExtractedTopics([])
    setSelectedExtracted(new Set())
    setExtracting(true)

    try {
      let text = ''

      if (file.name.endsWith('.txt')) {
        text = await file.text()
      } else {
        const form = new FormData()
        form.append('file', file)
        const res = await fetch('/api/extract-text', { method: 'POST', body: form })
        if (!res.ok) throw new Error((await res.json()).error ?? 'Text extraction failed')
        const data = await res.json()
        text = data.text
      }

      if (!text.trim()) throw new Error('No text found in document.')

      const res = await fetch('/api/extract-topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Topic extraction failed')
      const data = await res.json()
      const list: string[] = data.topics ?? []
      setExtractedTopics(list)
      setSelectedExtracted(new Set(list.map((_, i) => i)))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setExtracting(false)
    }
  }

  function toggleExtracted(i: number) {
    setSelectedExtracted(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  function saveExtracted() {
    const chosen = extractedTopics.filter((_, i) => selectedExtracted.has(i))
    replaceTopics(chosen, 'document')
    setSaved(true)
  }

  // ── Manual mode ──────────────────────────────────────────────────────────

  function updateManual(i: number, v: string) {
    setManualInputs(prev => { const n = [...prev]; n[i] = v; return n })
    setSaved(false)
  }

  function saveManual() {
    const texts = manualInputs.filter(t => t.trim())
    if (!texts.length) return
    addTopics(texts, 'manual')
    setManualInputs(['', '', ''])
    setSaved(true)
  }

  // ── Paste mode ───────────────────────────────────────────────────────────

  const parsedPasteTopics = pasteText
    .split('\n')
    .map(l => l.replace(/^[\s\-\•\*\d+\.\)]+/, '').trim())
    .filter(Boolean)

  function savePaste() {
    if (!parsedPasteTopics.length) return
    addTopics(parsedPasteTopics, 'manual')
    setPasteText('')
    setSaved(true)
  }

  // ── Saved topics ─────────────────────────────────────────────────────────

  const savedCount = topics.filter(t => t.selected).length

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Generate Topics</h1>
        <p className={styles.pageSubtitle}>
          Build your topic list — these become starting points for batch comic generation.
        </p>
      </div>

      <div className={styles.body}>

        {/* ── Saved topics panel ── */}
        {topics.length > 0 && (
          <div className={styles.savedCard}>
            <div className={styles.savedCardHeader}>
              <span className={styles.savedCardTitle}>
                Saved Topics
                <span className={styles.savedBadge}>{topics.length}</span>
              </span>
              <button className={styles.btnClear} onClick={clearTopics}>Clear all</button>
            </div>
            <div className={styles.savedList}>
              {topics.map((t: Topic) => (
                <div key={t.id} className={`${styles.savedRow} ${t.selected ? styles.savedRowActive : ''}`}>
                  <label className={styles.savedCheck}>
                    <input type="checkbox" checked={t.selected} onChange={() => toggleTopic(t.id)} />
                  </label>
                  <input
                    className={styles.savedText}
                    value={t.text}
                    onChange={e => updateTopic(t.id, e.target.value)}
                  />
                  <span className={`${styles.savedSource} ${styles[`source_${t.source}`]}`}>
                    {t.source === 'document' ? '📄' : '✏️'}
                  </span>
                  <button className={styles.btnRemoveTopic} onClick={() => removeTopic(t.id)}>✕</button>
                </div>
              ))}
            </div>
            {savedCount > 0 && (
              <div className={styles.savedSummary}>
                {savedCount} topic{savedCount !== 1 ? 's' : ''} selected for batch generation
              </div>
            )}
          </div>
        )}

        {/* ── Mode chooser ── */}
        {!mode && (
          <div className={styles.modeGrid}>
            <button className={styles.modeCard} onClick={() => { setMode('upload'); setSaved(false) }}>
              <span className={styles.modeIcon}>📄</span>
              <div className={styles.modeTitle}>Upload Document</div>
              <div className={styles.modeDesc}>Upload a .txt, .docx, or .pdf — AI extracts 10+ topics.</div>
            </button>
            <button className={styles.modeCard} onClick={() => { setMode('paste'); setSaved(false) }}>
              <span className={styles.modeIcon}>📋</span>
              <div className={styles.modeTitle}>Paste Topics</div>
              <div className={styles.modeDesc}>Paste a list of topics — one per line.</div>
            </button>
            <button className={styles.modeCard} onClick={() => { setMode('manual'); setSaved(false) }}>
              <span className={styles.modeIcon}>✏️</span>
              <div className={styles.modeTitle}>Insert Own Topics</div>
              <div className={styles.modeDesc}>Type topics one by one into text boxes.</div>
            </button>
          </div>
        )}

        {/* ── Upload mode ── */}
        {mode === 'upload' && (
          <div className={styles.formCard}>
            <div className={styles.cardHeader}>
              <button className={styles.btnBack} onClick={goBack}>← Back</button>
              <span className={styles.cardTitle}>Upload Document</span>
            </div>

            {!extracting && extractedTopics.length === 0 && (
              <div
                className={styles.dropZone}
                onClick={() => fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add(styles.dropZoneOver) }}
                onDragLeave={e => e.currentTarget.classList.remove(styles.dropZoneOver)}
                onDrop={e => {
                  e.preventDefault()
                  e.currentTarget.classList.remove(styles.dropZoneOver)
                  const file = e.dataTransfer.files[0]
                  if (file) handleFileUpload(file)
                }}
              >
                <span className={styles.dropIcon}>📁</span>
                <div className={styles.dropText}>Drop a file here or click to browse</div>
                <div className={styles.dropHint}>Supports .txt · .docx · .pdf</div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".txt,.docx,.pdf"
                  style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f) }}
                />
              </div>
            )}

            {extracting && (
              <div className={styles.extracting}>
                <div className={styles.spinner} />
                <div>AI is reading your document and extracting topics…</div>
              </div>
            )}

            {error && (
              <div className={styles.errorBanner}>
                ⚠️ {error}
                <button className={styles.btnRetry} onClick={() => { setError(null); setExtractedTopics([]) }}>Try again</button>
              </div>
            )}

            {extractedTopics.length > 0 && (
              <>
                <div className={styles.extractedHeader}>
                  <span className={styles.extractedTitle}>
                    {extractedTopics.length} topics found — select which to keep
                  </span>
                  <div className={styles.extractedActions}>
                    <button className={styles.btnSelectAll} onClick={() => setSelectedExtracted(new Set(extractedTopics.map((_, i) => i)))}>Select all</button>
                    <button className={styles.btnSelectAll} onClick={() => setSelectedExtracted(new Set())}>Deselect all</button>
                  </div>
                </div>
                <div className={styles.extractedList}>
                  {extractedTopics.map((t, i) => {
                    const on = selectedExtracted.has(i)
                    return (
                      <label key={i} className={`${styles.extractedRow} ${on ? styles.extractedRowOn : ''}`}>
                        <div className={`${styles.checkbox} ${on ? styles.checkboxChecked : ''}`}>
                          {on && <span className={styles.checkmark}>✓</span>}
                        </div>
                        <input type="checkbox" style={{ display: 'none' }} checked={on} onChange={() => toggleExtracted(i)} />
                        <span className={styles.extractedText}>{t}</span>
                      </label>
                    )
                  })}
                </div>
                <div className={styles.actions}>
                  <button className={styles.btnSave} disabled={selectedExtracted.size === 0} onClick={saveExtracted}>
                    Save {selectedExtracted.size} topic{selectedExtracted.size !== 1 ? 's' : ''}
                  </button>
                  {saved && <span className={styles.savedOk}>✅ Saved!</span>}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Paste mode ── */}
        {mode === 'paste' && (
          <div className={styles.formCard}>
            <div className={styles.cardHeader}>
              <button className={styles.btnBack} onClick={goBack}>← Back</button>
              <span className={styles.cardTitle}>Paste Topics</span>
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>Paste your topics below — one per line</label>
              <textarea
                className={styles.pasteArea}
                rows={10}
                placeholder={'Why do plants need sunlight?\nHow does recycling help the environment?\nWhat are the parts of a flower?'}
                value={pasteText}
                onChange={e => { setPasteText(e.target.value); setSaved(false) }}
              />
            </div>

            {parsedPasteTopics.length > 0 && (
              <div className={styles.pastePreview}>
                <div className={styles.pastePreviewLabel}>
                  {parsedPasteTopics.length} topic{parsedPasteTopics.length !== 1 ? 's' : ''} detected
                </div>
                <ul className={styles.pastePreviewList}>
                  {parsedPasteTopics.map((t, i) => (
                    <li key={i} className={styles.pastePreviewItem}>{t}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className={styles.actions}>
              <button
                className={styles.btnSave}
                disabled={parsedPasteTopics.length === 0}
                onClick={savePaste}
              >
                Save {parsedPasteTopics.length > 0 ? parsedPasteTopics.length : ''} topic{parsedPasteTopics.length !== 1 ? 's' : ''}
              </button>
              {saved && <span className={styles.savedOk}>✅ Saved!</span>}
            </div>
          </div>
        )}

        {/* ── Manual mode ── */}
        {mode === 'manual' && (
          <div className={styles.formCard}>
            <div className={styles.cardHeader}>
              <button className={styles.btnBack} onClick={goBack}>← Back</button>
              <span className={styles.cardTitle}>Insert Own Topics</span>
            </div>

            <div className={styles.manualList}>
              {manualInputs.map((val, i) => (
                <div key={i} className={styles.manualRow}>
                  <span className={styles.manualIndex}>{i + 1}.</span>
                  <input
                    className={styles.manualInput}
                    placeholder={`Topic ${i + 1}…`}
                    value={val}
                    onChange={e => updateManual(i, e.target.value)}
                  />
                  {manualInputs.length > 1 && (
                    <button className={styles.btnRemoveTopic} onClick={() => setManualInputs(prev => prev.filter((_, j) => j !== i))}>✕</button>
                  )}
                </div>
              ))}
            </div>

            <button className={styles.btnAddMore} onClick={() => setManualInputs(prev => [...prev, ''])}>
              + Add more topic
            </button>

            <div className={styles.actions}>
              <button
                className={styles.btnSave}
                disabled={!manualInputs.some(t => t.trim())}
                onClick={saveManual}
              >
                Save Topics
              </button>
              {saved && <span className={styles.savedOk}>✅ Saved!</span>}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
