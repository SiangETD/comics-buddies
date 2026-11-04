import { useState, useCallback } from 'react'
import { useStore, useApp } from '../../App'
import type { ComicPanelScript, CreatedComic } from '../../types'
import styles from './ReviewComicsView.module.css'
import { chromaKeyAndSave } from '../../utils/chromaKey'

const PANEL_LABELS = [
  { key: 'panel1', label: 'Panel 1 — Curiosity Hook' },
  { key: 'panel2', label: 'Panel 2 — Reveal' },
  { key: 'panel3', label: 'Panel 3 — Trigger Question' },
  { key: 'panel4', label: 'Panel 4 — Fact 1' },
  { key: 'panel5', label: 'Panel 5 — Fact 2' },
  { key: 'panel6', label: 'Panel 6 — Singapore Context' },
  { key: 'panel7', label: 'Panel 7 — Closing' },
]

type ScriptField = {
  label: string
  key: keyof ComicPanelScript
  multiline?: boolean
}

const PANEL_FIELDS: ScriptField[][] = [
  [
    { label: 'Curiosity question', key: 'panel1_question' },
    { label: 'Photo prompt', key: 'panel1_photo_prompt', multiline: true },
  ],
  [
    { label: 'Reveal sentence', key: 'panel2_reveal' },
    { label: 'Title text', key: 'panel2_title' },
    { label: 'Object photo prompt', key: 'panel2_object_prompt', multiline: true },
  ],
  [
    { label: 'Trigger question', key: 'panel3_trigger', multiline: true },
  ],
  [
    { label: 'Fact (textbox)', key: 'panel4_fact', multiline: true },
    { label: 'Character speech', key: 'panel4_speech' },
    { label: 'Scene photo prompt', key: 'panel4_scene_prompt', multiline: true },
  ],
  [
    { label: 'Fact (textbox)', key: 'panel5_fact', multiline: true },
    { label: 'Character speech', key: 'panel5_speech' },
    { label: 'Scene photo prompt', key: 'panel5_scene_prompt', multiline: true },
  ],
  [
    { label: 'Fact (textbox)', key: 'panel6_fact', multiline: true },
    { label: 'Character speech', key: 'panel6_speech' },
    { label: 'Scene photo prompt', key: 'panel6_scene_prompt', multiline: true },
  ],
  [
    { label: 'Closing remark', key: 'panel7_closing', multiline: true },
  ],
]

interface PanelScriptCardProps {
  script: ComicPanelScript
  topicId: string
  projectId: string
}

function PanelScriptCard({ script, topicId, projectId }: PanelScriptCardProps) {
  const store = useStore()
  const { setActiveNav, setIsGenerating, setEditComicsTopicId } = useApp()
  const [local, setLocal] = useState<ComicPanelScript>(script)
  const [selectedPanel, setSelectedPanel] = useState(0)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const isCreated = !!store.project?.createdComics?.[topicId]

  const handleChange = useCallback((key: keyof ComicPanelScript, value: string) => {
    setLocal(prev => {
      const next = { ...prev, [key]: value }
      // Debounce-free: save to store immediately so it persists
      store.setProjectPanel(topicId, next)
      return next
    })
  }, [store, topicId])

  async function handleCreatePanels() {
    setCreating(true)
    setCreateError(null)
    setIsGenerating(true)
    try {
      const res = await fetch('/api/create-comic-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          topicId,
          panel1_photo_prompt: local.panel1_photo_prompt,
          panel2_title: local.panel2_title,
          panel4_scene_prompt: local.panel4_scene_prompt,
          panel5_scene_prompt: local.panel5_scene_prompt,
          panel6_scene_prompt: local.panel6_scene_prompt,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Image generation failed')
      }
      const { images, panel2_object_prompt_used } = await res.json()
      // Save the actual sticker prompt used so Regenerate modal shows it next time
      if (panel2_object_prompt_used) {
        store.setProjectPanel(topicId, { ...local, panel2_object_prompt: panel2_object_prompt_used })
      }
      // Client-side chroma-key: remove magenta, save transparent PNG back to server
      if (images.panel2_object) {
        images.panel2_object = await chromaKeyAndSave(images.panel2_object, projectId, topicId, 'panel2_object')
      }
      const createdComic: CreatedComic = {
        topicId,
        images,
        createdAt: new Date().toISOString(),
      }
      store.setCreatedComic(topicId, createdComic)
      setActiveNav('edit-comics')
    } catch (err) {
      setCreateError(String(err))
    } finally {
      setIsGenerating(false)
      setCreating(false)
    }
  }

  return (
    <div className={styles.editorLayout}>
      {/* Left: panel strip */}
      <div className={styles.panelStrip}>
        <div className={styles.stripHeader}>
          <span>Panels</span>
          <span className={styles.stripCount}>7</span>
        </div>
        <div className={styles.stripList}>
          {PANEL_LABELS.map((p, i) => (
            <button
              key={p.key}
              className={`${styles.panelThumb} ${selectedPanel === i ? styles.panelThumbActive : ''}`}
              onClick={() => setSelectedPanel(i)}
            >
              <div className={styles.thumbNum}>{i + 1}</div>
              <div className={styles.thumbLabel}>{p.label.split('—')[1]?.trim()}</div>
            </button>
          ))}
        </div>

        <div className={styles.createWrap}>
          {createError && <div className={styles.createError}>{createError}</div>}
          {isCreated ? (
            <button
              className={styles.btnEditPanels}
              onClick={() => { setEditComicsTopicId(topicId); setActiveNav('edit-comics') }}
            >
              ✏️ Edit Comics panels
            </button>
          ) : (
            <button
              className={styles.btnCreatePanels}
              disabled={creating}
              onClick={handleCreatePanels}
            >
              {creating
                ? <><span className={styles.btnSpinner} /> Generating images…</>
                : '🎨 Generate all Comic Panels'}
            </button>
          )}
        </div>
      </div>

      {/* Right: editable panel fields */}
      <div className={styles.panelDetail}>
        <div className={styles.panelDetailTitle}>{PANEL_LABELS[selectedPanel].label}</div>
        <div className={styles.fieldList}>
          {PANEL_FIELDS[selectedPanel].map(field => (
            <div key={field.key} className={styles.fieldRow}>
              <label className={styles.fieldLabel}>{field.label}</label>
              {field.multiline ? (
                <textarea
                  className={styles.fieldTextarea}
                  value={String(local[field.key] ?? '')}
                  onChange={e => handleChange(field.key, e.target.value)}
                  rows={3}
                />
              ) : (
                <input
                  className={styles.fieldInput}
                  value={String(local[field.key] ?? '')}
                  onChange={e => handleChange(field.key, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function ReviewComicsView() {
  const store = useStore()
  const { setActiveNav } = useApp()
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null)

  if (!store.project) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>📋</div>
        <h2 className={styles.emptyTitle}>No comics to review</h2>
        <p className={styles.emptyText}>Generate comics first, then come back here to review the script.</p>
        <button className={styles.btnPrimary} onClick={() => setActiveNav('generate-comics')}>
          🎬 Generate Comics
        </button>
      </div>
    )
  }

  const panelsMap = store.project.panels ?? {}
  const scripts = store.project.scripts ?? []
  const generatedTopics = scripts.filter(s => panelsMap[s.id])

  if (!selectedTopicId) {
    return (
      <div className={styles.listPage}>
        <div className={styles.listHeader}>
          <h1 className={styles.listTitle}>Review Comics Script</h1>
          <p className={styles.listSubtitle}>
            {generatedTopics.length} comic{generatedTopics.length !== 1 ? 's' : ''} ready. Select one to review and edit the script before creating panels.
          </p>
        </div>
        <div className={styles.comicGrid}>
          {generatedTopics.map((s, i) => {
            const isCreated = !!store.project!.createdComics?.[s.id]
            return (
              <button key={s.id} className={styles.comicCard} onClick={() => setSelectedTopicId(s.id)}>
                <div className={styles.comicCardNum}>{i + 1}</div>
                <div className={styles.comicCardTitle}>{s.topic}</div>
                <div className={`${styles.comicCardMeta} ${isCreated ? styles.comicCardMetaDone : ''}`}>
                  {isCreated ? '🎨 Panels created' : '7 panels · Script ready ✓'}
                </div>
                <div className={styles.comicCardArrow}>→</div>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  const script = panelsMap[selectedTopicId]
  const topic = scripts.find(s => s.id === selectedTopicId)
  if (!script) { setSelectedTopicId(null); return null }

  return (
    <div className={styles.editorPage}>
      <div className={styles.editorPageHeader}>
        <button className={styles.btnBack} onClick={() => setSelectedTopicId(null)}>
          ← Back to list
        </button>
        <h1 className={styles.editorPageTitle}>{topic?.topic ?? 'Comic'}</h1>
      </div>
      <PanelScriptCard
        script={script}
        topicId={selectedTopicId}
        projectId={store.project.project_id}
      />
    </div>
  )
}
