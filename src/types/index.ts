export type CharacterName = 'bouncy' | 'merry' | 'pokpok'
export type BubbleType = 'normal' | 'shout' | 'thought' | 'question' | 'caption'
export type ElementType = 'character' | 'object' | 'speechBubble' | 'background' | 'text'
export type PageType =
  | 'introduction_question'
  | 'problem_misunderstanding'
  | 'explanation'
  | 'example_consequence'
  | 'singapore_context'
  | 'ending_reflection'

export interface BaseElement {
  id: string
  type: ElementType
  x: number
  y: number
  width: number
  height: number
  zIndex: number
  opacity?: number
}

export interface CharacterElement extends BaseElement {
  type: 'character'
  asset_id: string
  character: CharacterName
  pose: string
  flipX: boolean
}

export interface ObjectElement extends BaseElement {
  type: 'object'
  asset_id: string
  name: string
}

export interface SpeechBubbleElement extends BaseElement {
  type: 'speechBubble'
  speaker: string
  text: string
  bubbleType: BubbleType
  fontSize: number
  tailDirection: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right' | 'none'
}

export interface TextElement extends BaseElement {
  type: 'text'
  text: string
  fontSize: number
  fontStyle: 'normal' | 'bold' | 'italic'
  color: string
  align: 'left' | 'center' | 'right'
}

export type ComicElement =
  | CharacterElement
  | ObjectElement
  | SpeechBubbleElement
  | TextElement

export interface Panel {
  id: string
  background_id: string
  layout: { x: number; y: number; width: number; height: number }
  elements: ComicElement[]
}

export interface ComicPage {
  page_number: number
  page_type: PageType
  purpose: string
  panels: Panel[]
}

export interface ComicIdea {
  id: string
  topic: string
  objectives: string      // 1-2 learning objectives
  facts: [string, string, string]  // facts for panels 3, 4, 5
  selected: boolean
}

export interface ComicPanelScript {
  topicId: string
  panel1_question: string
  panel1_photo_prompt: string
  panel2_reveal: string
  panel2_title: string
  panel2_object_prompt: string
  panel3_trigger: string
  panel4_fact: string
  panel4_speech: string
  panel4_scene_prompt: string
  panel5_fact: string
  panel5_speech: string
  panel5_scene_prompt: string
  panel6_fact: string
  panel6_speech: string
  panel6_scene_prompt: string
  panel7_closing: string
}

export interface ComicImages {
  panel1: string           // photo background (panels 1, 3, 7)
  panel2_object: string    // object cutout (panel 2)
  panel4_scene: string     // circular frame scene (panel 4)
  panel5_scene: string     // circular frame scene (panel 5)
  panel6_scene: string     // circular frame scene (panel 6)
}

export interface ElementPos {
  x: number; y: number
}

export interface ImageSlot {
  x: number; y: number
  scale: number    // width as % of panel width (can exceed 100)
  blur: number
  rotation?: number  // degrees
  flipX?: boolean
}

export interface TextSlot {
  x: number; y: number   // center-x/y as % of panel
  width: number          // container width as % of panel
  fontSize: number       // px
  rotation?: number
}

export interface CharacterSlot extends ImageSlot {
  assetId: string
}

export interface PanelLayout {
  character?: CharacterSlot
  bgImage?: ImageSlot       // panels 0, 2, 6 photo background
  objectImage?: ImageSlot   // panel 1 object
  sceneImage?: ImageSlot    // panels 3–5 circular scene
  bubble?: ImageSlot        // speech bubble / slate PNG (center-based)
  bubbleText?: TextSlot     // text over the bubble (separate element)
  textbox?: ImageSlot       // textbox PNG
  textboxText?: TextSlot    // text in the textbox
  p2Reveal?: TextSlot       // panel 1 (Reveal) upper text
  p2Title?: TextSlot        // panel 1 (Reveal) title text
  sceneCircle?: boolean     // clip sceneImage as circle (default true)
  zOrder?: string[]         // moveable element IDs back→front
}

export interface CreatedComic {
  topicId: string
  images: ComicImages
  createdAt: string
  layouts?: Record<string, PanelLayout>  // "0"–"6" → layout
  exports?: string[]                      // URLs of exported A4 PNGs
}

export interface ComicProject {
  project_id: string
  title: string
  topic: string
  learning_objective: string
  subject: string
  level: string
  characters: CharacterName[]
  created_at: string
  updated_at: string
  pages: ComicPage[]
  scripts?: ComicIdea[]                           // saved topic scripts
  panels?: Record<string, ComicPanelScript>       // generated comic panel scripts keyed by topicId
  createdComics?: Record<string, CreatedComic>    // fully created comics with images, keyed by topicId
}

// Asset metadata types
export interface CharacterAsset {
  asset_id: string
  character: CharacterName
  pose: string
  emotion: string
  file: string
  tags: string[]
}

export interface BackgroundAsset {
  asset_id: string
  name: string
  file: string
  tags: string[]
}

export interface ObjectAsset {
  asset_id: string
  name: string
  file: string
  tags: string[]
  generated?: boolean
}

export interface AssetLibrary {
  characters: CharacterAsset[]
  backgrounds: BackgroundAsset[]
  objects: ObjectAsset[]
}

// ── Creative Guide ────────────────────────────────────────────────────────────
export interface CharacterBible {
  id: string
  name: string
  personality: string
  speechStyle: string
  catchphrases: string
  strengths: string
  struggles: string
  specialPower: string
  appearance: string
  signatureItems: string
  mannerisms: string
  aiImageGuide: string
  image?: string
}

export interface CreativeGuide {
  id: string
  name: string
  worldSetting: string
  aiWorldGuide: string
  characters: CharacterBible[]
}

// Generation input
export interface GenerationInput {
  topic: string
  learning_objective: string
  subject: string
  level: string
  characters: CharacterName[]
}
