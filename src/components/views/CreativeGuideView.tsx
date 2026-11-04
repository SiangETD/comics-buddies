import { useState, useRef } from 'react'
import { useCreativeGuide } from '../../hooks/useCreativeGuide'
import type { CharacterBible, CreativeGuide } from '../../types'
import styles from './CreativeGuideView.module.css'

type Section = 'world' | 'characters'

const EMPTY_CHAR: Omit<CharacterBible, 'id'> = {
  name: '', personality: '', speechStyle: '', catchphrases: '',
  strengths: '', struggles: '', specialPower: '',
  appearance: '', signatureItems: '', mannerisms: '', aiImageGuide: '',
}

function filledCount(c: CharacterBible) {
  return [c.personality, c.speechStyle, c.catchphrases, c.strengths, c.struggles].filter(v => v.trim()).length
}

// ── Bible field ────────────────────────────────────────────────────────────────
function BibleField({ label, placeholder, value, onChange, tall }: {
  label: string; placeholder: string; value: string
  onChange: (v: string) => void; tall?: boolean
}) {
  return (
    <div className={styles.bfWrap}>
      <label className={styles.bfLabel}>{label}</label>
      <textarea
        className={`${styles.bfTextarea} ${tall ? styles.bfTall : ''}`}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  )
}

// ── Character edit form ────────────────────────────────────────────────────────
function CharEditForm({ draft, isNew, onChange, onSave, onCancel, saveAsset }: {
  draft: Omit<CharacterBible, 'id'>
  isNew: boolean
  onChange: (field: keyof Omit<CharacterBible, 'id'>, value: string) => void
  onSave: () => void
  onCancel: () => void
  saveAsset: (file: File) => Promise<string | undefined>
}) {
  const imageRef = useRef<HTMLInputElement>(null)
  const [imgDrag, setImgDrag] = useState(false)
  const [uploading, setUploading] = useState(false)

  async function handleImageFile(file: File) {
    if (!file.type.startsWith('image/')) return
    setUploading(true)
    const url = await saveAsset(file)
    if (url) onChange('image' as keyof Omit<CharacterBible, 'id'>, url)
    setUploading(false)
  }

  return (
    <div className={styles.editForm}>
      <h3 className={styles.editFormTitle}>{isNew ? 'New Character' : `Edit — ${draft.name}`}</h3>

      {/* Name + image row */}
      <div className={styles.nameRow}>
        {/* Image upload */}
        <div className={styles.imageCol}>
          <label className={styles.bfLabel}>Image</label>
          <button
            type="button"
            className={`${styles.imageBox} ${imgDrag ? styles.imageBoxDrag : ''}`}
            onClick={() => imageRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setImgDrag(true) }}
            onDragLeave={() => setImgDrag(false)}
            onDrop={e => { e.preventDefault(); setImgDrag(false); const f = e.dataTransfer.files[0]; if (f) handleImageFile(f) }}
          >
            {uploading ? (
              <span className={styles.imageUploadHint}>Saving…</span>
            ) : (draft as CharacterBible).image ? (
              <img src={(draft as CharacterBible).image} alt={draft.name} className={styles.imagePreview} />
            ) : (
              <span className={styles.imageUploadHint}>{imgDrag ? '⬇️' : '📷'}</span>
            )}
          </button>
          {(draft as CharacterBible).image && (
            <button type="button" className={styles.imageRemove}
              onClick={() => onChange('image' as keyof Omit<CharacterBible, 'id'>, '')}>
              Remove
            </button>
          )}
          <input ref={imageRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleImageFile(f); e.target.value = '' }} />
        </div>

        {/* Name */}
        <div className={styles.nameCol}>
          <label className={styles.bfLabel}>Character Name <span className={styles.req}>*</span></label>
          <input
            autoFocus
            className={styles.nameInput}
            placeholder="e.g. Bouncy, Ms. G, Pok Pok…"
            value={draft.name}
            onChange={e => onChange('name', e.target.value)}
          />
          <p className={styles.imageHint}>Click or drag an image onto the photo box.</p>
        </div>
      </div>

      {/* Personality section */}
      <div className={styles.formSection}>
        <div className={styles.sectionDivider}>Personality</div>
        <div className={styles.fieldGrid2}>
          <BibleField label="Personality" placeholder="e.g. Witty, cheerful, competitive — driven to succeed" value={draft.personality} onChange={v => onChange('personality', v)} />
          <BibleField label="Speech Style" placeholder='e.g. Short punchy sentences, rallying tone, overconfident' value={draft.speechStyle} onChange={v => onChange('speechStyle', v)} />
          <BibleField label="Catchphrases" placeholder={`e.g. "Something's fishy!", "I can feel it in my gut!"`} value={draft.catchphrases} onChange={v => onChange('catchphrases', v)} />
          <BibleField label="Strengths" placeholder="e.g. Adaptable, charming, natural leader under pressure" value={draft.strengths} onChange={v => onChange('strengths', v)} />
          <BibleField label="Struggles" placeholder="e.g. Ties worth to achievements, freezes when overstressed" value={draft.struggles} onChange={v => onChange('struggles', v)} />
        </div>
      </div>

      {/* Appearance section */}
      <div className={styles.formSection}>
        <div className={styles.sectionDivider}>Appearance & Special Power</div>
        <div className={styles.fieldGrid2}>
          <BibleField label="Appearance" placeholder="e.g. Round white fishball shape, large expressive eyes" value={draft.appearance} onChange={v => onChange('appearance', v)} />
          <BibleField label="Signature Items" placeholder="e.g. Always carries a small notebook" value={draft.signatureItems} onChange={v => onChange('signatureItems', v)} />
          <BibleField label="Mannerisms" placeholder="e.g. Bounces slightly even when standing still" value={draft.mannerisms} onChange={v => onChange('mannerisms', v)} />
          <BibleField label="Special Power" placeholder="e.g. Can recall any fact from any book ever written" value={draft.specialPower} onChange={v => onChange('specialPower', v)} />
        </div>
      </div>

      {/* AI Image Guide */}
      <div className={styles.formSection}>
        <div className={styles.sectionDivider}>AI Image Consistency Guide</div>
        <div className={styles.aiGuideNote}>
          <span>🎨</span>
          <p>Sent to image AI instead of the fields above. Write exact visual specs — body shape, face details, limb style, proportions. The more precise, the more consistent the character looks across panels.</p>
        </div>
        <textarea
          className={styles.aiGuideTextarea}
          placeholder={`e.g.\nRound white fishball shape, approximately 1.2x wider than tall.\nNo neck, no torso separation.\nFace: two small dark circular eyes, tiny white highlights, small pink open mouth.\nArms and legs: extremely short thin dark lines, no elbows or knees.\nMaintain these proportions exactly in every panel.`}
          value={draft.aiImageGuide}
          onChange={e => onChange('aiImageGuide', e.target.value)}
        />
      </div>

      {/* Save / Cancel */}
      <div className={styles.editActions}>
        <button className={styles.btnSave} disabled={!draft.name.trim()} onClick={onSave}>
          {isNew ? 'Create Character' : 'Save Changes'}
        </button>
        <button className={styles.btnCancel} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

// ── Main view ──────────────────────────────────────────────────────────────────
export default function CreativeGuideView() {
  const { guide, setGuide, exportGuide, importGuide, resetToDefaults } = useCreativeGuide()
  const [section, setSection] = useState<Section>('world')

  // World state
  const [worldDraft, setWorldDraft] = useState(guide.worldSetting)
  const [aiWorldDraft, setAiWorldDraft] = useState(guide.aiWorldGuide)
  const [worldSaved, setWorldSaved] = useState(false)

  // Characters state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Omit<CharacterBible, 'id'>>(EMPTY_CHAR)
  const [isNew, setIsNew] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  // Import / export
  const importRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState('')

  function saveWorld() {
    const next: CreativeGuide = { ...guide, worldSetting: worldDraft, aiWorldGuide: aiWorldDraft }
    setGuide(next)
    setWorldSaved(true)
    setTimeout(() => setWorldSaved(false), 2000)
  }

  function startNew() {
    setDraft({ ...EMPTY_CHAR })
    setEditingId('__new__')
    setIsNew(true)
  }

  function startEdit(c: CharacterBible) {
    setDraft({ ...c })
    setEditingId(c.id)
    setIsNew(false)
  }

  function cancelEdit() {
    setEditingId(null)
    setIsNew(false)
    setDraft({ ...EMPTY_CHAR })
  }

  function saveChar() {
    if (!draft.name.trim()) return
    let next: CreativeGuide
    if (isNew) {
      const entry: CharacterBible = { ...draft, id: `char_${Date.now()}` }
      next = { ...guide, characters: [...guide.characters, entry] }
    } else {
      next = {
        ...guide,
        characters: guide.characters.map(c => c.id === editingId ? { ...c, ...draft } : c),
      }
    }
    setGuide(next)
    cancelEdit()
  }

  function deleteChar(id: string) {
    setGuide({ ...guide, characters: guide.characters.filter(c => c.id !== id) })
    setDeleteTarget(null)
  }

  function updateDraft(field: keyof Omit<CharacterBible, 'id'>, value: string) {
    setDraft(prev => ({ ...prev, [field]: value }))
  }

  async function saveAsset(file: File): Promise<string | undefined> {
    // Store image as data URL for the character bible
    return new Promise(resolve => {
      const reader = new FileReader()
      reader.onload = e => resolve(e.target?.result as string)
      reader.readAsDataURL(file)
    })
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportMsg('')
    try {
      await importGuide(file)
      setWorldDraft(guide.worldSetting)  // will re-read from hook on next render
      setImportMsg('✓ Imported successfully')
    } catch {
      setImportMsg('✗ Invalid guide file')
    }
    setImporting(false)
    e.target.value = ''
    // Reload world drafts after import
    setTimeout(() => setImportMsg(''), 3000)
  }

  // After import, sync world drafts
  const syncedWorldRef = useRef(guide.id)
  if (syncedWorldRef.current !== guide.id) {
    syncedWorldRef.current = guide.id
    setWorldDraft(guide.worldSetting)
    setAiWorldDraft(guide.aiWorldGuide)
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.headerRow}>
          <div>
            <h1 className={styles.pageTitle}>Creative Guide</h1>
            <p className={styles.pageSubtitle}>Character bibles and world setting — shared with Ani Buddies.</p>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.btnImport} onClick={() => importRef.current?.click()} disabled={importing}>
              {importing ? '⏳ Importing…' : '⬆ Import from Ani Buddies'}
            </button>
            <button className={styles.btnExport} onClick={exportGuide}>
              ⬇ Export to Ani Buddies
            </button>
            <input ref={importRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
          </div>
        </div>
        {importMsg && (
          <div className={`${styles.importMsg} ${importMsg.startsWith('✓') ? styles.importOk : styles.importErr}`}>
            {importMsg}
          </div>
        )}
      </div>

      <div className={styles.layout}>
        {/* ── Sub-nav ── */}
        <div className={styles.subNav}>
          <button
            className={`${styles.subNavBtn} ${section === 'world' ? styles.subNavActive : ''}`}
            onClick={() => setSection('world')}
          >
            🌍 World
          </button>
          <button
            className={`${styles.subNavBtn} ${section === 'characters' ? styles.subNavActive : ''}`}
            onClick={() => setSection('characters')}
          >
            🎭 Characters
            <span className={styles.badge}>{guide.characters.length}</span>
          </button>
          <div className={styles.subNavSpacer} />
          <button className={styles.btnReset} onClick={() => {
            if (confirm('Reset to Yummy Buddies defaults? This will overwrite your current guide.')) resetToDefaults()
          }}>
            ↺ Reset defaults
          </button>
        </div>

        {/* ── Content ── */}
        <div className={styles.content}>

          {/* ══ WORLD ══ */}
          {section === 'world' && (
            <div className={styles.worldSection}>
              <div className={styles.sectionHeader}>
                <div>
                  <div className={styles.sectionTitle}>World Setting</div>
                  <div className={styles.sectionDesc}>The show's universe, rules, and tone. Injected into every script prompt.</div>
                </div>
                <button
                  className={`${styles.btnSaveWorld} ${worldSaved ? styles.btnSaved : ''}`}
                  onClick={saveWorld}
                >
                  {worldSaved ? '✓ Saved' : 'Save'}
                </button>
              </div>

              <textarea
                className={styles.worldTextarea}
                value={worldDraft}
                onChange={e => { setWorldDraft(e.target.value); setWorldSaved(false) }}
                placeholder="Describe the world of your show…"
              />

              <div className={styles.tip}>
                💡 Keep it concise — 2–4 paragraphs. Focus on tone, setting, and rules that affect every episode.
              </div>

              {/* AI Visual Guide */}
              <div className={styles.aiWorldSection}>
                <div className={styles.sectionTitle}>AI Image World Guide</div>
                <div className={styles.sectionDesc}>Used by image generation instead of the full world text above. Describe the visual world — scale, environment style, how backgrounds look.</div>
                <div className={styles.aiGuideNote}>
                  <span>🎨</span>
                  <p>Focus on what the image AI needs: world scale, environment appearance, how characters relate to the world physically. Skip plot, tone, and character personality.</p>
                </div>
                <textarea
                  className={styles.worldTextarea}
                  style={{ minHeight: 160 }}
                  value={aiWorldDraft}
                  onChange={e => { setAiWorldDraft(e.target.value); setWorldSaved(false) }}
                  placeholder="e.g. Bright, clean, flat-colour illustration style. Singapore primary school environments…"
                />
              </div>

              <button
                className={`${styles.btnSaveWorld} ${styles.btnSaveWorldFull} ${worldSaved ? styles.btnSaved : ''}`}
                onClick={saveWorld}
              >
                {worldSaved ? '✓ Saved' : 'Save World Setting'}
              </button>
            </div>
          )}

          {/* ══ CHARACTERS ══ */}
          {section === 'characters' && (
            <div className={styles.charsSection}>
              <div className={styles.sectionHeader}>
                <div>
                  <div className={styles.sectionTitle}>Characters</div>
                  <div className={styles.sectionDesc}>Define each character's voice. These bibles are used when generating scripts.</div>
                </div>
                {editingId === null && (
                  <button className={styles.btnNewChar} onClick={startNew}>+ New Character</button>
                )}
              </div>

              {/* Edit form */}
              {editingId !== null && (
                <CharEditForm
                  draft={draft}
                  isNew={isNew}
                  onChange={updateDraft}
                  onSave={saveChar}
                  onCancel={cancelEdit}
                  saveAsset={saveAsset}
                />
              )}

              {/* Character list */}
              {guide.characters.length === 0 && editingId === null ? (
                <div className={styles.emptyChars}>
                  <div className={styles.emptyIcon}>🎭</div>
                  <p className={styles.emptyTitle}>No characters yet</p>
                  <p className={styles.emptyDesc}>Add a character to give them a consistent voice in every generated script.</p>
                  <button className={styles.btnNewChar} onClick={startNew}>+ New Character</button>
                </div>
              ) : (
                <div className={styles.charGrid}>
                  {guide.characters.map(c => (
                    <div
                      key={c.id}
                      className={`${styles.charCard} ${editingId === c.id ? styles.charCardEditing : ''}`}
                    >
                      <div className={styles.charCardTop}>
                        <div className={styles.charCardLeft}>
                          <div className={styles.charThumb}>
                            {c.image
                              ? <img src={c.image} alt={c.name} className={styles.charThumbImg} />
                              : <span className={styles.charThumbInitial}>{c.name.charAt(0).toUpperCase()}</span>
                            }
                          </div>
                          <div>
                            <div className={styles.charCardName}>{c.name}</div>
                            <div className={styles.charCardMeta}>
                              {filledCount(c)}/5 fields filled
                              {c.catchphrases && (
                                <span className={styles.charCardQuote}>
                                  · "{c.catchphrases.split(',')[0].replace(/['"]/g, '').trim()}"
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className={styles.charCardActions}>
                          {editingId !== c.id && (
                            <button className={styles.btnEdit} onClick={() => startEdit(c)}>Edit</button>
                          )}
                          <button className={styles.btnDelete} onClick={() => setDeleteTarget(c.id)} title="Delete">🗑️</button>
                        </div>
                      </div>
                      {editingId !== c.id && c.personality && (
                        <div className={styles.charCardPersonality}>{c.personality}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Delete modal ── */}
      {deleteTarget && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalIcon}>🗑️</div>
            <h2 className={styles.modalTitle}>Delete Character</h2>
            <p className={styles.modalDesc}>
              Delete <strong>"{guide.characters.find(c => c.id === deleteTarget)?.name}"</strong>? This cannot be undone.
            </p>
            <div className={styles.modalActions}>
              <button className={styles.btnCancel} onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className={styles.btnDeleteConfirm} onClick={() => deleteChar(deleteTarget)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
