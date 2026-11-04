import { useState, useEffect, useRef, useCallback } from 'react'
import { useStore, useApp, useCharImages } from '../../App'
import { assetLibrary } from '../../data/assetLibrary'
import type {
  ComicPanelScript, ComicImages, PanelLayout,
  CharacterSlot, ImageSlot, TextSlot, CreatedComic, CharacterName,
} from '../../types'
import styles from './EditComicsView.module.css'
import { chromaKeyAndSave } from '../../utils/chromaKey'

// ── Pose order per panel ──────────────────────────────────────────────────────
const PANEL_POSES = ['wow','excited','thinking','pointing','happy','wow','happy']

// ── Maps (panelIdx, elementId) → script key for inline text editing ───────────
// ── Sticker template (mirrors server buildObjectStickerPrompt) ────────────────
const STICKER_TEMPLATE_SUFFIX = `

Add a thick clean white outline around the entire object, like a sticker border, on a flat vivid magenta (#FF00FF) background.

Important requirements:
- Flat solid magenta (#FF00FF) background — no gradients
- No text
- No labels
- No characters
- No extra objects
- No scene or environment
- Object only
- Centered composition
- Full object visible, not cut off
- Clean white sticker outline
- Educational comic style
- High-resolution, sharp edges
- Suitable for placing inside a comic panel`

function buildObjectStickerPrompt(objectDescription: string): string {
  return `Create the ${objectDescription} in a single isolated object cutout in a clean educational comic style.${STICKER_TEMPLATE_SUFFIX}`
}

// ── Maps (elementId) → { promptKey, imageKey } for regeneration ──────────────
function getRegenInfo(elementId: string, panelIdx: number): {
  imageKey: keyof ComicImages
  promptKey: keyof ComicPanelScript
  label: string
} | null {
  if (elementId === 'bgImage')    return { imageKey:'panel1',        promptKey:'panel1_photo_prompt', label:'Background photo' }
  if (elementId === 'objectImage') return { imageKey:'panel2_object', promptKey:'panel2_object_prompt', label:'Panel 2 object' }
  if (elementId === 'sceneImage') {
    if (panelIdx === 3) return { imageKey:'panel4_scene', promptKey:'panel4_scene_prompt', label:'Panel 4 scene' }
    if (panelIdx === 4) return { imageKey:'panel5_scene', promptKey:'panel5_scene_prompt', label:'Panel 5 scene' }
    if (panelIdx === 5) return { imageKey:'panel6_scene', promptKey:'panel6_scene_prompt', label:'Panel 6 scene' }
  }
  return null
}

// ── Regenerate modal ──────────────────────────────────────────────────────────
interface RegenState {
  imageKey: keyof ComicImages
  promptKey: keyof ComicPanelScript
  label: string
  prompt: string        // full prompt for normal images; object description for objectMode
  objectMode: boolean   // true for panel 2 object — user types description only
  loading: boolean
  error: string | null
}
function RegenerateModal({ state, onChange, onConfirm, onCancel }: {
  state: RegenState
  onChange: (text: string) => void
  onConfirm: () => void
  onCancel: () => void
}) {
  const [showTemplate, setShowTemplate] = useState(false)
  return (
    <div className={styles.regenOverlay} onMouseDown={e=>{if(e.target===e.currentTarget&&!state.loading)onCancel()}}>
      <div className={styles.regenModal}>
        <div className={styles.regenTitle}>Regenerate Image</div>
        <div className={styles.regenSubtitle}>{state.label}</div>

        {state.objectMode ? (<>
          <label className={styles.regenObjLabel}>Describe the object:</label>
          <textarea
            className={styles.regenTextarea}
            value={state.prompt}
            onChange={e=>onChange(e.target.value)}
            disabled={state.loading}
            rows={3}
            placeholder="e.g. white Merlion statue, half lion and half fish"
          />
          <button className={styles.regenTemplateToggle} onClick={()=>setShowTemplate(s=>!s)}>
            {showTemplate ? '▾' : '▸'} Template added automatically
          </button>
          {showTemplate&&(
            <pre className={styles.regenTemplatePreview}>
              {`Create the [your description] in a single isolated object cutout in a clean educational comic style.${STICKER_TEMPLATE_SUFFIX}`}
            </pre>
          )}
        </>) : (
          <textarea
            className={styles.regenTextarea}
            value={state.prompt}
            onChange={e=>onChange(e.target.value)}
            disabled={state.loading}
            rows={14}
          />
        )}

        {state.error&&<div className={styles.regenError}>{state.error}</div>}
        <div className={styles.regenActions}>
          <button className={styles.regenBtnCancel} onClick={onCancel} disabled={state.loading}>Cancel</button>
          <button className={styles.regenBtnConfirm} onClick={onConfirm} disabled={state.loading||!state.prompt.trim()}>
            {state.loading?<><span className={styles.btnSpinner}/> Generating…</>:'🔄 Regenerate Image'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Maps (panelIdx, elementId) → script key for inline text editing ───────────
const SCRIPT_KEY_MAP: Record<number, Partial<Record<string,keyof ComicPanelScript>>> = {
  0: { bubbleText:'panel1_question' },
  1: { p2Reveal:'panel2_reveal', p2Title:'panel2_title' },
  2: { bubbleText:'panel3_trigger' },
  3: { bubbleText:'panel4_speech', textboxText:'panel4_fact' },
  4: { bubbleText:'panel5_speech', textboxText:'panel5_fact' },
  5: { bubbleText:'panel6_speech', textboxText:'panel6_fact' },
  6: { bubbleText:'panel7_closing' },
}

// ── Default slot factories ────────────────────────────────────────────────────
function di(x:number,y:number,scale:number,blur=0,rotation=0): ImageSlot {
  return {x,y,scale,blur,rotation,flipX:false}
}
function dt(x:number,y:number,width:number,fontSize:number): TextSlot {
  return {x,y,width,fontSize,rotation:0}
}

const IMAGE_LABELS: Partial<Record<string,string>> = {
  panel1:'Background', panel2_object:'Object',
  panel4_scene:'Scene 1', panel5_scene:'Scene 2', panel6_scene:'Scene 3',
}

const PANEL_LABELS = [
  'Curiosity Hook','Reveal','Trigger Question','Fact 1','Fact 2','Singapore Context','Closing',
]

// ── Per-panel moveable element IDs (back→front default order) ─────────────────
const MOVEABLE_IDS: Record<number,string[]> = {
  0:['bubble','bubbleText','character'],
  1:['p2Reveal','p2Title','character'],
  2:['bubble','bubbleText','character'],
  3:['textbox','textboxText','bubble','bubbleText','character'],
  4:['textbox','textboxText','bubble','bubbleText','character'],
  5:['textbox','textboxText','bubble','bubbleText','character'],
  6:['bubble','bubbleText','character'],
}

// Z-index for a moveable element based on its position in zOrder
// Fixed bg/scene/object: z=1; frame (fact panels): z=3; moveables start above
function getZ(id:string, layout:PanelLayout, panelIdx:number): number {
  const order = layout.zOrder ?? MOVEABLE_IDS[panelIdx] ?? []
  const pos = order.indexOf(id)
  if (pos < 0) return 1
  const base = (panelIdx >= 3 && panelIdx <= 5) ? 4 : 2
  return base + pos
}

// ── Element definitions per panel ─────────────────────────────────────────────
type ElemType = 'photo'|'overlay'|'text'|'character'
interface ElemDef { id:string; label:string; icon:string; type:ElemType }

const PANEL_ELEMENT_DEFS: Record<number,ElemDef[]> = {
  0:[
    {id:'bgImage',    label:'Background Photo',icon:'🌄',type:'photo'},
    {id:'bubble',     label:'Speech Bubble',   icon:'💬',type:'overlay'},
    {id:'bubbleText', label:'Bubble Text',      icon:'✏️',type:'text'},
    {id:'character',  label:'Character',        icon:'🧑',type:'character'},
  ],
  1:[
    {id:'objectImage',label:'Object Photo',  icon:'✨',type:'photo'},
    {id:'p2Reveal',   label:'Reveal Text',   icon:'✏️',type:'text'},
    {id:'p2Title',    label:'Title Text',    icon:'🔤',type:'text'},
    {id:'character',  label:'Character',     icon:'🧑',type:'character'},
  ],
  2:[
    {id:'bgImage',    label:'Background Photo',icon:'🌄',type:'photo'},
    {id:'bubble',     label:'Question Slate',  icon:'📋',type:'overlay'},
    {id:'bubbleText', label:'Slate Text',       icon:'✏️',type:'text'},
    {id:'character',  label:'Character',        icon:'🧑',type:'character'},
  ],
  3:[
    {id:'sceneImage', label:'Scene Photo',  icon:'🔵',type:'photo'},
    {id:'character',  label:'Character',    icon:'🧑',type:'character'},
    {id:'bubble',     label:'Speech Bubble',icon:'💬',type:'overlay'},
    {id:'bubbleText', label:'Bubble Text',  icon:'✏️',type:'text'},
    {id:'textbox',    label:'Fact Box',     icon:'📦',type:'overlay'},
    {id:'textboxText',label:'Fact Text',    icon:'📝',type:'text'},
  ],
}
PANEL_ELEMENT_DEFS[4] = PANEL_ELEMENT_DEFS[3]
PANEL_ELEMENT_DEFS[5] = PANEL_ELEMENT_DEFS[3]
PANEL_ELEMENT_DEFS[6] = PANEL_ELEMENT_DEFS[0]

// ── Default layouts ───────────────────────────────────────────────────────────
function buildDefaultLayouts(characters: CharacterName[]): Record<string,PanelLayout> {
  const ch  = characters[0] ?? 'bouncy'
  const ch2 = characters[1] ?? ch

  function charSlot(idx:number,x:number,y:number,scale:number): CharacterSlot {
    const char = idx%2===0 ? ch : ch2
    const pose = PANEL_POSES[idx] ?? 'happy'
    const found = assetLibrary.characters.find(a=>a.character===char&&a.pose===pose)
               ?? assetLibrary.characters.find(a=>a.character===char)
    return {x,y,scale,blur:0,rotation:0,flipX:false,assetId:found?.asset_id??`${char}_${pose}`}
  }

  return {
    '0':{bgImage:di(47,50,121),    bubble:di(35,22,65),                        bubbleText:dt(34,20,47,18), character:charSlot(0,22,76,90), sceneCircle:false},
    '1':{objectImage:di(49,47,75), p2Reveal:dt(50,9,88,24), p2Title:dt(52,73,88,48), character:charSlot(1,12,89,56), sceneCircle:false},
    '2':{bgImage:di(49,56,120),    bubble:di(49,27,86),                        bubbleText:dt(49,25,55,27), character:charSlot(2,49,79,90), sceneCircle:false},
    '3':{sceneImage:di(50,47,97),  character:charSlot(3,-8,54,36), bubble:di(68,17,64), bubbleText:dt(70,14,38,17), textbox:di(50,88,92), textboxText:dt(49,87,69,19), sceneCircle:false},
    '4':{sceneImage:di(43,67,113), character:charSlot(4,13,54,36), bubble:di(53,15,60), bubbleText:dt(54,13,38,16), textbox:di(51,87,92), textboxText:dt(49,87,70,16), sceneCircle:false},
    '5':{sceneImage:di(50,46,83),  character:charSlot(5,-8,54,36), bubble:{...di(30,18,58),flipX:true}, bubbleText:dt(30,15,38,14), textbox:di(50,84,92), textboxText:dt(49,83,72,20), sceneCircle:false},
    '6':{bgImage:di(44,50,160),    bubble:di(35,32,71),                        bubbleText:dt(36,29,47,15), character:charSlot(6,43,72,75), sceneCircle:false},
  }
}

function hasScale(v:unknown): boolean {
  return typeof v==='object'&&v!==null&&'scale' in v
}

function getPhotoSrc(id:string, images:ComicImages, panelIdx:number): string|null {
  if (id==='bgImage') return images.panel1
  if (id==='objectImage') return images.panel2_object
  if (id==='sceneImage') return [images.panel4_scene,images.panel5_scene,images.panel6_scene][panelIdx-3]??null
  return null
}
function getPhotoKey(id:string, panelIdx:number): keyof ComicImages|null {
  if (id==='bgImage') return 'panel1'
  if (id==='objectImage') return 'panel2_object'
  const k:Array<keyof ComicImages>=['panel4_scene','panel5_scene','panel6_scene']
  if (id==='sceneImage') return k[panelIdx-3]??null
  return null
}
// ── DragCatcher — active only for background-type elements ───────────────────
// When active, it sits at z=50 but passes clicks through to whatever element
// is visually underneath — so other objects remain selectable while bg is selected.
const BG_IDS = new Set(['bgImage','sceneImage','objectImage'])

function DragCatcher({selectedEl,onDragStart}:{
  selectedEl:string|null
  onDragStart:(id:string,e:React.MouseEvent)=>void
}) {
  if (!selectedEl || !BG_IDS.has(selectedEl)) return null
  return (
    <div
      style={{position:'absolute',inset:0,zIndex:50,cursor:'grab'}}
      onMouseDown={e=>{
        const el = e.currentTarget as HTMLDivElement
        el.style.pointerEvents = 'none'
        const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement|null
        el.style.pointerEvents = ''
        const dragId = target?.dataset?.dragId
        onDragStart(dragId ?? selectedEl, e)
      }}
    />
  )
}

// ── DraggableImage ────────────────────────────────────────────────────────────
interface DImgProps {
  id:string; src:string; slot:ImageSlot
  cover?:boolean; circle?:boolean; dropShadow?:boolean; zIndex?:number; selected:boolean
  onDragStart:(id:string,e:React.MouseEvent)=>void
}
function DraggableImage({id,src,slot,cover,circle,dropShadow,zIndex,selected,onDragStart}:DImgProps) {
  const rot  = slot.rotation??0
  const flip = slot.flipX ? ' scaleX(-1)' : ''
  const shadowFilter = dropShadow ? 'drop-shadow(3px 4px 6px rgba(0,0,0,0.45))' : undefined
  let style: React.CSSProperties

  if (cover) {
    style={
      position:'absolute',inset:0,width:'100%',height:'100%',
      objectFit:'cover',
      objectPosition:`${100-slot.x}% ${100-slot.y}%`,
      transform:`scale(${slot.scale/100})${rot?` rotate(${rot}deg)`:''}${flip}`,
      transformOrigin:'center',
      filter:slot.blur>0?`blur(${slot.blur}px)`:undefined,
      cursor:'grab',userSelect:'none',zIndex:zIndex??1,
      boxShadow:selected?'inset 0 0 0 3px #ff6600':undefined,
    }
  } else if (circle) {
    const filters = [
      slot.blur>0 ? `blur(${slot.blur}px)` : '',
      shadowFilter ?? '',
    ].filter(Boolean).join(' ')
    style={
      position:'absolute',
      left:`${slot.x-slot.scale/2}%`,top:`${slot.y-slot.scale/2}%`,
      width:`${slot.scale}%`,height:`${slot.scale}%`,
      objectFit:'cover',borderRadius:'50%',
      filter:filters||undefined,
      transform:rot||flip?`rotate(${rot}deg)${flip}`:undefined,
      cursor:'grab',userSelect:'none',zIndex:zIndex??1,
      outline:selected?'2px dashed #ff6600':undefined,outlineOffset:'4px',
    }
  } else {
    const filters = [
      slot.blur>0 ? `blur(${slot.blur}px)` : '',
      shadowFilter ?? '',
    ].filter(Boolean).join(' ')
    style={
      position:'absolute',
      left:`${slot.x - slot.scale/2}%`,top:`${slot.y}%`,
      transform:`translateY(-50%)${rot?` rotate(${rot}deg)`:''}${flip}`,
      width:`${slot.scale}%`,height:'auto',
      filter:filters||undefined,
      cursor:'grab',userSelect:'none',zIndex:zIndex??1,
      outline:selected?'2px dashed #ff6600':undefined,outlineOffset:'4px',
    }
  }
  return <img src={src} alt="" draggable={false} data-drag-id={id} onMouseDown={e=>onDragStart(id,e)} style={style}/>
}

// ── DraggableText ─────────────────────────────────────────────────────────────
interface DTextProps {
  id:string; text:string; slot:TextSlot; zIndex?:number; selected:boolean
  color?:string; weight?:string|number; shadow?:string
  editing?:boolean
  onDragStart:(id:string,e:React.MouseEvent)=>void
  onEdit?:()=>void
  onSave?:(text:string)=>void
}
function DraggableText({id,text,slot,zIndex,selected,color,weight,shadow,editing,onDragStart,onEdit,onSave}:DTextProps) {
  const rot = slot.rotation??0
  const [draft, setDraft] = useState(text)
  useEffect(()=>{ if (!editing) setDraft(text) },[text,editing])

  const baseStyle: React.CSSProperties = {
    position:'absolute',
    left:`${slot.x}%`,top:`${slot.y}%`,
    transform:`translate(-50%,-50%)${rot?` rotate(${rot}deg)`:''}`,
    width:`${slot.width}%`,textAlign:'center',
    fontSize:`${slot.fontSize}px`,
    fontFamily:"'Comic Sans MS','Chalkboard SE',cursive",
    fontWeight:weight??700,
    color:color??'#1a1a1a',
    lineHeight:1.3,
  }

  if (editing) {
    return (
      <textarea
        autoFocus
        value={draft}
        onChange={e=>setDraft(e.target.value)}
        onBlur={()=>onSave?.(draft)}
        onKeyDown={e=>{
          if (e.key==='Escape'){e.preventDefault();onSave?.(text)}
        }}
        style={{
          ...baseStyle,
          textShadow:shadow,
          background:'rgba(255,255,255,0.92)',
          border:'2px solid #ff6600',
          borderRadius:4,
          resize:'none',outline:'none',
          padding:'4px 6px',
          cursor:'text',
          zIndex:100,
          minHeight:'2em',
          overflow:'hidden',
        }}
      />
    )
  }

  return (
    <div
      data-drag-id={id}
      onMouseDown={e=>onDragStart(id,e)}
      onDoubleClick={e=>{e.stopPropagation();onEdit?.()}}
      style={{
        ...baseStyle,
        textShadow:shadow,
        cursor:'grab',userSelect:'none',zIndex:zIndex??4,
        outline:selected?'2px dashed #ff6600':undefined,outlineOffset:'4px',
        pointerEvents:'all',
      }}
    >{text}</div>
  )
}

// ── Panel renderers ───────────────────────────────────────────────────────────
interface PanelProps {
  script:ComicPanelScript; images:ComicImages
  layout:PanelLayout; charSrc:string|null; selectedEl:string|null
  panelIdx:number
  editingId:string|null
  onDragStart:(id:string,e:React.MouseEvent)=>void
  onEdit:(id:string)=>void
  onSave:(id:string,text:string)=>void
}

function Panel0({script,images,layout,charSrc,selectedEl,editingId,panelIdx,onDragStart,onEdit,onSave}:PanelProps) {
  const d=buildDefaultLayouts(['bouncy'])['0']
  const bg=layout.bgImage??d.bgImage!; const bub=layout.bubble??d.bubble!
  const bt=layout.bubbleText??d.bubbleText!; const chr=layout.character??d.character!
  const useCircle=layout.sceneCircle!==false
  return (
    <div className={styles.panel}>
      <DraggableImage id="bgImage" src={images.panel1} slot={bg} circle={useCircle} zIndex={1}
        selected={selectedEl==='bgImage'} onDragStart={onDragStart}/>
      <DraggableImage id="bubble" src="/assets/panel_01_speech_title.png" slot={bub}
        zIndex={getZ('bubble',layout,panelIdx)} selected={selectedEl==='bubble'} onDragStart={onDragStart}/>
      <DraggableText id="bubbleText" text={script.panel1_question} slot={bt}
        zIndex={getZ('bubbleText',layout,panelIdx)} selected={selectedEl==='bubbleText'}
        editing={editingId==='bubbleText'} onDragStart={onDragStart}
        onEdit={()=>onEdit('bubbleText')} onSave={t=>onSave('bubbleText',t)}/>
      {charSrc&&<DraggableImage id="character" src={charSrc} slot={chr}
        zIndex={getZ('character',layout,panelIdx)} selected={selectedEl==='character'} onDragStart={onDragStart}/>}
      <DragCatcher selectedEl={selectedEl} onDragStart={onDragStart}/>
    </div>
  )
}

function Panel1Reveal({script,images,layout,charSrc,selectedEl,editingId,panelIdx,onDragStart,onEdit,onSave}:PanelProps) {
  const d=buildDefaultLayouts(['bouncy'])['1']
  const obj=layout.objectImage??d.objectImage!; const rev=layout.p2Reveal??d.p2Reveal!
  const tit=layout.p2Title??d.p2Title!; const chr=layout.character??d.character!
  const useCircle=layout.sceneCircle!==false
  return (
    <div className={styles.panel}>
      <img src="/assets/panel_02_bg.png" className={styles.panelBg} alt=""/>
      <img src="/assets/panel_02_object_blink.png" className={styles.p2Sparkles} alt=""/>
      <DraggableImage id="objectImage" src={images.panel2_object} slot={obj}
        circle={useCircle} dropShadow zIndex={1} selected={selectedEl==='objectImage'} onDragStart={onDragStart}/>
      <DraggableText id="p2Reveal" text={script.panel2_reveal} slot={rev}
        zIndex={getZ('p2Reveal',layout,panelIdx)} selected={selectedEl==='p2Reveal'} color="#333"
        editing={editingId==='p2Reveal'} onDragStart={onDragStart}
        onEdit={()=>onEdit('p2Reveal')} onSave={t=>onSave('p2Reveal',t)}/>
      <DraggableText id="p2Title" text={script.panel2_title} slot={tit}
        zIndex={getZ('p2Title',layout,panelIdx)} color="#ff6600" weight={800}
        shadow="2px 2px 0 #fff,-2px -2px 0 #fff,2px -2px 0 #fff,-2px 2px 0 #fff"
        selected={selectedEl==='p2Title'} editing={editingId==='p2Title'} onDragStart={onDragStart}
        onEdit={()=>onEdit('p2Title')} onSave={t=>onSave('p2Title',t)}/>
      {charSrc&&<DraggableImage id="character" src={charSrc} slot={chr}
        zIndex={getZ('character',layout,panelIdx)} selected={selectedEl==='character'} onDragStart={onDragStart}/>}
      <DragCatcher selectedEl={selectedEl} onDragStart={onDragStart}/>
    </div>
  )
}

function Panel2({script,images,layout,charSrc,selectedEl,editingId,panelIdx,onDragStart,onEdit,onSave}:PanelProps) {
  const d=buildDefaultLayouts(['bouncy'])['2']
  const bg=layout.bgImage??d.bgImage!; const bub=layout.bubble??d.bubble!
  const bt=layout.bubbleText??d.bubbleText!; const chr=layout.character??d.character!
  const useCircle=layout.sceneCircle!==false
  return (
    <div className={styles.panel}>
      <DraggableImage id="bgImage" src={images.panel1} slot={bg} circle={useCircle} zIndex={1}
        selected={selectedEl==='bgImage'} onDragStart={onDragStart}/>
      <DraggableImage id="bubble" src="/assets/panel_03_question_slate.png" slot={bub}
        zIndex={getZ('bubble',layout,panelIdx)} selected={selectedEl==='bubble'} onDragStart={onDragStart}/>
      <DraggableText id="bubbleText" text={script.panel3_trigger} slot={bt}
        zIndex={getZ('bubbleText',layout,panelIdx)} selected={selectedEl==='bubbleText'}
        editing={editingId==='bubbleText'} onDragStart={onDragStart}
        onEdit={()=>onEdit('bubbleText')} onSave={t=>onSave('bubbleText',t)}/>
      {charSrc&&<DraggableImage id="character" src={charSrc} slot={chr}
        zIndex={getZ('character',layout,panelIdx)} selected={selectedEl==='character'} onDragStart={onDragStart}/>}
      <DragCatcher selectedEl={selectedEl} onDragStart={onDragStart}/>
    </div>
  )
}

function PanelFact({panelIdx,fact,speech,sceneImageSrc,layout,charSrc,selectedEl,editingId,onDragStart,onEdit,onSave}:{
  panelIdx:number; fact:string; speech:string; sceneImageSrc:string
  layout:PanelLayout; charSrc:string|null; selectedEl:string|null; editingId:string|null
  onDragStart:(id:string,e:React.MouseEvent)=>void
  onEdit:(id:string)=>void; onSave:(id:string,text:string)=>void
}) {
  const d=buildDefaultLayouts(['bouncy'])[String(panelIdx)]!
  const sc=layout.sceneImage??d.sceneImage!; const bub=layout.bubble??d.bubble!
  const bt=layout.bubbleText??d.bubbleText!; const tbx=layout.textbox??d.textbox!
  const tbt=layout.textboxText??d.textboxText!; const chr=layout.character??d.character!
  const useCircle = layout.sceneCircle !== false
  return (
    <div className={styles.panel}>
      <DraggableImage id="sceneImage" src={sceneImageSrc} slot={sc}
        circle={useCircle} zIndex={1} selected={selectedEl==='sceneImage'} onDragStart={onDragStart}/>
      <img src="/assets/frame.png" className={styles.panelBg} style={{zIndex:3,pointerEvents:'none'}} alt=""/>
      {charSrc&&<DraggableImage id="character" src={charSrc} slot={chr}
        zIndex={getZ('character',layout,panelIdx)} selected={selectedEl==='character'} onDragStart={onDragStart}/>}
      <DraggableImage id="bubble" src="/assets/speech_bubble.png" slot={bub}
        zIndex={getZ('bubble',layout,panelIdx)} selected={selectedEl==='bubble'} onDragStart={onDragStart}/>
      <DraggableText id="bubbleText" text={speech} slot={bt}
        zIndex={getZ('bubbleText',layout,panelIdx)} selected={selectedEl==='bubbleText'}
        editing={editingId==='bubbleText'} onDragStart={onDragStart}
        onEdit={()=>onEdit('bubbleText')} onSave={t=>onSave('bubbleText',t)}/>
      <DraggableImage id="textbox" src="/assets/textbox_wide.png" slot={tbx}
        zIndex={getZ('textbox',layout,panelIdx)} selected={selectedEl==='textbox'} onDragStart={onDragStart}/>
      <DraggableText id="textboxText" text={fact} slot={tbt}
        zIndex={getZ('textboxText',layout,panelIdx)} selected={selectedEl==='textboxText'}
        editing={editingId==='textboxText'} onDragStart={onDragStart}
        onEdit={()=>onEdit('textboxText')} onSave={t=>onSave('textboxText',t)}/>
      <DragCatcher selectedEl={selectedEl} onDragStart={onDragStart}/>
    </div>
  )
}

function Panel6({script,images,layout,charSrc,selectedEl,editingId,panelIdx,onDragStart,onEdit,onSave}:PanelProps) {
  const d=buildDefaultLayouts(['bouncy'])['6']
  const bg=layout.bgImage??d.bgImage!; const bub=layout.bubble??d.bubble!
  const bt=layout.bubbleText??d.bubbleText!; const chr=layout.character??d.character!
  const useCircle=layout.sceneCircle!==false
  return (
    <div className={styles.panel}>
      <DraggableImage id="bgImage" src={images.panel1} slot={bg} circle={useCircle} zIndex={1}
        selected={selectedEl==='bgImage'} onDragStart={onDragStart}/>
      <DraggableImage id="bubble" src="/assets/speech_bubble.png" slot={bub}
        zIndex={getZ('bubble',layout,panelIdx)} selected={selectedEl==='bubble'} onDragStart={onDragStart}/>
      <DraggableText id="bubbleText" text={script.panel7_closing} slot={bt}
        zIndex={getZ('bubbleText',layout,panelIdx)} selected={selectedEl==='bubbleText'}
        editing={editingId==='bubbleText'} onDragStart={onDragStart}
        onEdit={()=>onEdit('bubbleText')} onSave={t=>onSave('bubbleText',t)}/>
      {charSrc&&<DraggableImage id="character" src={charSrc} slot={chr}
        zIndex={getZ('character',layout,panelIdx)} selected={selectedEl==='character'} onDragStart={onDragStart}/>}
      <DragCatcher selectedEl={selectedEl} onDragStart={onDragStart}/>
    </div>
  )
}

// ── Slider row with arrow buttons ─────────────────────────────────────────────
function SliderRow({label,value,min,max,step,unit,onChange}:{
  label:string; value:number; min:number; max:number; step:number; unit:string
  onChange:(v:number)=>void
}) {
  const dec = () => onChange(Math.max(min, +((value-step).toFixed(4))))
  const inc = () => onChange(Math.min(max, +((value+step).toFixed(4))))
  return (
    <div className={styles.sliderRow}>
      <span className={styles.sliderLabel}>{label}</span>
      <button className={styles.sliderArrow} onClick={dec}>◀</button>
      <input type="range" min={min} max={max} step={step} value={value}
        className={styles.slider} onChange={e=>onChange(Number(e.target.value))}/>
      <button className={styles.sliderArrow} onClick={inc}>▶</button>
      <span className={styles.sliderVal}>{Math.round(value*10)/10}{unit}</span>
    </div>
  )
}

// ── Accordion section ─────────────────────────────────────────────────────────
function AccordionSection({label,icon,open,onToggle,children}:{
  label:string; icon:string; open:boolean; onToggle:()=>void
  children:React.ReactNode
}) {
  return (
    <div className={`${styles.accordion} ${open?styles.accordionOpen:''}`}>
      <button className={styles.accordionHeader} onClick={onToggle}>
        <span className={styles.accIcon}>{icon}</span>
        <span className={styles.accLabel}>{label}</span>
        <span className={styles.accChevron}>{open?'▲':'▼'}</span>
      </button>
      {open&&<div className={styles.accordionBody}>{children}</div>}
    </div>
  )
}

// ── Z-order drag list ─────────────────────────────────────────────────────────
function ZOrderList({panelIdx,layout,elems,onUpdateLayout}:{
  panelIdx:number; layout:PanelLayout; elems:ElemDef[]
  onUpdateLayout:(c:Partial<PanelLayout>)=>void
}) {
  const moveableIds = MOVEABLE_IDS[panelIdx] ?? []
  const order = layout.zOrder ?? moveableIds
  const [dragIdx, setDragIdx] = useState<number|null>(null)
  const [overIdx, setOverIdx] = useState<number|null>(null)

  // Display front-to-back (top of list = front)
  const displayed = [...order].reverse()

  function getLabel(id:string) { return elems.find(e=>e.id===id)?.label ?? id }
  function getIcon(id:string)  { return elems.find(e=>e.id===id)?.icon  ?? '•' }

  function drop(targetIdx:number) {
    if (dragIdx===null) return
    const arr=[...displayed]
    const [item]=arr.splice(dragIdx,1)
    arr.splice(targetIdx,0,item)
    setDragIdx(null); setOverIdx(null)
    onUpdateLayout({zOrder:[...arr].reverse()})
  }

  return (
    <div className={styles.zOrderWrap}>
      <div className={styles.zOrderHint}>↑ Front (on top)</div>
      {displayed.map((id,i)=>(
        <div key={id} draggable
          onDragStart={()=>setDragIdx(i)}
          onDragOver={e=>{e.preventDefault();setOverIdx(i)}}
          onDrop={()=>drop(i)}
          onDragEnd={()=>{setDragIdx(null);setOverIdx(null)}}
          className={`${styles.zOrderItem} ${overIdx===i&&dragIdx!==i?styles.zOrderOver:''} ${dragIdx===i?styles.zOrderDragging:''}`}
        >
          <span className={styles.zHandle}>⠿</span>
          <span>{getIcon(id)}</span>
          <span className={styles.zLabel}>{getLabel(id)}</span>
        </div>
      ))}
      <div className={styles.zOrderHint}>↓ Back (behind)</div>
    </div>
  )
}

// ── Props panel (accordion) ───────────────────────────────────────────────────
function PropsPanel({panelIdx,layout,images,script,project,selectedEl,setSelectedEl,
  updateSlot,updateLayout,swapPhoto,charImages,onRegen,onMaskToggle,maskBusy,maskError}:{
  panelIdx:number; layout:PanelLayout; images:ComicImages; script:ComicPanelScript
  project:{characters:CharacterName[]}
  selectedEl:string|null; setSelectedEl:(id:string|null)=>void
  updateSlot:(id:string,c:Partial<ImageSlot|TextSlot|CharacterSlot>)=>void
  updateLayout:(c:Partial<PanelLayout>)=>void
  swapPhoto:(key:keyof ComicImages,url:string)=>void
  charImages:ReturnType<typeof useCharImages>
  onRegen:(elementId:string)=>void
  onMaskToggle:(elementId:string)=>void
  maskBusy:boolean
  maskError:string|null
}) {
  const defs     = PANEL_ELEMENT_DEFS[panelIdx] ?? []
  const defaults = buildDefaultLayouts(project.characters)[String(panelIdx)]

  function resetSlot(id:string) {
    const def = defaults?.[id as keyof PanelLayout]
    if (!def) return
    updateSlot(id, def as Partial<ImageSlot|TextSlot|CharacterSlot>)
    if (id==='bgImage'||id==='objectImage'||id==='sceneImage') {
      updateLayout({sceneCircle: (defaults?.sceneCircle)})
    }
  }

  function iSlot(id:string): ImageSlot {
    return (layout[id as keyof PanelLayout] as ImageSlot|undefined)
        ?? (defaults?.[id as keyof PanelLayout] as ImageSlot|undefined)
        ?? di(50,50,100)
  }
  function tSlot(id:string): TextSlot {
    return (layout[id as keyof PanelLayout] as TextSlot|undefined)
        ?? (defaults?.[id as keyof PanelLayout] as TextSlot|undefined)
        ?? dt(50,50,60,12)
  }
  function cSlot(): CharacterSlot {
    return layout.character ?? {...di(50,50,36),assetId:''}
  }

  return (
    <div className={styles.propsPanel}>
      <div className={styles.propsPanelTitle}>Panel {panelIdx+1} · {PANEL_LABELS[panelIdx]}</div>

      {defs.map(def=>{
        const open = selectedEl===def.id
        const toggle = ()=>setSelectedEl(open?null:def.id)

        return (
          <AccordionSection key={def.id} label={def.label} icon={def.icon} open={open} onToggle={toggle}>
            {def.type==='photo'&&(()=>{
              const slot=iSlot(def.id)
              const src=getPhotoSrc(def.id,images,panelIdx)
              const key=getPhotoKey(def.id,panelIdx)
              return (<>
                {src&&<img src={src} className={styles.imgThumb} alt=""/>}
                <SliderRow label="Scale" value={slot.scale} min={20}  max={300} step={1}   unit="%" onChange={v=>updateSlot(def.id,{scale:v})}/>
                <SliderRow label="Blur"  value={slot.blur}  min={0}   max={30}  step={0.5} unit="px" onChange={v=>updateSlot(def.id,{blur:v})}/>
                <SliderRow label="Angle" value={slot.rotation??0} min={-180} max={180} step={1} unit="°" onChange={v=>updateSlot(def.id,{rotation:v})}/>
                <div className={styles.toggleRow}>
                  <button className={`${styles.toggleBtn} ${slot.flipX?styles.toggleOn:''}`}
                    onClick={()=>updateSlot(def.id,{flipX:!slot.flipX})}>↔ Flip</button>
                  {(def.id==='sceneImage'||def.id==='bgImage'||def.id==='objectImage')&&(
                    <button className={`${styles.toggleBtn} ${layout.sceneCircle!==false?styles.toggleOn:''}`}
                      onClick={()=>updateLayout({sceneCircle:layout.sceneCircle===false})}>
                      ⬤ Circle mask
                    </button>
                  )}
                  {def.id==='objectImage'&&(
                    <button
                      className={`${styles.toggleBtn} ${images.panel2_object?.includes('_masked')?styles.toggleOn:''}`}
                      disabled={maskBusy}
                      onClick={()=>onMaskToggle(def.id)}>
                      {maskBusy ? '⏳' : '✂'} Mask
                    </button>
                  )}
                </div>
                {def.id==='objectImage'&&maskError&&(
                  <div className={styles.regenError} style={{marginTop:6}}>{maskError}</div>
                )}
                <button className={styles.btnReset} onClick={()=>resetSlot(def.id)}>↺ Reset position</button>
                {src&&key&&(<>
                  {/* Quick-pick from this comic's generated images */}
                  {Object.entries(images).filter(([,u])=>u&&!u.startsWith('data:')||u?.includes('/generated/')).length>0&&(
                    <div className={styles.comicImgPicker}>
                      <div className={styles.comicImgPickerLabel}>This comic's images</div>
                      <div className={styles.comicImgGrid}>
                        {(Object.entries(images) as [keyof ComicImages, string][])
                          .filter(([,u])=>!!u)
                          .map(([k,u])=>(
                            <img key={k} src={u} className={styles.comicImgThumb}
                              title={IMAGE_LABELS[k]??k}
                              onClick={()=>swapPhoto(key,u)}/>
                          ))
                        }
                      </div>
                    </div>
                  )}
                  <label className={styles.btnSwap}>↑ Upload from computer
                    <input type="file" accept="image/*" style={{display:'none'}}
                      onChange={e=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=ev=>swapPhoto(key,ev.target?.result as string);r.readAsDataURL(f)}}/>
                  </label>
                </>)}
                {getRegenInfo(def.id, panelIdx)&&(
                  <button className={styles.btnRegen} onClick={()=>onRegen(def.id)}>
                    🔄 Regenerate image
                  </button>
                )}
              </>)
            })()}

            {def.type==='overlay'&&(()=>{
              const slot=iSlot(def.id)
              return (<>
                <SliderRow label="Scale" value={slot.scale} min={10} max={200} step={1} unit="%" onChange={v=>updateSlot(def.id,{scale:v})}/>
                <SliderRow label="Angle" value={slot.rotation??0} min={-180} max={180} step={1} unit="°" onChange={v=>updateSlot(def.id,{rotation:v})}/>
                <div className={styles.toggleRow}>
                  <button className={`${styles.toggleBtn} ${slot.flipX?styles.toggleOn:''}`}
                    onClick={()=>updateSlot(def.id,{flipX:!slot.flipX})}>↔ Flip</button>
                </div>
                <button className={styles.btnReset} onClick={()=>resetSlot(def.id)}>↺ Reset position</button>
              </>)
            })()}

            {def.type==='text'&&(()=>{
              const slot=tSlot(def.id)
              return (<>
                <SliderRow label="Size"  value={slot.fontSize}    min={8}   max={120} step={1} unit="px" onChange={v=>updateSlot(def.id,{fontSize:v})}/>
                <SliderRow label="Width" value={slot.width}       min={10}  max={100} step={1} unit="%" onChange={v=>updateSlot(def.id,{width:v})}/>
                <SliderRow label="Angle" value={slot.rotation??0} min={-180} max={180} step={1} unit="°" onChange={v=>updateSlot(def.id,{rotation:v})}/>
              </>)
            })()}

            {def.type==='character'&&(()=>{
              const chr=cSlot()
              const poses=assetLibrary.characters.filter(a=>project.characters.includes(a.character as CharacterName))
              const src=chr.assetId?(charImages.getImage(chr.assetId)??assetLibrary.characters.find(a=>a.asset_id===chr.assetId)?.file):undefined
              return (
                <div className={styles.charPicker}>
                  {src
                    ?<img src={src} className={styles.charPickerPreview} alt="character"/>
                    :<div className={styles.charPickerEmpty}>No image uploaded<br/><span>Go to Library to upload poses</span></div>
                  }
                  <select className={styles.charPickerSelect} value={chr.assetId}
                    onChange={e=>updateSlot('character',{assetId:e.target.value})}>
                    <option value="">— none —</option>
                    {project.characters.map(char=>(
                      <optgroup key={char} label={char.charAt(0).toUpperCase()+char.slice(1)}>
                        {poses.filter(a=>a.character===char).map(a=>(
                          <option key={a.asset_id} value={a.asset_id}>{a.pose.replace('_',' ')}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <SliderRow label="Size"  value={chr.scale}       min={10}  max={150} step={1}   unit="%" onChange={v=>updateSlot('character',{scale:v})}/>
                  <SliderRow label="Blur"  value={chr.blur}        min={0}   max={20}  step={0.5} unit="px" onChange={v=>updateSlot('character',{blur:v})}/>
                  <SliderRow label="Angle" value={chr.rotation??0} min={-180} max={180} step={1}  unit="°"  onChange={v=>updateSlot('character',{rotation:v})}/>
                  <div className={styles.toggleRow}>
                    <button className={`${styles.toggleBtn} ${chr.flipX?styles.toggleOn:''}`}
                      onClick={()=>updateSlot('character',{flipX:!chr.flipX})}>↔ Flip</button>
                  </div>
                </div>
              )
            })()}
          </AccordionSection>
        )
      })}

      {/* Z-layer order */}
      <div className={styles.zOrderSection}>
        <div className={styles.zOrderTitle}>⟳ Layer Order</div>
        <ZOrderList panelIdx={panelIdx} layout={layout} elems={defs} onUpdateLayout={updateLayout}/>
      </div>
    </div>
  )
}

// ── Main editor ───────────────────────────────────────────────────────────────
function ComicEditor({topicId,script,created}:{topicId:string;script:ComicPanelScript;created:CreatedComic}) {
  const store      = useStore()
  const charImages = useCharImages()
  const {setIsGenerating} = useApp()
  const project    = store.project!
  const {images}   = created

  const [selected,   setSelected]   = useState(0)
  const [selectedEl, setSelectedEl] = useState<string|null>(null)
  const [editingId,  setEditingId]  = useState<string|null>(null)
  const [regenState, setRegenState] = useState<RegenState|null>(null)
  const [maskBusy,   setMaskBusy]   = useState(false)
  const [maskError,  setMaskError]  = useState<string|null>(null)
  const [exporting,  setExporting]  = useState(false)
  const [exportErr,  setExportErr]  = useState<string|null>(null)

  const [layouts, setLayouts] = useState<Record<string,PanelLayout>>(()=>{
    const defaults = buildDefaultLayouts(project.characters)
    if (!created.layouts) return defaults
    const merged: Record<string,PanelLayout> = {}
    for (const key of Object.keys(defaults)) {
      const def=defaults[key]; const saved=created.layouts[key]??{}
      merged[key]={
        ...def,
        ...(saved.bgImage     &&hasScale(saved.bgImage)     ?{bgImage:saved.bgImage}        :{}),
        ...(saved.objectImage &&hasScale(saved.objectImage) ?{objectImage:saved.objectImage}:{}),
        ...(saved.sceneImage  &&hasScale(saved.sceneImage)  ?{sceneImage:saved.sceneImage}  :{}),
        ...(saved.bubble      &&hasScale(saved.bubble)      ?{bubble:saved.bubble}          :{}),
        ...(saved.bubbleText                                ?{bubbleText:saved.bubbleText}  :{}),
        ...(saved.textbox     &&hasScale(saved.textbox)     ?{textbox:saved.textbox}        :{}),
        ...(saved.textboxText                               ?{textboxText:saved.textboxText}:{}),
        ...(saved.p2Reveal                                  ?{p2Reveal:saved.p2Reveal}      :{}),
        ...(saved.p2Title                                   ?{p2Title:saved.p2Title}        :{}),
        ...(saved.character   &&hasScale(saved.character)   ?{character:saved.character}    :{}),
        ...(saved.zOrder                                    ?{zOrder:saved.zOrder}          :{}),
        ...(saved.sceneCircle!==undefined                   ?{sceneCircle:saved.sceneCircle}:{}),
      }
    }
    return merged
  })

  const panelRef    = useRef<HTMLDivElement>(null)
  const layoutsRef  = useRef(layouts)
  const selectedRef = useRef(selected)
  const createdRef  = useRef(created)
  useEffect(()=>{layoutsRef.current=layouts},[layouts])
  useEffect(()=>{selectedRef.current=selected; setEditingId(null)},[selected])
  useEffect(()=>{createdRef.current=created},[created])

  useEffect(()=>{
    const t=setTimeout(()=>store.setCreatedComic(topicId,{...createdRef.current,layouts}),300)
    return ()=>clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[layouts])

  const dragState=useRef<{id:string;startMX:number;startMY:number;startX:number;startY:number}|null>(null)

  const startDrag=useCallback((id:string,e:React.MouseEvent)=>{
    e.preventDefault()
    e.stopPropagation()
    setSelectedEl(id)
    const pKey=String(selectedRef.current)
    const layout=layoutsRef.current[pKey]??{}
    const defaults=buildDefaultLayouts(store.project!.characters)
    const elem=(layout[id as keyof PanelLayout]??defaults[pKey]?.[id as keyof PanelLayout]) as {x:number;y:number}|undefined
    if (!elem) return
    dragState.current={id,startMX:e.clientX,startMY:e.clientY,startX:elem.x,startY:elem.y}
  },[store.project])

  useEffect(()=>{
    function onMove(e:MouseEvent){
      if (!dragState.current||!panelRef.current) return
      const rect=panelRef.current.getBoundingClientRect()
      const {id,startMX,startMY,startX,startY}=dragState.current
      const dx=(e.clientX-startMX)/rect.width*100
      const dy=(e.clientY-startMY)/rect.height*100
      setLayouts(prev=>{
        const key=String(selectedRef.current)
        const pl={...(prev[key]??{})}
        const defaults=buildDefaultLayouts(store.project!.characters)
        const elem=(pl[id as keyof PanelLayout]??defaults[key]?.[id as keyof PanelLayout])
        if (!elem) return prev
        return {...prev,[key]:{...pl,[id]:{...(elem as object),x:startX+dx,y:startY+dy}}}
      })
    }
    function onUp(){
      if (!dragState.current) return
      dragState.current=null
      store.setCreatedComic(topicId,{...createdRef.current,layouts:layoutsRef.current})
    }
    window.addEventListener('mousemove',onMove)
    window.addEventListener('mouseup',onUp)
    return ()=>{window.removeEventListener('mousemove',onMove);window.removeEventListener('mouseup',onUp)}
  },[topicId,store])

  function updateSlot(id:string,changes:Partial<ImageSlot|TextSlot|CharacterSlot>) {
    const defaults=buildDefaultLayouts(project.characters)
    setLayouts(prev=>{
      const pKey=String(selected)
      const pl={...(prev[pKey]??{})}
      const elem=(pl[id as keyof PanelLayout]??defaults[pKey]?.[id as keyof PanelLayout]) as Record<string,unknown>|undefined
      if (!elem) return prev
      const next={...prev,[pKey]:{...pl,[id]:{...elem,...changes}}}
      layoutsRef.current=next; return next
    })
  }

  function updateLayout(changes:Partial<PanelLayout>) {
    setLayouts(prev=>{
      const pKey=String(selected)
      const next={...prev,[pKey]:{...(prev[pKey]??{}),...changes}}
      layoutsRef.current=next; return next
    })
  }

  function swapPhoto(key:keyof ComicImages,url:string) {
    store.setCreatedComic(topicId,{...createdRef.current,images:{...images,[key]:url}})
  }

  function handleEdit(id:string) { setEditingId(id); setSelectedEl(id) }

  function handleSave(id:string, text:string) {
    const key = SCRIPT_KEY_MAP[selected]?.[id]
    if (key) store.setProjectPanel(topicId, {...script,[key]:text})
    setEditingId(null)
  }

  function openRegen(elementId: string) {
    const info = getRegenInfo(elementId, selected)
    if (!info) return
    const savedPrompt = (script[info.promptKey] as string) ?? ''
    const isObject = info.imageKey === 'panel2_object'

    let prompt = savedPrompt
    if (isObject) {
      // Extract just the object description from whatever is saved:
      // "Create the X in a single..." → extract X
      const createMatch = savedPrompt.match(/^Create the (.+?) in a single/i)
      // "Object: X" (old style) → extract X
      const objectMatch = savedPrompt.match(/^Object:\s*(.+)/im)
      prompt = (createMatch?.[1]?.trim()
        ?? objectMatch?.[1]?.trim()
        ?? (savedPrompt.length < 200 ? savedPrompt.trim() : ''))
        || script.panel2_title.replace(/!/g, '').trim()
        || 'object'
    }

    setRegenState({
      imageKey: info.imageKey,
      promptKey: info.promptKey,
      label: info.label,
      prompt,
      objectMode: isObject,
      loading: false,
      error: null,
    })
  }

  async function doRegen() {
    if (!regenState) return
    setRegenState(s => s ? {...s, loading:true, error:null} : s)
    try {
      const fullPrompt = regenState.objectMode
        ? buildObjectStickerPrompt(regenState.prompt)
        : regenState.prompt
      const res = await fetch('/api/regenerate-image', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({
          projectId: project.project_id,
          topicId,
          imageKey: regenState.imageKey,
          prompt: fullPrompt,
        }),
      })
      if (!res.ok) {
        const body = await res.text().catch(()=>'')
        let msg = 'Regeneration failed'
        try { msg = (JSON.parse(body).error ?? body) || msg } catch { msg = body || msg }
        throw new Error(msg)
      }
      const {url} = await res.json()
      // Run client-side chroma-key on panel 2 object to remove the magenta background,
      // then save the transparent PNG back to the server to keep the project JSON small.
      const finalUrl = regenState.imageKey === 'panel2_object'
        ? await chromaKeyAndSave(url, project.project_id, topicId, regenState.imageKey)
        : url
      store.setCreatedComic(topicId, {...createdRef.current, images:{...images,[regenState.imageKey]:finalUrl}})
      // For object mode, save just the description (so next time modal shows it cleanly)
      store.setProjectPanel(topicId, {...script,[regenState.promptKey]:regenState.prompt})
      setRegenState(null)
    } catch (err) {
      setRegenState(s => s ? {...s, loading:false, error:String(err)} : s)
    }
  }

  async function handleMaskToggle(_elementId: string) {
    setMaskError(null)
    const isMasked = images.panel2_object?.includes('_masked')
    if (isMasked) {
      // Remove mask: revert to the raw magenta PNG
      const rawUrl = `/generated/${project.project_id}/${topicId}/panel2_object.png?t=${Date.now()}`
      store.setCreatedComic(topicId, {...createdRef.current, images:{...images, panel2_object: rawUrl}})
      return
    }
    // Apply mask: source URL — strip cache buster; if it's a dataURL use it directly
    const currentUrl = images.panel2_object ?? ''
    if (!currentUrl) { setMaskError('No image to mask — generate the comic first.'); return }
    const sourceUrl = currentUrl.startsWith('data:') ? currentUrl : currentUrl.split('?')[0]
    try {
      setMaskBusy(true)
      const maskedUrl = await chromaKeyAndSave(sourceUrl, project.project_id, topicId, 'panel2_object')
      store.setCreatedComic(topicId, {...createdRef.current, images:{...images, panel2_object: maskedUrl}})
    } catch (err) {
      setMaskError(String(err))
    } finally {
      setMaskBusy(false)
    }
  }

  async function handleExport() {
    if (!panelRef.current) return
    setExporting(true); setExportErr(null)
    const originalSelected = selectedRef.current
    try {
      // Capture each panel by switching to it, waiting for paint, then html2canvas
      const captured: HTMLCanvasElement[] = []
      for (let i = 0; i < 7; i++) {
        setSelected(i)
        // Wait two animation frames so React re-renders and images paint
        await new Promise<void>(r => requestAnimationFrame(() => { requestAnimationFrame(() => r()) }))
        const { default: html2canvas } = await import('html2canvas')
        const c = await html2canvas(panelRef.current!, {
          useCORS: true, allowTaint: true, scale: 2, logging: false,
        })
        captured.push(c)
      }
      setSelected(originalSelected)

      // Load the End Frame image
      const endFrameImg = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image(); img.crossOrigin = 'anonymous'
        img.onload = () => resolve(img); img.onerror = reject
        img.src = '/assets/End_Frame.jpg?t=' + Date.now()
      })

      // 2×4 grid, canvas sized to fit exactly — no fixed aspect ratio
      const PAD=80, GAP=40
      // Use the captured panel size as cell size (already 480*scale px)
      const cellSize = captured[0].width  // html2canvas scale:2 → 960px
      const canvasW = PAD*2 + cellSize*2 + GAP
      const canvasH = PAD*2 + cellSize*4 + GAP*3

      const a4=document.createElement('canvas')
      a4.width=canvasW; a4.height=canvasH
      const ctx=a4.getContext('2d')!
      ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,canvasW,canvasH)

      // Draw image contained (no crop) centred inside cell
      function drawContain(src:HTMLCanvasElement|HTMLImageElement, col:number, row:number) {
        const cellX = PAD + col*(cellSize+GAP)
        const cellY = PAD + row*(cellSize+GAP)
        const sw = src instanceof HTMLCanvasElement ? src.width  : src.naturalWidth
        const sh = src instanceof HTMLCanvasElement ? src.height : src.naturalHeight
        const scale = Math.min(cellSize/sw, cellSize/sh)
        const dw = sw*scale, dh = sh*scale
        const dx = cellX + (cellSize-dw)/2
        const dy = cellY + (cellSize-dh)/2
        ctx.drawImage(src, 0, 0, sw, sh, dx, dy, dw, dh)
      }

      // 2×4 grid: panels 0–6 then End_Frame
      for(let i=0;i<7;i++) drawContain(captured[i], i%2, Math.floor(i/2))
      drawContain(endFrameImg, 7%2, Math.floor(7/2))

      const dataUrl=a4.toDataURL('image/png')

      // Trigger download
      const link=document.createElement('a')
      link.href=dataUrl; link.download=`comics-${topicId}.png`; link.click()

      // Save to server
      const res=await fetch('/api/save-export',{
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({projectId:project.project_id, topicId, dataUrl})
      })
      if(res.ok){
        const {url}=await res.json()
        store.setCreatedComic(topicId,{...createdRef.current,exports:[...(createdRef.current.exports??[]),url]})
      }
    } catch(err) {
      setSelected(originalSelected)
      setExportErr(String(err))
    } finally {
      setExporting(false)
    }
  }

  const layout=layouts[String(selected)]??{}
  const chr=layout.character
  const charSrc=chr?.assetId
    ?(charImages.getImage(chr.assetId)??assetLibrary.characters.find(a=>a.asset_id===chr.assetId)?.file??null)
    :null

  const panelProps:PanelProps={script,images,layout,charSrc,selectedEl,editingId,panelIdx:selected,onDragStart:startDrag,onEdit:handleEdit,onSave:handleSave}

  const panels=[
    <Panel0       key={0} {...panelProps}/>,
    <Panel1Reveal key={1} {...panelProps}/>,
    <Panel2       key={2} {...panelProps}/>,
    <PanelFact key={3} panelIdx={3} fact={script.panel4_fact} speech={script.panel4_speech} sceneImageSrc={images.panel4_scene} layout={layout} charSrc={charSrc} selectedEl={selectedEl} editingId={editingId} onDragStart={startDrag} onEdit={handleEdit} onSave={handleSave}/>,
    <PanelFact key={4} panelIdx={4} fact={script.panel5_fact} speech={script.panel5_speech} sceneImageSrc={images.panel5_scene} layout={layout} charSrc={charSrc} selectedEl={selectedEl} editingId={editingId} onDragStart={startDrag} onEdit={handleEdit} onSave={handleSave}/>,
    <PanelFact key={5} panelIdx={5} fact={script.panel6_fact} speech={script.panel6_speech} sceneImageSrc={images.panel6_scene} layout={layout} charSrc={charSrc} selectedEl={selectedEl} editingId={editingId} onDragStart={startDrag} onEdit={handleEdit} onSave={handleSave}/>,
    <Panel6       key={6} {...panelProps}/>,
  ]

  const exps = created.exports ?? []
  const lastExport = exps.length > 0 ? exps[exps.length-1] : undefined

  return (
    <div className={styles.editorLayout}>
      <div className={styles.panelStrip}>
        <div className={styles.stripHeader}><span>Panels</span><span className={styles.stripCount}>7</span></div>
        <div className={styles.stripList}>
          {PANEL_LABELS.map((label,i)=>(
            <button key={i}
              className={`${styles.panelThumb} ${selected===i?styles.panelThumbActive:''}`}
              onClick={()=>{setSelected(i);setSelectedEl(null)}}>
              <div className={styles.thumbNum}>{i+1}</div>
              <div className={styles.thumbLabel}>{label}</div>
            </button>
          ))}
        </div>
        <div className={styles.stripFooter}>
          {exportErr && <div className={styles.exportErr}>{exportErr}</div>}
          <button className={styles.btnExport} disabled={exporting} onClick={handleExport}>
            {exporting ? '⏳ Exporting…' : '📤 Export Comics'}
          </button>
          {lastExport && (
            <a className={styles.btnViewExport} href={lastExport} target="_blank" rel="noreferrer">
              🖼 View last export
            </a>
          )}
        </div>
      </div>

      <div className={styles.canvasArea}>
        <div className={styles.panelPreviewWrap} ref={panelRef}
          onMouseDown={e=>{
            // Fires only when clicking empty panel space (children call stopPropagation)
            const bgId = selected===1 ? 'objectImage' : (selected>=3&&selected<=5) ? 'sceneImage' : 'bgImage'
            startDrag(bgId,e)
          }}
        >{panels[selected]}</div>
        <div className={styles.dragHint}>Click to select · Drag to move · Double-click text to edit</div>
      </div>

      <PropsPanel
        panelIdx={selected} layout={layout} images={images} script={script}
        project={project} selectedEl={selectedEl} setSelectedEl={setSelectedEl}
        updateSlot={updateSlot} updateLayout={updateLayout}
        swapPhoto={swapPhoto} charImages={charImages}
        onRegen={openRegen}
        onMaskToggle={handleMaskToggle}
        maskBusy={maskBusy}
        maskError={maskError}
      />

      {regenState&&(
        <RegenerateModal
          state={regenState}
          onChange={text=>setRegenState(s=>s?{...s,prompt:text}:s)}
          onConfirm={doRegen}
          onCancel={()=>setRegenState(null)}
        />
      )}
    </div>
  )
}

// ── Root view ─────────────────────────────────────────────────────────────────
export default function EditComicsView() {
  const store = useStore()
  const {setActiveNav, editComicsTopicId, setEditComicsTopicId} = useApp()
  const [selectedTopicId, setSelectedTopicId] = useState<string|null>(() => editComicsTopicId)

  useEffect(() => {
    if (editComicsTopicId) setEditComicsTopicId(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!store.project) return (
    <div className={styles.empty}>
      <div className={styles.emptyIcon}>✏️</div>
      <h2 className={styles.emptyTitle}>No comic to edit</h2>
      <p className={styles.emptyText}>Review your comic scripts and create panels first.</p>
      <button className={styles.btnPrimary} onClick={()=>setActiveNav('review-comics')}>📋 Review Comics Script</button>
    </div>
  )

  const createdComics=store.project.createdComics??{}
  const panelsMap=store.project.panels??{}
  const scripts=store.project.scripts??[]
  const createdTopics=scripts.filter(s=>createdComics[s.id])

  if (!selectedTopicId) return (
    <div className={styles.listPage}>
      <div className={styles.listHeader}>
        <h1 className={styles.listTitle}>Edit Comics</h1>
        <p className={styles.listSubtitle}>{createdTopics.length} comic{createdTopics.length!==1?'s':''} ready to edit.</p>
      </div>
      <div className={styles.comicGrid}>
        {createdTopics.map((s,i)=>(
          <button key={s.id} className={styles.comicCard} onClick={()=>setSelectedTopicId(s.id)}>
            <div className={styles.comicCardNum}>{i+1}</div>
            <div className={styles.comicCardTitle}>{s.topic}</div>
            <div className={styles.comicCardMeta}>7 panels · Images ready 🎨</div>
            <div className={styles.comicCardArrow}>→</div>
          </button>
        ))}
      </div>
    </div>
  )

  const created=createdComics[selectedTopicId]
  const script=panelsMap[selectedTopicId]
  const topic=scripts.find(s=>s.id===selectedTopicId)
  if (!created||!script){setSelectedTopicId(null);return null}

  return (
    <div className={styles.editorPage}>
      <div className={styles.editorPageHeader}>
        <button className={styles.btnBack} onClick={()=>setSelectedTopicId(null)}>← Back to list</button>
        <h1 className={styles.editorPageTitle}>{topic?.topic??'Comic'}</h1>
      </div>
      <ComicEditor topicId={selectedTopicId} script={script} created={created}/>
    </div>
  )
}
