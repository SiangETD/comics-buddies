import { v4 as uuid } from 'uuid'
import type {
  ComicProject,
  GenerationInput,
  CharacterName,
  ComicElement,
  Panel,
} from '../types'

// Helper to build a character element
function charEl(
  character: CharacterName,
  pose: string,
  x: number,
  y: number,
  w = 160,
  h = 220,
  flipX = false,
  zIndex = 4,
): ComicElement {
  return {
    id: uuid(),
    type: 'character',
    asset_id: `${character}_${pose}`,
    character,
    pose,
    x,
    y,
    width: w,
    height: h,
    flipX,
    zIndex,
    opacity: 1,
  }
}

// Helper to build a speech bubble element
function bubbleEl(
  speaker: string,
  text: string,
  x: number,
  y: number,
  w = 280,
  h = 90,
  bubbleType: 'normal' | 'shout' | 'thought' | 'question' | 'caption' = 'normal',
  tailDirection: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right' | 'none' = 'bottom-left',
): ComicElement {
  return {
    id: uuid(),
    type: 'speechBubble',
    speaker,
    text,
    bubbleType,
    tailDirection,
    x,
    y,
    width: w,
    height: h,
    fontSize: 14,
    zIndex: 6,
    opacity: 1,
  }
}

// Helper to build an object element
function objEl(
  assetId: string,
  name: string,
  x: number,
  y: number,
  w = 100,
  h = 100,
): ComicElement {
  return {
    id: uuid(),
    type: 'object',
    asset_id: assetId,
    name,
    x,
    y,
    width: w,
    height: h,
    zIndex: 3,
    opacity: 1,
  }
}

// Helper to build a panel
function makePanel(
  backgroundId: string,
  x: number,
  y: number,
  w: number,
  h: number,
  elements: ComicElement[],
): Panel {
  return {
    id: uuid(),
    background_id: backgroundId,
    layout: { x, y, width: w, height: h },
    elements,
  }
}

const PAGE_W = 800
const PAGE_H = 560

export function generateMockComic(input: GenerationInput): ComicProject {
  const { topic, learning_objective, subject, level, characters } = input
  const [char1 = 'bouncy', char2 = 'merry', char3 = 'pokpok'] = characters

  const now = new Date().toISOString()

  // ── Page 1: Introduction / Hook ──────────────────────────────────────────
  const page1Panels: Panel[] = [
    makePanel('classroom', 20, 20, PAGE_W - 40, PAGE_H - 40, [
      charEl(char1, 'idle', 80, 160),
      charEl(char2, 'confused', 540, 160, 160, 220, true),
      bubbleEl(char1, `Hey ${char2}! Do you know about "${topic}"?`, 60, 40, 300, 90, 'normal', 'bottom-left'),
      bubbleEl(char2, 'Hmm... not really!', 440, 40, 220, 70, 'thought', 'bottom-right'),
    ]),
  ]

  // ── Page 2: Problem / Misunderstanding ──────────────────────────────────
  const page2Panels: Panel[] = [
    makePanel('classroom', 20, 20, (PAGE_W - 50) / 2, PAGE_H - 40, [
      charEl(char1, 'confused', 60, 130),
      bubbleEl(char1, `I thought I knew about ${topic}, but I was wrong!`, 30, 20, 240, 95, 'normal', 'bottom-left'),
    ]),
    makePanel('hdb_void_deck', (PAGE_W - 50) / 2 + 30, 20, (PAGE_W - 50) / 2, PAGE_H - 40, [
      charEl(char2, 'worried', 60, 130),
      bubbleEl(char2, 'Oh no, we need to learn more about this!', 20, 20, 250, 90, 'shout', 'bottom-left'),
    ]),
  ]

  // ── Page 3: Explanation ──────────────────────────────────────────────────
  const page3Panels: Panel[] = [
    makePanel('science_lab', 20, 20, PAGE_W - 40, (PAGE_H - 50) / 2, [
      charEl(char3, 'explaining', 60, 60, 140, 190),
      charEl(char1, 'idle', 480, 60, 140, 190, true),
      bubbleEl(char3, `Let me explain! ${topic} is important because...`, 60, 10, 300, 75, 'normal', 'bottom-left'),
    ]),
    makePanel('classroom', 20, (PAGE_H - 50) / 2 + 30, PAGE_W - 40, (PAGE_H - 50) / 2, [
      charEl(char3, 'holding_book', 60, 40, 140, 180),
      bubbleEl(char3, `The key idea is: ${learning_objective}`, 60, 10, 320, 80, 'normal', 'bottom-left'),
      charEl(char2, 'happy', 490, 50, 140, 180, true),
      bubbleEl(char2, 'Ohhh! Now I understand!', 390, 10, 210, 70, 'normal', 'bottom-right'),
    ]),
  ]

  // ── Page 4: Example / Consequence ───────────────────────────────────────
  const page4Panels: Panel[] = [
    makePanel('park', 20, 20, PAGE_W - 40, (PAGE_H - 50) / 2, [
      charEl(char1, 'excited', 60, 55),
      objEl('tablet', 'Tablet', 280, 120, 100, 110),
      bubbleEl(char1, `Look! Here is an example of ${topic} in action!`, 40, 10, 300, 80, 'normal', 'bottom-left'),
    ]),
    makePanel('school_canteen', 20, (PAGE_H - 50) / 2 + 30, (PAGE_W - 50) / 2, (PAGE_H - 50) / 2, [
      charEl(char2, 'happy', 50, 30, 130, 170),
      bubbleEl(char2, 'This makes a big difference!', 30, 5, 220, 70, 'normal', 'bottom-left'),
    ]),
    makePanel('park', (PAGE_W - 50) / 2 + 30, (PAGE_H - 50) / 2 + 30, (PAGE_W - 50) / 2, (PAGE_H - 50) / 2, [
      charEl(char3, 'pointing', 40, 30, 130, 170),
      bubbleEl(char3, 'We can all do our part!', 20, 5, 220, 70, 'normal', 'bottom-left'),
    ]),
  ]

  // ── Page 5: Singapore Context ────────────────────────────────────────────
  const page5Panels: Panel[] = [
    makePanel('hdb_void_deck', 20, 20, PAGE_W - 40, PAGE_H - 40, [
      charEl(char1, 'pointing', 60, 140),
      charEl(char2, 'idle', 460, 140, 160, 220, true),
      charEl(char3, 'explaining', 260, 160, 150, 210),
      bubbleEl(char1, `In Singapore, ${topic} is especially important!`, 30, 20, 300, 90, 'normal', 'bottom-left'),
      bubbleEl(char3, `The government and community work together on this.`, 250, 20, 280, 90, 'normal', 'bottom-right'),
    ]),
  ]

  // ── Page 6: Ending / Reflection ──────────────────────────────────────────
  const page6Panels: Panel[] = [
    makePanel('classroom', 20, 20, PAGE_W - 40, PAGE_H - 40, [
      charEl(char1, 'happy', 80, 150, 160, 220),
      charEl(char2, 'excited', 290, 160, 160, 220),
      charEl(char3, 'holding_book', 500, 140, 150, 220, true),
      bubbleEl('narrator', `What can YOU do today to help with "${topic}"?`, 100, 20, 580, 90, 'caption', 'none'),
      bubbleEl(char2, 'I will start tomorrow!', 200, 320, 220, 70, 'normal', 'bottom-left'),
    ]),
  ]

  return {
    project_id: uuid(),
    title: `${topic} — A Yummy Buddies Comic`,
    topic,
    learning_objective,
    subject,
    level,
    characters,
    created_at: now,
    updated_at: now,
    pages: [
      {
        page_number: 1,
        page_type: 'introduction_question',
        purpose: 'Introduce the topic with a hook and spark curiosity.',
        panels: page1Panels,
      },
      {
        page_number: 2,
        page_type: 'problem_misunderstanding',
        purpose: 'Show a common misconception or problem related to the topic.',
        panels: page2Panels,
      },
      {
        page_number: 3,
        page_type: 'explanation',
        purpose: 'Explain the key concept clearly with character dialogue.',
        panels: page3Panels,
      },
      {
        page_number: 4,
        page_type: 'example_consequence',
        purpose: 'Show a real example and its impact.',
        panels: page4Panels,
      },
      {
        page_number: 5,
        page_type: 'singapore_context',
        purpose: "Connect the topic to Singapore's context and daily life.",
        panels: page5Panels,
      },
      {
        page_number: 6,
        page_type: 'ending_reflection',
        purpose: 'End with a reflection question or call to action.',
        panels: page6Panels,
      },
    ],
  }
}
