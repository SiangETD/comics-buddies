import { useRef, useCallback, useEffect, useState } from 'react'
import { Stage, Layer, Rect, Text, Group, Transformer, Image as KImage } from 'react-konva'
import type Konva from 'konva'
import useImage from 'use-image'
import { useStore, useCharImages } from '../App'
import type { ComicElement, CharacterElement, ObjectElement, SpeechBubbleElement, Panel } from '../types'
import { getBackgroundAsset } from '../data/assetLibrary'
import styles from './ComicCanvas.module.css'

const CANVAS_W = 800
const CANVAS_H = 560

// ── Placeholder colours for missing assets ────────────────────────────────
const CHAR_COLORS: Record<string, string> = {
  bouncy: '#e94560',
  merry: '#f5a623',
  pokpok: '#4ade80',
}

const BG_COLORS: Record<string, string> = {
  classroom: '#dbeafe',
  school_canteen: '#fef9c3',
  hdb_void_deck: '#e5e7eb',
  park: '#dcfce7',
  reservoir: '#cffafe',
  home_kitchen: '#fce7f3',
  science_lab: '#ede9fe',
  mrt_station: '#e0f2fe',
  beach: '#fef3c7',
}

// ── Image element with fallback placeholder ───────────────────────────────
function AssetImage({ src, fallbackColor, fallbackLabel, x, y, width, height, onClick, draggable, onDragEnd, isSelected }: {
  src: string; fallbackColor: string; fallbackLabel: string
  x: number; y: number; width: number; height: number
  onClick?: () => void; draggable?: boolean
  onDragEnd?: (x: number, y: number) => void
  isSelected?: boolean
}) {
  const [image, status] = useImage(src)
  if (status === 'loaded' && image) {
    return (
      <KImage
        image={image} x={x} y={y} width={width} height={height}
        onClick={onClick} draggable={draggable}
        onDragEnd={e => onDragEnd?.(e.target.x(), e.target.y())}
        stroke={isSelected ? '#60a5fa' : undefined} strokeWidth={isSelected ? 2 : 0}
      />
    )
  }
  return (
    <Group x={x} y={y} onClick={onClick} draggable={draggable}
      onDragEnd={e => onDragEnd?.(e.target.x(), e.target.y())}
    >
      <Rect width={width} height={height} fill={fallbackColor} opacity={0.25} cornerRadius={6}
        stroke={isSelected ? '#60a5fa' : fallbackColor} strokeWidth={isSelected ? 2 : 1}
      />
      <Text text={fallbackLabel} width={width} height={height} align="center" verticalAlign="middle"
        fill={fallbackColor} fontSize={Math.min(12, width / 6)} fontStyle="bold" />
    </Group>
  )
}

// ── Speech bubble drawn with Konva shapes ─────────────────────────────────
function SpeechBubbleEl({ el, isSelected, onClick, onDragEnd }: {
  el: SpeechBubbleElement; isSelected: boolean
  onClick: () => void; onDragEnd: (x: number, y: number) => void
}) {
  const bgColor = el.bubbleType === 'shout' ? '#fff3cd' : el.bubbleType === 'thought' ? '#f0f4ff' : el.bubbleType === 'caption' ? '#1e3a5f' : '#ffffff'
  const borderColor = el.bubbleType === 'shout' ? '#f59e0b' : el.bubbleType === 'thought' ? '#6366f1' : el.bubbleType === 'caption' ? '#60a5fa' : '#374151'
  const textColor = el.bubbleType === 'caption' ? '#ffffff' : '#111827'

  return (
    <Group x={el.x} y={el.y} draggable onClick={onClick}
      onDragEnd={e => onDragEnd(e.target.x(), e.target.y())}
    >
      <Rect
        width={el.width} height={el.height}
        fill={bgColor} stroke={isSelected ? '#60a5fa' : borderColor}
        strokeWidth={isSelected ? 2 : 1.5} cornerRadius={10} shadowBlur={isSelected ? 6 : 0}
        shadowColor="#60a5fa"
      />
      <Text
        text={el.text} width={el.width} height={el.height}
        padding={10} align="center" verticalAlign="middle"
        fill={textColor} fontSize={el.fontSize ?? 13} lineHeight={1.35}
        fontStyle={el.bubbleType === 'shout' ? 'bold' : 'normal'}
        wrap="word"
      />
      {el.bubbleType !== 'caption' && el.bubbleType !== 'thought' && (
        <Text text="▼" x={16} y={el.height - 6} fill={bgColor} fontSize={12} />
      )}
    </Group>
  )
}

// ── A single panel rendered on the stage ─────────────────────────────────
function PanelEl({ panel, pageIdx, scaleX, scaleY }: {
  panel: Panel; pageIdx: number; scaleX: number; scaleY: number
}) {
  const store = useStore()
  const { getImage } = useCharImages()
  const bg = getBackgroundAsset(panel.background_id)
  const bgColor = BG_COLORS[panel.background_id] ?? '#e5e7eb'
  const { x, y, width, height } = panel.layout

  const sorted = [...panel.elements].sort((a, b) => a.zIndex - b.zIndex)

  return (
    <Group x={x} y={y} clipX={0} clipY={0} clipWidth={width} clipHeight={height}>
      {/* Background */}
      {bg ? (
        <AssetImage
          src={bg.file} fallbackColor={bgColor} fallbackLabel={bg.name}
          x={0} y={0} width={width} height={height}
        />
      ) : (
        <Rect width={width} height={height} fill={bgColor} />
      )}

      {/* Panel border */}
      <Rect width={width} height={height} stroke="#1a1a2e" strokeWidth={3} fill="transparent" />

      {/* Elements */}
      {sorted.map(el => {
        const isSelected = store.selection?.panelId === panel.id && store.selection?.elementId === el.id

        const handleClick = () => {
          store.setSelection({ pageIdx, panelId: panel.id, elementId: el.id })
        }
        const handleDragEnd = (nx: number, ny: number) => {
          store.updateElement(pageIdx, panel.id, el.id, { x: nx - x, y: ny - y })
        }

        if (el.type === 'character') {
          const cel = el as CharacterElement
          const color = CHAR_COLORS[cel.character] ?? '#94a3b8'
          const uploadedSrc = getImage(cel.asset_id)
          const charSrc = uploadedSrc ?? (cel.asset_id ? `/assets/characters/${cel.character}/${cel.pose}.png` : '')
          return (
            <Group key={el.id} scaleX={cel.flipX ? -1 : 1} x={cel.flipX ? el.x + el.width + x : el.x + x} y={el.y + y}>
              <AssetImage
                src={charSrc}
                fallbackColor={color}
                fallbackLabel={`${cel.character}\n${cel.pose}`}
                x={0} y={0} width={el.width} height={el.height}
                isSelected={isSelected}
                onClick={handleClick}
                draggable
                onDragEnd={(nx, ny) => store.updateElement(pageIdx, panel.id, el.id, {
                  x: cel.flipX ? (x + el.width - (nx - 0)) : nx - x,
                  y: ny - y
                })}
              />
            </Group>
          )
        }

        if (el.type === 'object') {
          const oel = el as ObjectElement
          return (
            <AssetImage key={el.id}
              src={`/assets/objects/${oel.asset_id}.png`}
              fallbackColor="#94a3b8" fallbackLabel={oel.name}
              x={el.x + x} y={el.y + y} width={el.width} height={el.height}
              isSelected={isSelected} onClick={handleClick} draggable
              onDragEnd={(nx, ny) => store.updateElement(pageIdx, panel.id, el.id, { x: nx - x, y: ny - y })}
            />
          )
        }

        if (el.type === 'speechBubble') {
          return (
            <SpeechBubbleEl key={el.id}
              el={{ ...(el as SpeechBubbleElement), x: el.x + x, y: el.y + y }}
              isSelected={isSelected}
              onClick={handleClick}
              onDragEnd={(nx, ny) => store.updateElement(pageIdx, panel.id, el.id, { x: nx - x, y: ny - y })}
            />
          )
        }
        return null
      })}
    </Group>
  )
}

// ── Main canvas ────────────────────────────────────────────────────────────
export default function ComicCanvas() {
  const store = useStore()
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage>(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    function resize() {
      if (!containerRef.current) return
      const { width, height } = containerRef.current.getBoundingClientRect()
      const s = Math.min((width - 40) / CANVAS_W, (height - 40) / CANVAS_H)
      setScale(Math.max(0.3, s))
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  function handleStageClick(e: Konva.KonvaEventObject<MouseEvent>) {
    if (e.target === e.target.getStage()) {
      store.setSelection(null)
    }
  }

  function exportPNG() {
    if (!stageRef.current) return
    const dataURL = stageRef.current.toDataURL({ pixelRatio: 2 })
    const a = document.createElement('a')
    a.download = `page_${(store.currentPageIdx ?? 0) + 1}.png`
    a.href = dataURL
    a.click()
  }

  const page = store.currentPage

  return (
    <div className={styles.canvasArea}>
      <div className={styles.toolbar}>
        {page && (
          <span className={styles.pageLabel}>
            Page {page.page_number} — {page.purpose}
          </span>
        )}
        <div className={styles.toolbarRight}>
          <button className={styles.toolBtn} onClick={() => store.setSelection(null)}>Deselect</button>
          {page && <button className={styles.toolBtn} onClick={exportPNG}>📷 Export PNG</button>}
        </div>
      </div>

      <div className={styles.canvasContainer} ref={containerRef}>
        {!page ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>📖</div>
            <p>Generate or load a comic to begin editing.</p>
          </div>
        ) : (
          <div
            className={styles.stageWrapper}
            style={{ width: CANVAS_W * scale, height: CANVAS_H * scale }}
          >
            <Stage
              ref={stageRef}
              width={CANVAS_W * scale}
              height={CANVAS_H * scale}
              scaleX={scale}
              scaleY={scale}
              onClick={handleStageClick}
            >
              <Layer>
                {/* Page background */}
                <Rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill="#ffffff" />
                {page.panels.map(panel => (
                  <PanelEl
                    key={panel.id}
                    panel={panel}
                    pageIdx={store.currentPageIdx}
                    scaleX={scale}
                    scaleY={scale}
                  />
                ))}
              </Layer>
            </Stage>
          </div>
        )}
      </div>
    </div>
  )
}
