import { useState, useEffect } from 'react'
import { useStore, useApp } from '../../App'
import type { ComicIdea } from '../../types'
import styles from './GenerateComicsView.module.css'

import type { ComicPanelScript } from '../../types'

// ── localStorage helpers (keyed per project so tabs don't mix) ───────────────
type PanelStore = Record<string, ComicPanelScript>

function lsKey(projectId: string) { return `cb_panels_${projectId}` }

function loadPanels(projectId: string): PanelStore {
  try { return JSON.parse(localStorage.getItem(lsKey(projectId)) ?? '{}') } catch { return {} }
}

function savePanel(projectId: string, topicId: string, script: ComicPanelScript) {
  const store = loadPanels(projectId)
  store[topicId] = script
  localStorage.setItem(lsKey(projectId), JSON.stringify(store))
}

// ── API call ─────────────────────────────────────────────────────────────────
async function generateComicScript(idea: ComicIdea, projectTitle: string): Promise<ComicPanelScript> {
  const res = await fetch('/api/generate-comic-panels', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic: idea.topic, objectives: idea.objectives, facts: idea.facts, projectTitle }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? 'Comic generation failed')
  }
  return res.json()
}

export default function GenerateComicsView() {
  const store = useStore()
  const { setActiveNav, setIsGenerating } = useApp()

  const project = store.project
  const projectId = project?.project_id ?? ''
  const scripts = project?.scripts ?? []

  // Derive done state from localStorage so it survives tab switches
  const [panels, setPanels] = useState<PanelStore>({})
  const [generating, setGenerating] = useState<Record<string, boolean>>({})
  const [topicError, setTopicError] = useState<Record<string, string>>({})

  // Freeze nav while any topic is generating
  useEffect(() => {
    const anyGenerating = Object.values(generating).some(Boolean)
    setIsGenerating(anyGenerating)
  }, [generating, setIsGenerating])

  // Seed from project JSON first, then layer in localStorage (localStorage may be more recent).
  // Also sync any localStorage panels that aren't yet in project.panels back into the store,
  // so the sidebar's hasPanels check sees them.
  useEffect(() => {
    if (!projectId) return
    const fromProject = project?.panels ?? {}
    const fromLocal = loadPanels(projectId)
    const merged = { ...fromProject, ...fromLocal }
    setPanels(merged)
    // Backfill store for any panels only in localStorage
    Object.entries(fromLocal).forEach(([topicId, panel]) => {
      if (!fromProject[topicId]) store.setProjectPanel(topicId, panel)
    })
  }, [projectId])  // eslint-disable-line react-hooks/exhaustive-deps

  async function handleGenerateTopic(idea: ComicIdea) {
    if (!project) return
    setGenerating(g => ({ ...g, [idea.id]: true }))
    setTopicError(e => { const n = { ...e }; delete n[idea.id]; return n })
    try {
      const result = await generateComicScript(idea, project.title)
      // 1. localStorage — survives tab switch even if component unmounts
      savePanel(projectId, idea.id, result)
      // 2. project JSON — persisted to server via debounced save
      store.setProjectPanel(idea.id, result)
      setPanels(p => ({ ...p, [idea.id]: result }))
    } catch (err) {
      setTopicError(e => ({ ...e, [idea.id]: String(err) }))
    } finally {
      setGenerating(g => { const n = { ...g }; delete n[idea.id]; return n })
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Generate Comics</h1>
        <p className={styles.pageSubtitle}>
          Turn your topics into full comic layouts with characters, backgrounds, and speech bubbles.
        </p>
      </div>

      <div className={styles.body}>

        {/* ── Sample strip ── */}
        <div className={styles.sampleSection}>
          <div className={styles.sampleLabel}>Sample Comics</div>
          <div className={styles.sampleStrip}>
            {[1,2,3,4,5,6].map(n => (
              <img
                key={n}
                src={`/samples/comic_gravitrap_0${n}.jpg`}
                alt={`Sample panel ${n}`}
                className={styles.sampleThumb}
              />
            ))}
          </div>
        </div>

        {/* ── Current Project card ── */}
        {project ? (
          <div className={styles.card}>
            <div className={styles.cardBadge}>Current Project</div>
            <div className={styles.cardHeader}>
              <span className={styles.cardIcon}>📖</span>
              <div>
                <div className={styles.cardTitle}>{project.title}</div>
                <div className={styles.cardMeta}>
                  {project.level} · {project.subject}
                  {scripts.length > 0 && ` · ${scripts.length} topics`}
                </div>
              </div>
              <button className={styles.btnViewTopics} onClick={() => setActiveNav('generate-script')}>
                📋 View Topics
              </button>
            </div>

            {/* Per-topic rows */}
            {scripts.length > 0 ? (
              <div className={styles.topicList}>
                {scripts.map((s, i) => {
                  const isGenerating = !!generating[s.id]
                  const isDone = !!panels[s.id]
                  const hasError = !!topicError[s.id]
                  return (
                    <div key={s.id} className={styles.topicRow}>
                      <span className={styles.chipNum}>{i + 1}</span>
                      <span className={styles.topicName}>{s.topic}</span>
                      <div className={styles.topicRowRight}>
                        {hasError && (
                          <span className={styles.topicErr} title={topicError[s.id]}>⚠ Error</span>
                        )}
                        {isDone && !hasError && (
                          <span className={styles.topicDone}>✓ Done</span>
                        )}
                        <button
                          className={`${styles.btnGenTopic} ${isDone && !hasError ? styles.btnGenTopicDone : ''}`}
                          disabled={isGenerating}
                          onClick={() => handleGenerateTopic(s)}
                        >
                          {isGenerating ? '⏳ Generating…'
                            : isDone ? '↺ Regenerate'
                            : '🎬 Generate Comics'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className={styles.noTopicsNote}>
                No topics saved yet. Go to <strong>Generate Script</strong> and save your scripts first.
              </div>
            )}
          </div>
        ) : (
          <div className={styles.noScript}>
            <div className={styles.noScriptIcon}>📝</div>
            <p className={styles.noScriptText}>No project open. Generate a script first.</p>
            <button className={styles.btnOutline} onClick={() => setActiveNav('generate-script')}>
              Go to Generate Script →
            </button>
          </div>
        )}

        {/* ── How it works ── */}
        <div className={styles.infoCard}>
          <div className={styles.infoTitle}>How it works</div>
          <div className={styles.infoSteps}>
            {[
              { n: '1', t: 'Topics are read', d: 'AI reads each topic, objectives, and 3 panel facts' },
              { n: '2', t: 'Scripts are written', d: 'Curiosity question, reveal, trigger, panel dialogues, and closing line are generated' },
              { n: '3', t: 'Image prompts are created', d: 'Photo scene descriptions are generated for each panel — ready for image generation or swap' },
              { n: '4', t: 'Ready to edit', d: 'Open in Edit Comics to adjust panels, swap images, and fine-tune text' },
            ].map(s => (
              <div key={s.n} className={styles.infoStep}>
                <div className={styles.infoStepNum}>{s.n}</div>
                <div>
                  <div className={styles.infoStepTitle}>{s.t}</div>
                  <div className={styles.infoStepDesc}>{s.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
