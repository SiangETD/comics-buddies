import { useState, useRef } from 'react'
import { useStore } from '../../App'
import { useCharImages } from '../../App'
import { assetLibrary } from '../../data/assetLibrary'
import type { CharacterName, CharacterAsset } from '../../types'
import styles from './LibraryView.module.css'

type Section = 'characters' | 'backgrounds' | 'objects' | 'generated'

const CHAR_LABELS: Record<CharacterName, string> = { bouncy: 'Bouncy', merry: 'Merry', pokpok: 'Pokpok' }
const CHAR_COLORS: Record<CharacterName, string> = { bouncy: '#e94560', merry: '#f5a623', pokpok: '#4ade80' }

const POSE_ICONS: Record<string, string> = {
  happy: '😊', pointing: '👉', thinking: '🤔', wow: '😮',
  shocked: '😱', angry: '😠', confused: '😕', excited: '🤩',
  worried: '😟', explaining: '🗣️', holding_book: '📚',
}

// ── Single pose upload card ─────────────────────────────────────────────────
function PoseCard({ asset, color }: { asset: CharacterAsset; color: string }) {
  const { getImage, setImage, removeImage } = useCharImages()
  const [dragging, setDragging] = useState(false)
  const dragCounter = useRef(0)
  const fileRef = useRef<HTMLInputElement>(null)
  const uploadedUrl = getImage(asset.asset_id)

  function readFile(file: File) {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = e => {
      if (e.target?.result) setImage(asset.asset_id, e.target.result as string)
    }
    reader.readAsDataURL(file)
  }

  function onDragEnter(e: React.DragEvent) {
    e.preventDefault()
    dragCounter.current++
    setDragging(true)
  }

  function onDragLeave(e: React.DragEvent) {
    e.preventDefault()
    dragCounter.current--
    if (dragCounter.current === 0) setDragging(false)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current = 0
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) readFile(file)
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) readFile(file)
    e.target.value = ''
  }

  const filename = `${asset.pose}.png`
  const savedPath = `public/assets/characters/${asset.character}/${filename}`

  return (
    <div className={styles.poseCard}>
      {/* Drop zone */}
      <div
        className={`${styles.dropZone} ${dragging ? styles.dropZoneDrag : ''} ${uploadedUrl ? styles.dropZoneHasImage : ''}`}
        onDragOver={e => e.preventDefault()}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
        title="Click or drag an image here"
      >
        {uploadedUrl ? (
          <img src={uploadedUrl} alt={asset.pose} className={styles.posePreview} />
        ) : (
          <div className={styles.dropPlaceholder}>
            <span className={styles.poseEmoji}>{POSE_ICONS[asset.pose] ?? '🖼️'}</span>
            <span className={styles.dropHint}>Drop image<br />or click</span>
          </div>
        )}
        {dragging && <div className={styles.dropOverlay}>Drop here</div>}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={onFileChange}
      />

      {/* Pose label */}
      <div className={styles.poseLabel} style={{ color }}>
        {asset.pose.replace('_', ' ')}
      </div>
      <div className={styles.poseFilename}>{filename}</div>

      {/* Saved indicator + remove */}
      {uploadedUrl && (
        <>
          <div className={styles.savedBadge} title={savedPath}>Saved ✓</div>
          <button
            className={styles.poseBtnRemove}
            onClick={() => removeImage(asset.asset_id)}
            title="Remove uploaded image"
          >
            ✕ Remove
          </button>
        </>
      )}
    </div>
  )
}

// ── Character group (expandable) ─────────────────────────────────────────────
function CharGroup({ character }: { character: CharacterName }) {
  const { getImage } = useCharImages()
  const [open, setOpen] = useState(true)
  const poses = assetLibrary.characters.filter(a => a.character === character)
  const uploadedCount = poses.filter(p => getImage(p.asset_id)).length
  const color = CHAR_COLORS[character]

  return (
    <div className={styles.charGroup}>
      <button className={styles.charGroupHeader} onClick={() => setOpen(o => !o)}>
        <div className={styles.charAvatar} style={{ background: color }}>
          {CHAR_LABELS[character][0]}
        </div>
        <span className={styles.charGroupName}>{CHAR_LABELS[character]}</span>
        <span className={styles.charGroupCount}>
          {uploadedCount}/{poses.length} uploaded
        </span>
        <span className={styles.chevron}>{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className={styles.poseGrid}>
          {poses.map(pose => (
            <PoseCard key={pose.asset_id} asset={pose} color={color} />
          ))}
        </div>
      )}
    </div>
  )
}

const IMAGE_LABELS: Record<string, string> = {
  panel1:        'Background',
  panel2_object: 'Object',
  panel4_scene:  'Scene — Fact 1',
  panel5_scene:  'Scene — Fact 2',
  panel6_scene:  'Scene — Fact 3',
}

function GeneratedAssetsSection() {
  const store = useStore()
  const project = store.project
  const [openTopics, setOpenTopics] = useState<Record<string,boolean>>({})

  if (!project) return (
    <div className={styles.emptyNote}>No project open. Open a project first.</div>
  )

  const createdComics = project.createdComics ?? {}
  const scripts = project.scripts ?? []
  const entries = scripts.filter(s => createdComics[s.id])

  if (entries.length === 0) return (
    <div className={styles.emptyNote}>
      No generated images yet. Generate comic panels from Review Script, then come back here.
    </div>
  )

  function toggleTopic(id: string) {
    setOpenTopics(prev => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className={styles.genSection}>
      <div className={styles.genProjectHeader}>
        <span className={styles.genProjectIcon}>📁</span>
        <span className={styles.genProjectName}>{project.title}</span>
        <span className={styles.genProjectCount}>{entries.length} topic{entries.length !== 1 ? 's' : ''}</span>
      </div>

      {entries.map(s => {
        const comic = createdComics[s.id]
        const images = comic.images
        const isOpen = openTopics[s.id] !== false  // default open
        const imgEntries = Object.entries(images) as [string, string][]

        return (
          <div key={s.id} className={styles.genTopicGroup}>
            <button className={styles.genTopicHeader} onClick={() => toggleTopic(s.id)}>
              <span className={styles.genTopicChevron}>{isOpen ? '▾' : '▸'}</span>
              <span className={styles.genTopicName}>{s.topic}</span>
              <span className={styles.genTopicCount}>{imgEntries.length} images</span>
            </button>

            {isOpen && (
              <div className={styles.genImageGrid}>
                {imgEntries.map(([key, url]) => (
                  <div key={key} className={styles.genImageCard}>
                    <div className={styles.genImageThumb}>
                      <img src={url} alt={IMAGE_LABELS[key] ?? key}
                        className={styles.genImagePreview}
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                    </div>
                    <div className={styles.genImageLabel}>{IMAGE_LABELS[key] ?? key}</div>
                    <a href={url} download={`${key}.png`} target="_blank" rel="noreferrer"
                      className={styles.genImageDownload}>↓ Download</a>
                  </div>
                ))}
                {comic.exports?.map((url, idx) => (
                  <div key={`exp${idx}`} className={styles.genImageCard}>
                    <div className={styles.genImageThumb}>
                      <img src={url} alt="A4 Export" className={styles.genImagePreview}
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}/>
                    </div>
                    <div className={styles.genImageLabel}>
                      A4 Export{(comic.exports?.length ?? 0) > 1 ? ` ${idx+1}` : ''}
                    </div>
                    <a href={url} download={`export-${idx+1}.png`} target="_blank" rel="noreferrer"
                      className={styles.genImageDownload}>↓ Download</a>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Main Library View ─────────────────────────────────────────────────────────
export default function LibraryView() {
  const store = useStore()
  const [section, setSection] = useState<Section>('characters')

  const NAV: { id: Section; label: string; icon: string }[] = [
    { id: 'characters',  icon: '👤', label: 'Characters' },
    { id: 'backgrounds', icon: '🖼️', label: 'Backgrounds' },
    { id: 'objects',     icon: '📦', label: 'Objects' },
    { id: 'generated',  icon: '🎨', label: 'Generated Assets' },
  ]

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Library</h1>
        <p className={styles.pageSubtitle}>Browse and upload assets for your comics.</p>
      </div>

      <div className={styles.body}>
        {/* Sub-nav */}
        <div className={styles.subNav}>
          {NAV.map(n => (
            <button
              key={n.id}
              className={`${styles.subNavBtn} ${section === n.id ? styles.subNavActive : ''}`}
              onClick={() => setSection(n.id)}
            >
              <span>{n.icon}</span> {n.label}
            </button>
          ))}
        </div>

        {/* ── Characters ── */}
        {section === 'characters' && (
          <div className={styles.content}>
            <div className={styles.breadcrumb}>Library › Characters</div>
            <div className={styles.uploadNote}>
              Drag an image onto a pose slot, or click to browse. Images are saved automatically as PNGs into <strong>public/assets/characters/</strong> — no manual copying needed.
            </div>
            {(['bouncy', 'merry', 'pokpok'] as CharacterName[]).map(c => (
              <CharGroup key={c} character={c} />
            ))}
          </div>
        )}

        {/* ── Backgrounds ── */}
        {section === 'backgrounds' && (
          <div className={styles.content}>
            <div className={styles.breadcrumb}>Library › Backgrounds</div>
            <div className={styles.gridLarge}>
              {assetLibrary.backgrounds.map(bg => (
                <div key={bg.asset_id} className={styles.bgCard}>
                  <div className={styles.bgThumb}>
                    <span className={styles.bgIcon}>🏞️</span>
                  </div>
                  <div className={styles.bgInfo}>
                    <div className={styles.assetName}>{bg.name}</div>
                    <div className={styles.assetId}>{bg.asset_id}.png</div>
                    <div className={styles.tagRow}>
                      {bg.tags.map(t => <span key={t} className={styles.tag}>{t}</span>)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Objects ── */}
        {section === 'objects' && (
          <div className={styles.content}>
            <div className={styles.breadcrumb}>Library › Objects</div>
            <div className={styles.gridMed}>
              {assetLibrary.objects.map(obj => (
                <div key={obj.asset_id} className={styles.assetCard}>
                  <div className={styles.assetThumb} style={{ background: '#f1f5f9' }}>
                    <span style={{ fontSize: 28 }}>📦</span>
                  </div>
                  <div className={styles.assetInfo}>
                    <div className={styles.assetName}>{obj.name}</div>
                    <div className={styles.assetId}>{obj.asset_id}.png</div>
                    <div className={styles.tagRow}>
                      {obj.tags.slice(0, 2).map(t => <span key={t} className={styles.tag}>{t}</span>)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Generated Assets ── */}
        {section === 'generated' && (
          <div className={styles.content}>
            <div className={styles.breadcrumb}>Library › Generated Assets</div>
            <GeneratedAssetsSection />
          </div>
        )}
      </div>
    </div>
  )
}
