import { useRef, useState, useEffect } from 'react'
import { useStore, useApp } from '../../App'
import { useCreativeGuide } from '../../hooks/useCreativeGuide'
import { listProjects, loadProjectFromServer, deleteProjectFromServer } from '../../services/api'
import type { ComicProject } from '../../types'
import styles from './ProjectView.module.css'

const SUBJECTS = [
  'English', 'Maths', 'Science', 'Social Studies',
  'Health Education', 'CCE', 'Art', 'Music', 'PE', 'Others',
]
const LEVELS = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6']

function parseSubjects(s: string): string[] {
  return s ? s.split(', ').filter(x => SUBJECTS.includes(x)) : []
}
function parseLevels(s: string): string[] {
  return s ? s.split(', ').filter(x => LEVELS.includes(x)) : []
}

export default function ProjectView() {
  const store = useStore()
  const { setActiveNav, openProjectEdit, setOpenProjectEdit } = useApp()
  const { guide } = useCreativeGuide()
  const fileRef = useRef<HTMLInputElement>(null)
  const [loadDragging, setLoadDragging] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [recentProjects, setRecentProjects] = useState<{ project_id: string; title: string; updated_at: string }[]>([])
  const [loadingRecent, setLoadingRecent] = useState(false)

  useEffect(() => {
    setLoadingRecent(true)
    listProjects()
      .then(list => setRecentProjects(list.sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 8)))
      .finally(() => setLoadingRecent(false))
  }, [store.project])

  // Open edit form when sidebar pill is clicked
  useEffect(() => {
    if (openProjectEdit && store.project) {
      openEdit()
      setOpenProjectEdit(false)
    }
  }, [openProjectEdit])

  // ── New project form state ─────────────────────────────────────────────────
  const [newName, setNewName] = useState('')
  const [newSubjects, setNewSubjects] = useState<string[]>([])
  const [newLevels, setNewLevels] = useState<string[]>(['P3'])

  function handleCreateProject() {
    if (!newName.trim()) return
    const now = new Date().toISOString()
    const project: ComicProject = {
      project_id: crypto.randomUUID(),
      title: newName.trim(),
      topic: '',
      learning_objective: '',
      subject: newSubjects.join(', ') || 'General',
      level: newLevels.join(', ') || 'P3',
      characters: ['bouncy', 'merry', 'pokpok'],
      created_at: now,
      updated_at: now,
      pages: [],
    }
    store.loadProject(project)
    setActiveNav('generate-script')
  }

  // ── Edit project form state ────────────────────────────────────────────────
  const [editName, setEditName] = useState('')
  const [editSubjects, setEditSubjects] = useState<string[]>([])
  const [editLevels, setEditLevels] = useState<string[]>([])

  function openEdit() {
    if (!store.project) return
    setEditName(store.project.title)
    setEditSubjects(parseSubjects(store.project.subject))
    setEditLevels(parseLevels(store.project.level))
    setShowEdit(true)
  }

  function handleSaveInfo() {
    if (!store.project || !editName.trim()) return
    store.loadProject({
      ...store.project,
      title: editName.trim(),
      subject: editSubjects.join(', ') || 'General',
      level: editLevels.join(', ') || 'P3',
      updated_at: new Date().toISOString(),
    })
    setShowEdit(false)
  }

  async function handleDeleteProject() {
    if (!confirm(`Delete "${store.project?.title}"? This cannot be undone.`)) return
    const id = store.project!.project_id
    await deleteProjectFromServer(id)
    store.closeProject()
    setShowEdit(false)
  }

  // ── File load ─────────────────────────────────────────────────────────────
  function parseAndLoad(file: File) {
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target?.result as string)
        store.loadProject(data)
        setActiveNav('generate-script')
      } catch {
        alert('Invalid project file.')
      }
    }
    reader.readAsText(file)
  }

  function handleLoad(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) parseAndLoad(file)
    e.target.value = ''
  }

  function handleLoadDrop(e: React.DragEvent) {
    e.preventDefault()
    setLoadDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && file.name.endsWith('.json')) parseAndLoad(file)
  }

  async function handleLoadRecent(projectId: string) {
    const data = await loadProjectFromServer(projectId)
    if (data) {
      store.loadProject(data as ComicProject)
      setActiveNav('generate-script')
    }
  }

  function handleExport() {
    if (!store.project) return
    const blob = new Blob([JSON.stringify(store.project, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${store.project.project_id}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const canCreate = newName.trim().length > 0 && newLevels.length > 0
  const canSaveEdit = editName.trim().length > 0 && editLevels.length > 0

  return (
    <div className={styles.page}>

      {/* ── Page header ── */}
      <div className={styles.pageHeader}>
        <div className={styles.pageTitleRow}>
          {store.project && !showEdit && (
            <button className={styles.btnHeaderBack} onClick={() => store.closeProject()}>←</button>
          )}
          {store.project && showEdit && (
            <button className={styles.btnHeaderBack} onClick={() => setShowEdit(false)}>←</button>
          )}
          <h1 className={styles.pageTitle}>Project</h1>
        </div>
        <p className={styles.pageSubtitle}>Create a new comic project or open an existing one.</p>
      </div>

      <div className={styles.body}>

        {/* ── No project — landing ── */}
        {!store.project && !showForm && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📖</div>
            <h2 className={styles.emptyTitle}>No project open</h2>
            <p className={styles.emptyText}>Start a new project or load an existing one to begin.</p>
            <div className={styles.bigCardRow}>
              <button className={styles.bigCard} onClick={() => { setNewName(''); setNewSubjects([]); setNewLevels(['P3']); setShowForm(true) }}>
                <div className={styles.bigCardIcon}>📝</div>
                <div className={styles.bigCardTitle}>Start New Project</div>
                <div className={styles.bigCardDesc}>Set up a new comic project</div>
              </button>
              <button
                className={`${styles.bigCard} ${loadDragging ? styles.bigCardDragging : ''}`}
                onClick={() => fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setLoadDragging(true) }}
                onDragLeave={() => setLoadDragging(false)}
                onDrop={handleLoadDrop}
              >
                <div className={styles.bigCardIcon}>{loadDragging ? '⬇️' : '📂'}</div>
                <div className={styles.bigCardTitle}>{loadDragging ? 'Drop to load' : 'Load Project'}</div>
                <div className={styles.bigCardDesc}>{loadDragging ? 'Release to open' : 'Click or drop a .json project file'}</div>
              </button>
            </div>

            {!loadingRecent && recentProjects.length > 0 && (
              <div className={styles.recentWrap}>
                <div className={styles.recentLabel}>Recently edited</div>
                <div className={styles.recentList}>
                  {recentProjects.map(p => (
                    <button key={p.project_id} className={styles.recentRow} onClick={() => handleLoadRecent(p.project_id)}>
                      <span className={styles.recentIcon}>📖</span>
                      <div className={styles.recentInfo}>
                        <span className={styles.recentTitle}>{p.title}</span>
                        <span className={styles.recentDate}>
                          {new Date(p.updated_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <span className={styles.recentArrow}>→</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── New project form ── */}
        {!store.project && showForm && (
          <div className={styles.formWrap}>
            <div className={styles.formCard}>
              <div className={styles.formHeader}>
                <h2 className={styles.formTitle}>New Project</h2>
                <button className={styles.btnBack} onClick={() => setShowForm(false)}>← Back</button>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Project Name <span className={styles.required}>*</span></label>
                <input className={styles.input} placeholder="e.g. P3 Science — Water Cycle" value={newName} onChange={e => setNewName(e.target.value)} />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Subject</label>
                <p className={styles.hint}>Select all that apply.</p>
                <div className={styles.checkGrid}>
                  {SUBJECTS.map(s => {
                    const on = newSubjects.includes(s)
                    return (
                      <label key={s} className={`${styles.checkLabel} ${on ? styles.checkLabelOn : ''}`}>
                        <div className={`${styles.checkbox} ${on ? styles.checkboxOn : ''}`}>{on && <span className={styles.checkmark}>✓</span>}</div>
                        <input type="checkbox" style={{ display: 'none' }} checked={on} onChange={() => setNewSubjects(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])} />
                        {s}
                      </label>
                    )
                  })}
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Primary Level <span className={styles.required}>*</span></label>
                <p className={styles.hint}>Select one or more levels.</p>
                <div className={styles.levelRow}>
                  {LEVELS.map(l => {
                    const on = newLevels.includes(l)
                    return (
                      <button key={l} type="button" className={`${styles.levelPill} ${on ? styles.levelPillOn : ''}`}
                        onClick={() => setNewLevels(prev => prev.includes(l) ? prev.filter(x => x !== l) : [...prev, l])}>
                        {l}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Creative Guide</label>
                <p className={styles.hint}>Character bibles and world setting used for this project.</p>
                <div className={styles.guideDisplay}>
                  <span className={styles.guideIcon}>🎨</span>
                  <div>
                    <div className={styles.guideName}>{guide.name}</div>
                    <div className={styles.guideNote}>
                      {guide.characters.length} character{guide.characters.length !== 1 ? 's' : ''} ·{' '}
                      <button className={styles.guideLinkBtn} onClick={() => setActiveNav('creative-guide')}>Edit in Creative Guide →</button>
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.formActions}>
                <button className={styles.btnCreate} disabled={!canCreate} onClick={handleCreateProject}>Save Project</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Project loaded — view ── */}
        {store.project && !showEdit && (
          <div className={styles.twoCol}>

            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.cardIcon}>📖</span>
                <h2 className={styles.cardTitle}>{store.project.title}</h2>
                <button className={styles.btnEditInfo} onClick={openEdit}>✏️ Edit Project Info</button>
              </div>

              <div className={styles.metaGrid}>
                {store.project.topic && (
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Topic</span>
                    <span className={styles.metaValue}>{store.project.topic}</span>
                  </div>
                )}
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>Subject</span>
                  <span className={styles.metaValue}>{store.project.subject}</span>
                </div>
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>Level</span>
                  <span className={styles.metaValue}>{store.project.level}</span>
                </div>
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>Pages</span>
                  <span className={styles.metaValue}>{store.project.pages.length} pages</span>
                </div>
                {store.project.characters?.length > 0 && (
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Characters</span>
                    <span className={styles.metaValue}>{store.project.characters.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(', ')}</span>
                  </div>
                )}
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>Last saved</span>
                  <span className={styles.metaValue}>{new Date(store.project.updated_at).toLocaleString()}</span>
                </div>
              </div>

              {store.project.learning_objective && (
                <div className={styles.objectiveBox}>
                  <span className={styles.objectiveLabel}>Learning Objective</span>
                  <p className={styles.objectiveText}>{store.project.learning_objective}</p>
                </div>
              )}

              <div className={styles.cardActions}>
                {store.project.pages.length > 0 && (
                  <button className={styles.btnPrimary} onClick={() => setActiveNav('review-comics')}>📋 Review Script</button>
                )}
                <button className={styles.btnOutline} onClick={handleExport}>💾 Export Project</button>
              </div>
            </div>

            <div className={styles.sideActions}>
              <h3 className={styles.sideTitle}>Quick Actions</h3>
              <button className={styles.actionCard} onClick={() => setActiveNav('generate-script')}>
                <span className={styles.actionIcon}>📝</span>
                <div><div className={styles.actionTitle}>Generate Script</div><div className={styles.actionDesc}>Write a new comic script with AI</div></div>
              </button>
              <button className={styles.actionCard} onClick={() => setActiveNav('generate-comics')}>
                <span className={styles.actionIcon}>🎬</span>
                <div><div className={styles.actionTitle}>Generate Comics</div><div className={styles.actionDesc}>Turn your script into a comic layout</div></div>
              </button>
              <button className={styles.actionCard} onClick={() => setActiveNav('review-comics')}>
                <span className={styles.actionIcon}>📋</span>
                <div><div className={styles.actionTitle}>Review Script</div><div className={styles.actionDesc}>Review comic scripts before creating panels</div></div>
              </button>
              <div className={styles.divider} />
              <button className={styles.actionCardSecondary} onClick={() => { store.closeProject(); setNewName(''); setNewSubjects([]); setNewLevels(['P3']); setShowForm(true) }}>
                <span className={styles.actionIcon}>📝</span>
                <div><div className={styles.actionTitle}>New Project</div><div className={styles.actionDesc}>Create a new comic project</div></div>
              </button>
              <button className={styles.actionCardSecondary} onClick={() => fileRef.current?.click()}>
                <span className={styles.actionIcon}>📂</span>
                <div><div className={styles.actionTitle}>Load Project</div><div className={styles.actionDesc}>Open a saved Comics Buddies project</div></div>
              </button>
            </div>
          </div>
        )}

        {/* ── Edit project info ── */}
        {store.project && showEdit && (
          <div className={styles.formWrap}>
            <div className={styles.formCard}>
              <div className={styles.formHeader}>
                <h2 className={styles.formTitle}>Edit Project Info</h2>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Project Name <span className={styles.required}>*</span></label>
                <input className={styles.input} value={editName} onChange={e => setEditName(e.target.value)} />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Subject</label>
                <p className={styles.hint}>Select all that apply.</p>
                <div className={styles.checkGrid}>
                  {SUBJECTS.map(s => {
                    const on = editSubjects.includes(s)
                    return (
                      <label key={s} className={`${styles.checkLabel} ${on ? styles.checkLabelOn : ''}`}>
                        <div className={`${styles.checkbox} ${on ? styles.checkboxOn : ''}`}>{on && <span className={styles.checkmark}>✓</span>}</div>
                        <input type="checkbox" style={{ display: 'none' }} checked={on} onChange={() => setEditSubjects(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])} />
                        {s}
                      </label>
                    )
                  })}
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Primary Level <span className={styles.required}>*</span></label>
                <p className={styles.hint}>Select one or more levels.</p>
                <div className={styles.levelRow}>
                  {LEVELS.map(l => {
                    const on = editLevels.includes(l)
                    return (
                      <button key={l} type="button" className={`${styles.levelPill} ${on ? styles.levelPillOn : ''}`}
                        onClick={() => setEditLevels(prev => prev.includes(l) ? prev.filter(x => x !== l) : [...prev, l])}>
                        {l}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className={styles.editActions}>
                <button className={styles.btnCreate} disabled={!canSaveEdit} onClick={handleSaveInfo}>
                  Save Project Info
                </button>
                <button className={styles.btnDelete} onClick={handleDeleteProject}>
                  🗑 Delete Project
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      <input type="file" accept=".json" ref={fileRef} style={{ display: 'none' }} onChange={handleLoad} />
    </div>
  )
}
