import { useState, useRef, useEffect, useCallback } from 'react'
import { useStore, useApp } from '../../App'
import { generateScripts } from '../../services/api'
import type { ComicIdea } from '../../types'
import styles from './GenerateScriptView.module.css'

type Step = 'input' | 'generating' | 'ideas'
type InputMode = 'upload' | 'paste' | null

function lsKey(projectId: string) { return `cb_ideas_${projectId}` }
function lsRawKey(projectId: string) { return `cb_rawtext_${projectId}` }

function loadIdeas(projectId: string): ComicIdea[] {
  try { return JSON.parse(localStorage.getItem(lsKey(projectId)) ?? '[]') } catch { return [] }
}
function saveIdeasLocal(projectId: string, ideas: ComicIdea[]) {
  localStorage.setItem(lsKey(projectId), JSON.stringify(ideas))
}
function saveRawText(projectId: string, text: string) {
  localStorage.setItem(lsRawKey(projectId), text)
}
function loadRawText(projectId: string): string {
  return localStorage.getItem(lsRawKey(projectId)) ?? ''
}

export default function GenerateScriptView() {
  const store = useStore()
  const { setActiveNav, setIsGenerating } = useApp()
  const projectId = store.project?.project_id ?? '__no_project__'
  const project = store.project

  const [showExample, setShowExample] = useState(false)
  const closeOnBackdrop = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) setShowExample(false)
  }, [])

  // Init from project.scripts (authoritative) or localStorage (draft)
  const initIdeas = (): ComicIdea[] => {
    if (project?.scripts?.length) return project.scripts
    return loadIdeas(projectId)
  }

  const [step, setStep] = useState<Step>(() => initIdeas().length > 0 ? 'ideas' : 'input')
  const [inputMode, setInputMode] = useState<InputMode>(null)
  const [pasteText, setPasteText] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState<string | null>(null)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [ideas, setIdeas] = useState<ComicIdea[]>(initIdeas)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showMoreInput, setShowMoreInput] = useState(false)
  const [extraInstructions, setExtraInstructions] = useState('')
  const [generatingMore, setGeneratingMore] = useState(false)
  const [generateMoreError, setGenerateMoreError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const init = initIdeas()
    setIdeas(init)
    setStep(init.length > 0 ? 'ideas' : 'input')
    setInputMode(null)
    setPasteText('')
    setExtractError(null)
    setGenerateError(null)
    setExpandedId(null)
    setSaved(false)
  }, [projectId])

  function updateIdeas(next: ComicIdea[]) {
    setIdeas(next)
    saveIdeasLocal(projectId, next)
    setSaved(false)
  }

  // ── Extract text from uploaded file ───────────────────────────────────────

  async function extractTextFromFile(file: File): Promise<string> {
    if (file.name.endsWith('.txt')) return file.text()
    const form = new FormData()
    form.append('file', file)
    const res = await fetch('/api/extract-text', { method: 'POST', body: form })
    if (!res.ok) throw new Error((await res.json()).error ?? 'Text extraction failed')
    return (await res.json()).text
  }

  // ── Run AI generation ─────────────────────────────────────────────────────

  async function runGenerate(rawText: string) {
    setStep('generating')
    setGenerateError(null)
    setSaved(false)
    setIsGenerating(true)
    saveRawText(projectId, rawText)   // persist so "generate more" can reuse it
    try {
      const entries = await generateScripts(rawText, { subject: project?.subject, level: project?.level })
      const mapped: ComicIdea[] = entries.map(e => ({
        id: crypto.randomUUID(),
        topic: e.topic,
        objectives: e.objectives,
        facts: [
          e.facts?.[0] ?? '',
          e.facts?.[1] ?? '',
          e.facts?.[2] ?? '',
        ],
        selected: true,
      }))
      updateIdeas(mapped)
      setStep('ideas')
    } catch (e: unknown) {
      setGenerateError(e instanceof Error ? e.message : String(e))
      setStep('input')
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleFileUpload(file: File) {
    setExtractError(null)
    setExtracting(true)
    try {
      const text = await extractTextFromFile(file)
      if (!text.trim()) throw new Error('No text found in document.')
      setInputMode(null)
      await runGenerate(text)
    } catch (e: unknown) {
      setExtractError(e instanceof Error ? e.message : String(e))
    } finally {
      setExtracting(false)
    }
  }

  async function handlePasteGenerate() {
    if (!pasteText.trim()) return
    const text = pasteText
    setInputMode(null)
    setPasteText('')
    await runGenerate(text)
  }

  // ── Generate more ideas (append) ─────────────────────────────────────────

  async function runGenerateMore() {
    if (!ideas.length) return
    setGeneratingMore(true)
    setGenerateMoreError(null)
    setIsGenerating(true)
    try {
      const originalText = loadRawText(projectId)
      const existingTopics = ideas.map((idea, i) => `${i + 1}. ${idea.topic}`).join('\n')
      // Keep the original document as primary context; append "already covered" list + extra instructions
      const rawText = `${originalText}\n\n---\nTopics already covered (do NOT repeat these):\n${existingTopics}${extraInstructions ? `\n\nExtra instructions from teacher:\n${extraInstructions}` : ''}`
      const entries = await generateScripts(rawText, {
        subject: project?.subject,
        level: project?.level,
      })
      const mapped: ComicIdea[] = entries.map(e => ({
        id: crypto.randomUUID(),
        topic: e.topic,
        objectives: e.objectives,
        facts: [e.facts?.[0] ?? '', e.facts?.[1] ?? '', e.facts?.[2] ?? ''],
        selected: true,
      }))
      updateIdeas([...ideas, ...mapped])
      setShowMoreInput(false)
      setExtraInstructions('')
    } catch (e: unknown) {
      setGenerateMoreError(e instanceof Error ? e.message : String(e))
    } finally {
      setGeneratingMore(false)
      setIsGenerating(false)
    }
  }

  // ── Idea edits ────────────────────────────────────────────────────────────

  function updateField(id: string, field: keyof ComicIdea, value: string) {
    updateIdeas(ideas.map(s => s.id === id ? { ...s, [field]: value } : s))
  }

  function updateFact(id: string, index: 0 | 1 | 2, value: string) {
    updateIdeas(ideas.map(s => {
      if (s.id !== id) return s
      const facts: [string, string, string] = [...s.facts]
      facts[index] = value
      return { ...s, facts }
    }))
  }

  function toggleEntry(id: string) {
    updateIdeas(ideas.map(s => s.id === id ? { ...s, selected: !s.selected } : s))
  }

  // ── Save All Scripts ──────────────────────────────────────────────────────

  async function handleSaveAll() {
    setSaving(true)
    store.setProjectScripts(ideas)
    await new Promise(r => setTimeout(r, 300))
    setSaving(false)
    setSaved(true)
  }

  const selectedCount = ideas.filter(s => s.selected).length

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Generate Script</h1>
        <p className={styles.pageSubtitle}>
          {step === 'input' && 'Upload a document or paste topics to generate possible comic ideas.'}
          {step === 'generating' && 'AI is generating possible ideas…'}
          {step === 'ideas' && `${ideas.length} possible ideas. Review and edit, then save all scripts.`}
        </p>
      </div>

      <div className={styles.body}>

        {/* ── Step: Input ── */}
        {step === 'input' && (
          <div className={styles.inputStep}>
            {generateError && <div className={styles.errorBanner}>⚠️ {generateError}</div>}

            {!inputMode && (
              <>
                <div className={styles.modeGrid}>
                  <button className={styles.modeCard} onClick={() => { setInputMode('upload'); setExtractError(null) }}>
                    <span className={styles.modeIcon}>📄</span>
                    <div className={styles.modeTitle}>Upload Document</div>
                    <div className={styles.modeDesc}>.txt · .docx · .pdf</div>
                  </button>
                  <button className={styles.modeCard} onClick={() => setInputMode('paste')}>
                    <span className={styles.modeIcon}>📋</span>
                    <div className={styles.modeTitle}>Paste Topics</div>
                    <div className={styles.modeDesc}>Type or paste a list of topics</div>
                  </button>
                </div>
                {ideas.length > 0 && (
                  <button className={styles.btnViewIdeas} onClick={() => setStep('ideas')}>
                    📋 View Ideas ({ideas.length})
                  </button>
                )}
              </>
            )}

            {inputMode === 'upload' && (
              <div className={styles.panel}>
                <button className={styles.btnBack} onClick={() => { setInputMode(null); setExtractError(null) }}>← Back</button>
                {!extracting && (
                  <div
                    className={styles.dropZone}
                    onClick={() => fileRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add(styles.dropZoneOver) }}
                    onDragLeave={e => e.currentTarget.classList.remove(styles.dropZoneOver)}
                    onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove(styles.dropZoneOver); const f = e.dataTransfer.files[0]; if (f) handleFileUpload(f) }}
                  >
                    <span className={styles.dropIcon}>📁</span>
                    <div className={styles.dropText}>Drop a file here or click to browse</div>
                    <div className={styles.dropHint}>Supports .txt · .docx · .pdf</div>
                    <input ref={fileRef} type="file" accept=".txt,.docx,.pdf" style={{ display: 'none' }}
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); e.target.value = '' }} />
                  </div>
                )}
                {extracting && <div className={styles.loadingBox}><div className={styles.spinner} /><span>Reading document…</span></div>}
                {extractError && (
                  <div className={styles.errorBanner}>
                    ⚠️ {extractError}
                    <button className={styles.btnRetry} onClick={() => setExtractError(null)}>Try again</button>
                  </div>
                )}
              </div>
            )}

            {inputMode === 'paste' && (
              <div className={styles.panel}>
                <button className={styles.btnBack} onClick={() => { setInputMode(null); setPasteText('') }}>← Back</button>
                <label className={styles.panelLabel}>
                  Your topics. Use Syllabus document.{' '}
                  <button type="button" className={styles.btnExampleLink} onClick={() => setShowExample(true)}>See Example here.</button>
                </label>
                <textarea
                  className={styles.pasteArea}
                  rows={10}
                  placeholder={'E.g.\nWater cycle\nTypes of clouds\nWhy it rains\nHow oceans form'}
                  value={pasteText}
                  onChange={e => setPasteText(e.target.value)}
                  autoFocus
                />
                <div className={styles.panelActions}>
                  <button className={styles.btnGenerate} disabled={!pasteText.trim()} onClick={handlePasteGenerate}>
                    💡 Generate Possible Ideas
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Step: Generating ── */}
        {step === 'generating' && (
          <div className={styles.generatingStep}>
            <div className={styles.spinner} />
            <div className={styles.generatingTitle}>AI is generating possible ideas…</div>
            <div className={styles.generatingHint}>Creating 10 topics with learning objectives and facts</div>
          </div>
        )}

        {/* ── Step: Possible Ideas ── */}
        {step === 'ideas' && (
          <div className={styles.reviewStep}>

            {/* Toolbar */}
            <div className={styles.reviewToolbar}>
              <button className={styles.btnStartOver} onClick={() => setStep('input')}>← Back</button>
            </div>

            <div className={styles.ideasSectionTitle}>Possible Ideas — {selectedCount} of {ideas.length} selected</div>

            {/* Cards */}
            <div className={styles.scriptList}>
              {ideas.map((idea, idx) => {
                const isOpen = expandedId === idea.id
                return (
                  <div key={idea.id} className={`${styles.scriptCard} ${!idea.selected ? styles.scriptCardDim : ''}`}>

                    {/* Collapsed header */}
                    <div className={styles.scriptCardTop}>
                      <label className={styles.scriptCheck} onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={idea.selected} onChange={() => toggleEntry(idea.id)} />
                      </label>
                      <span className={styles.scriptNum}>{idx + 1}</span>
                      <div className={styles.scriptSummary} onClick={() => setExpandedId(isOpen ? null : idea.id)}>
                        <div className={styles.scriptTopicText}>{idea.topic || 'Untitled'}</div>
                        <div className={styles.scriptObjectivesPreview}>{idea.objectives || 'No objectives yet'}</div>
                      </div>
                      <button className={styles.btnExpand} onClick={() => setExpandedId(isOpen ? null : idea.id)}>
                        {isOpen ? '▲' : '▼'}
                      </button>
                      <button
                        className={styles.btnDelete}
                        onClick={e => { e.stopPropagation(); updateIdeas(ideas.filter(s => s.id !== idea.id)) }}
                        title="Remove idea"
                      >
                        🗑
                      </button>
                    </div>

                    {/* Expanded edit form */}
                    {isOpen && (
                      <div className={styles.scriptExpanded}>
                        <div className={styles.editField}>
                          <label className={styles.editLabel}>Topic Title</label>
                          <input
                            className={styles.editInput}
                            value={idea.topic}
                            onChange={e => updateField(idea.id, 'topic', e.target.value)}
                          />
                        </div>
                        <div className={styles.editField}>
                          <label className={styles.editLabel}>Learning Objectives (1–2)</label>
                          <textarea
                            className={styles.editTextarea}
                            rows={2}
                            value={idea.objectives}
                            onChange={e => updateField(idea.id, 'objectives', e.target.value)}
                          />
                        </div>
                        <div className={styles.factsGrid}>
                          {([0, 1, 2] as (0 | 1 | 2)[]).map(i => (
                            <div key={i} className={styles.editField}>
                              <label className={styles.editLabel}>
                                {i === 0 ? 'Panel 3 — Simple Fact 1' : i === 1 ? 'Panel 4 — Simple Fact 2' : 'Panel 5 — Simple Fact 3 (SG context)'}
                              </label>
                              <textarea
                                className={styles.editTextarea}
                                rows={2}
                                value={idea.facts[i]}
                                onChange={e => updateFact(idea.id, i, e.target.value)}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                )
              })}
            </div>

            {/* Bottom bar: Generate more (left) + Save All (right) */}
            <div className={styles.bottomBar}>

              {/* Left: Generate 10 more ideas */}
              <div className={styles.generateMoreWrap}>
                {!showMoreInput ? (
                  <button className={styles.btnGenerateMore} disabled={generatingMore} onClick={() => setShowMoreInput(true)}>
                    {generatingMore ? '⏳ Generating…' : '💡 Generate 10 more ideas'}
                  </button>
                ) : (
                  <div className={styles.moreInputBox}>
                    <label className={styles.moreInputLabel}>Extra Instructions</label>
                    <textarea
                      className={styles.moreInputArea}
                      rows={3}
                      placeholder="e.g. Focus on animals only. Avoid plants."
                      value={extraInstructions}
                      onChange={e => setExtraInstructions(e.target.value)}
                      autoFocus
                    />
                    {generateMoreError && <div className={styles.moreError}>⚠️ {generateMoreError}</div>}
                    <div className={styles.moreInputActions}>
                      <button className={styles.btnCancelMore} onClick={() => { setShowMoreInput(false); setExtraInstructions(''); setGenerateMoreError(null) }}>
                        Cancel
                      </button>
                      <button className={styles.btnRunMore} disabled={generatingMore} onClick={runGenerateMore}>
                        {generatingMore ? '⏳ Generating…' : '💡 Generate 10 more ideas'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Right: Save All Scripts */}
              <div className={styles.saveAllWrap}>
                {saved ? (
                  <div className={styles.savedBanner}>
                    <span>✅ Scripts saved!</span>
                    <button className={styles.btnContinue} onClick={() => setActiveNav('generate-comics')}>
                      Go to Generate Comics →
                    </button>
                  </div>
                ) : (
                  <button className={styles.btnSaveAll} disabled={saving || ideas.length === 0} onClick={handleSaveAll}>
                    {saving ? '⏳ Saving…' : '💾 Save All Scripts'}
                  </button>
                )}
              </div>

            </div>

          </div>
        )}

      </div>

      {/* ── Example modal ── */}
      {showExample && (
        <div className={styles.modalBackdrop} onClick={closeOnBackdrop}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Example: Syllabus Document</h3>
              <button className={styles.modalClose} onClick={() => setShowExample(false)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.modalSection}><strong>About Diversity:</strong></p>
              <p>There is a great variety of living and non-living things around us. Organising this diversity of things helps us better understand the world in which we live.</p>
              <p className={styles.modalSection}><strong>Essential Takeaways:</strong></p>
              <ul>
                <li>There is a great variety of living and non-living things around us.</li>
                <li>We classify living and non-living things based on their similarities and differences.</li>
                <li>Maintaining the diversity of living and non-living things is important for survival.</li>
              </ul>
              <p className={styles.modalSection}><strong>Key Inquiry Questions:</strong></p>
              <ul>
                <li>What can we observe around us?</li>
                <li>How can we classify the great variety of living and non-living things?</li>
                <li>Why is it important to maintain diversity?</li>
              </ul>
              <p className={styles.modalSection}><strong>Core Ideas:</strong></p>
              <ul>
                <li>Describe the characteristics of living things (need water, food and air; grow, respond and reproduce).</li>
                <li>Recognise broad groups: Plants (flowering, non-flowering), Animals (amphibians, birds, fish, insects, mammals, reptiles), Fungi, Bacteria.</li>
              </ul>
              <p className={styles.modalSection}><strong>Practices:</strong></p>
              <ul>
                <li>Observe living and non-living things and infer differences.</li>
                <li>Classify living things into broad groups based on observable characteristics.</li>
              </ul>
              <p className={styles.modalSection}><strong>Values, Ethics and Attitudes:</strong></p>
              <ul>
                <li>Show curiosity by questioning and exploring surrounding living and non-living things.</li>
                <li>Show care and concern by being responsible towards living things.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
