import { useStore } from '../App'
import type {
  CharacterElement, SpeechBubbleElement, ObjectElement, CharacterName, BubbleType
} from '../types'
import { assetLibrary, getCharacterPoses, getBackgroundAsset } from '../data/assetLibrary'
import styles from './PropertiesPanel.module.css'

const CHAR_LABELS: Record<CharacterName, string> = { bouncy: 'Bouncy', merry: 'Merry', pokpok: 'Pokpok' }
const BUBBLE_TYPES: BubbleType[] = ['normal', 'shout', 'thought', 'question', 'caption']
const TAIL_DIRS = ['bottom-left', 'bottom-right', 'top-left', 'top-right', 'none'] as const

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.fieldRow}>
      <span className={styles.fieldLabel}>{label}</span>
      <div className={styles.fieldControl}>{children}</div>
    </div>
  )
}

function NumInput({ value, onChange, min, max }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <input
      type="number" className={styles.numInput}
      value={Math.round(value)} min={min} max={max}
      onChange={e => onChange(Number(e.target.value))}
    />
  )
}

export default function PropertiesPanel() {
  const store = useStore()
  const el = store.getSelectedElement()
  const panel = store.getSelectedPanel()
  const sel = store.selection

  function update(updates: Record<string, unknown>) {
    if (!sel) return
    store.updateElement(sel.pageIdx, sel.panelId, sel.elementId, updates as never)
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>Properties</div>
      <div className={styles.content}>

        {/* No selection → show panel props if a panel is in context */}
        {!el && !panel && (
          <p className={styles.empty}>Select an element on the canvas to edit its properties.</p>
        )}

        {/* Panel-level controls (always shown when a page exists) */}
        {store.currentPage && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Page {store.currentPage.page_number}</div>
            <p className={styles.hint}>{store.currentPage.purpose}</p>
            {panel && (
              <>
                <div className={styles.sectionTitle} style={{ marginTop: 12 }}>Panel</div>
                <FieldRow label="Background">
                  <select
                    className={styles.select}
                    value={panel.background_id}
                    onChange={e => sel && store.updatePanelBackground(sel.pageIdx, panel.id, e.target.value)}
                  >
                    {assetLibrary.backgrounds.map(bg => (
                      <option key={bg.asset_id} value={bg.asset_id}>{bg.name}</option>
                    ))}
                  </select>
                </FieldRow>
              </>
            )}
          </div>
        )}

        {/* Character element */}
        {el?.type === 'character' && (() => {
          const cel = el as CharacterElement
          const poses = getCharacterPoses(cel.character)
          return (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Character</div>
              <div className={styles.charBadge} style={{ background: cel.character === 'bouncy' ? '#e94560' : cel.character === 'merry' ? '#f5a623' : '#4ade80' }}>
                {CHAR_LABELS[cel.character]} — {cel.pose}
              </div>

              <FieldRow label="Pose">
                <select className={styles.select} value={cel.asset_id}
                  onChange={e => {
                    const asset = assetLibrary.characters.find(a => a.asset_id === e.target.value)
                    if (asset) update({ asset_id: asset.asset_id, pose: asset.pose })
                  }}>
                  {poses.map(p => <option key={p.asset_id} value={p.asset_id}>{p.pose}</option>)}
                </select>
              </FieldRow>
              <FieldRow label="Flip">
                <button className={`${styles.toggleBtn} ${cel.flipX ? styles.active : ''}`}
                  onClick={() => update({ flipX: !cel.flipX })}>
                  ↔ {cel.flipX ? 'Flipped' : 'Normal'}
                </button>
              </FieldRow>
              <div className={styles.xyGrid}>
                <FieldRow label="X"><NumInput value={el.x} onChange={v => update({ x: v })} /></FieldRow>
                <FieldRow label="Y"><NumInput value={el.y} onChange={v => update({ y: v })} /></FieldRow>
                <FieldRow label="W"><NumInput value={el.width} onChange={v => update({ width: v })} min={20} /></FieldRow>
                <FieldRow label="H"><NumInput value={el.height} onChange={v => update({ height: v })} min={20} /></FieldRow>
                <FieldRow label="Z"><NumInput value={el.zIndex} onChange={v => update({ zIndex: v })} min={0} max={10} /></FieldRow>
                <FieldRow label="α"><NumInput value={(el.opacity ?? 1) * 100} onChange={v => update({ opacity: v / 100 })} min={0} max={100} /></FieldRow>
              </div>
              <button className={styles.btnDelete} onClick={() => sel && store.deleteElement(sel.pageIdx, sel.panelId, sel.elementId)}>🗑 Delete Element</button>
            </div>
          )
        })()}

        {/* Speech bubble element */}
        {el?.type === 'speechBubble' && (() => {
          const bel = el as SpeechBubbleElement
          return (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Speech Bubble</div>
              <FieldRow label="Speaker">
                <input className={styles.textInput} value={bel.speaker}
                  onChange={e => update({ speaker: e.target.value })} />
              </FieldRow>
              <FieldRow label="Text">
                <textarea className={styles.textarea} value={bel.text} rows={3}
                  onChange={e => update({ text: e.target.value })} />
              </FieldRow>
              <FieldRow label="Type">
                <select className={styles.select} value={bel.bubbleType}
                  onChange={e => update({ bubbleType: e.target.value as BubbleType })}>
                  {BUBBLE_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </FieldRow>
              <FieldRow label="Tail">
                <select className={styles.select} value={bel.tailDirection}
                  onChange={e => update({ tailDirection: e.target.value })}>
                  {TAIL_DIRS.map(t => <option key={t}>{t}</option>)}
                </select>
              </FieldRow>
              <FieldRow label="Font">
                <NumInput value={bel.fontSize ?? 13} onChange={v => update({ fontSize: v })} min={8} max={32} />
              </FieldRow>
              <div className={styles.xyGrid}>
                <FieldRow label="X"><NumInput value={el.x} onChange={v => update({ x: v })} /></FieldRow>
                <FieldRow label="Y"><NumInput value={el.y} onChange={v => update({ y: v })} /></FieldRow>
                <FieldRow label="W"><NumInput value={el.width} onChange={v => update({ width: v })} min={60} /></FieldRow>
                <FieldRow label="H"><NumInput value={el.height} onChange={v => update({ height: v })} min={30} /></FieldRow>
              </div>
              <button className={styles.btnDelete} onClick={() => sel && store.deleteElement(sel.pageIdx, sel.panelId, sel.elementId)}>🗑 Delete Element</button>
            </div>
          )
        })()}

        {/* Object element */}
        {el?.type === 'object' && (() => {
          const oel = el as ObjectElement
          return (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Object</div>
              <FieldRow label="Asset">
                <select className={styles.select} value={oel.asset_id}
                  onChange={e => {
                    const asset = assetLibrary.objects.find(a => a.asset_id === e.target.value)
                    if (asset) update({ asset_id: asset.asset_id, name: asset.name })
                  }}>
                  {assetLibrary.objects.map(o => <option key={o.asset_id} value={o.asset_id}>{o.name}</option>)}
                </select>
              </FieldRow>
              <div className={styles.xyGrid}>
                <FieldRow label="X"><NumInput value={el.x} onChange={v => update({ x: v })} /></FieldRow>
                <FieldRow label="Y"><NumInput value={el.y} onChange={v => update({ y: v })} /></FieldRow>
                <FieldRow label="W"><NumInput value={el.width} onChange={v => update({ width: v })} min={20} /></FieldRow>
                <FieldRow label="H"><NumInput value={el.height} onChange={v => update({ height: v })} min={20} /></FieldRow>
                <FieldRow label="Z"><NumInput value={el.zIndex} onChange={v => update({ zIndex: v })} min={0} max={10} /></FieldRow>
              </div>
              <button className={styles.btnDelete} onClick={() => sel && store.deleteElement(sel.pageIdx, sel.panelId, sel.elementId)}>🗑 Delete Element</button>
            </div>
          )
        })()}

      </div>
    </div>
  )
}
