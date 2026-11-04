import { useState, useCallback } from 'react'
import type { CreativeGuide, CharacterBible } from '../types'

const STORAGE_KEY = 'cb_creative_guide'

const DEFAULT_GUIDE: CreativeGuide = {
  id: 'yummy-buddies',
  name: 'Yummy Buddies',
  worldSetting: `Yummy Buddies takes place in a warm, everyday Singapore — schools, void decks, parks, canteens, and homes. The characters are anthropomorphic food friends who attend school together. Stories weave curriculum topics into real-life situations that Singapore primary school students recognise.

The tone is friendly and age-appropriate for P1–P6. Dialogue is simple and natural. Each story ends with a clear learning moment. The world follows real Singapore school life: characters navigate friendships, classroom lessons, CCAs, and everyday challenges.`,
  aiWorldGuide: `Bright, clean, flat-colour illustration style. Singapore primary school environments: classrooms with green chalkboards, void decks, HDB corridors, school canteens, parks. Backgrounds are simple and uncluttered. Characters are small anthropomorphic food characters — scale them naturally within the environment. Warm, friendly colour palette. No dark or gritty elements.`,
  characters: [
    {
      id: 'bouncy',
      name: 'Bouncy',
      personality: 'Energetic, playful, and impulsive. Dives into situations headfirst and often learns from mistakes. Full of heart and enthusiasm. Can never sit still.',
      speechStyle: 'Short, punchy sentences. Often exclaims. Lots of "Wow!", "Let\'s go!", "Wait, really?!". Simple vocabulary, high energy. Speaks before thinking.',
      catchphrases: '"Let\'s bounce into it!", "That\'s SO cool!", "Wait — can we do that again?!"',
      strengths: 'Fearless, enthusiastic, energises the whole group, always willing to try first',
      struggles: 'Impulsive — rushes ahead without thinking, sometimes causes the problem the story has to solve',
      specialPower: 'Bouncing — can reach high places and cover ground faster than anyone else',
      appearance: 'Round, bouncy food character. Bright, warm colour. Wide eyes, big smile. Poses always suggest movement — never fully still.',
      signatureItems: 'Always seems to have too much energy for their body to contain',
      mannerisms: 'Bounces slightly even when standing still. Often mid-jump or mid-run in panels. Gestures are big and exaggerated.',
      aiImageGuide: '',
      image: undefined,
    },
    {
      id: 'merry',
      name: 'Merry',
      personality: 'Warm, caring, and empathetic. The emotional heart of the group. Steady and reliable. Notices how others feel and brings everyone together.',
      speechStyle: 'Warm and encouraging. "Are you okay?", "We can figure this out together!", "I believe in you!". Complete sentences, gentle tone.',
      catchphrases: '"We\'re in this together!", "Let\'s think about how everyone feels", "I knew we could do it!"',
      strengths: 'Empathetic, a great listener, keeps the group united, sees the best in others',
      struggles: 'Sometimes so focused on how others feel that she neglects to speak up for herself',
      specialPower: 'Sharing — can give energy, confidence, or calm to anyone nearby just by being present',
      appearance: 'Soft, round food character. Warm, sunny colour. Gentle eyes, kind smile. Poses are open and welcoming.',
      signatureItems: 'Often depicted reaching out a hand or leaning toward whoever needs support',
      mannerisms: 'Tilts head when listening. Puts a hand on others\' shoulders. Smiles even when worried.',
      aiImageGuide: '',
      image: undefined,
    },
    {
      id: 'pokpok',
      name: 'Pokpok',
      personality: 'Calm, analytical, and bookish. Loves facts and figuring things out. Can seem serious but cares deeply about doing things right and helping the group succeed.',
      speechStyle: 'More formal, complete sentences. Likes to explain: "Actually, the reason is…", "According to what I read…", "Interesting hypothesis."',
      catchphrases: '"Actually, did you know…", "Let me check my notes.", "The data suggests…"',
      strengths: 'Knowledgeable, careful planner, stays calm under pressure, very reliable',
      struggles: 'Can overcomplicate things, sometimes misses the emotional side of a situation',
      specialPower: 'Research — can recall any fact from any book, and always has a reference for the situation at hand',
      appearance: 'Neat, slightly compact food character. Cool, calm colour. Focused eyes, thoughtful expression. Often depicted with a book or scroll.',
      signatureItems: 'A small notebook or book, always nearby. Round glasses in some depictions.',
      mannerisms: 'Adjusts glasses. Taps chin when thinking. Raises a finger when about to share a fact.',
      aiImageGuide: '',
      image: undefined,
    },
  ],
}

function load(): CreativeGuide {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_GUIDE
    const parsed = JSON.parse(raw) as CreativeGuide
    // Merge: ensure all 3 default characters exist (in case new fields were added)
    return parsed
  } catch {
    return DEFAULT_GUIDE
  }
}

function save(guide: CreativeGuide) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(guide))
  } catch {}
}

export function useCreativeGuide() {
  const [guide, setGuideState] = useState<CreativeGuide>(load)

  const setGuide = useCallback((next: CreativeGuide) => {
    save(next)
    setGuideState(next)
  }, [])

  const resetToDefaults = useCallback(() => {
    save(DEFAULT_GUIDE)
    setGuideState(DEFAULT_GUIDE)
  }, [])

  // Export in Ani Buddies-compatible format
  const exportGuide = useCallback(() => {
    const blob = new Blob([JSON.stringify(guide, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `creative-guide-${guide.name.replace(/\s+/g, '-').toLowerCase()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [guide])

  // Import from Ani Buddies or Comics Buddies JSON
  const importGuide = useCallback((file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = ev => {
        try {
          const raw = JSON.parse(ev.target?.result as string)
          // Normalise Ani Buddies shape to our shape
          const imported: CreativeGuide = {
            id: raw.id ?? `guide_${Date.now()}`,
            name: raw.name ?? 'Imported Guide',
            worldSetting: raw.worldSetting ?? '',
            aiWorldGuide: raw.aiWorldGuide ?? '',
            characters: (raw.characters ?? []).map((c: CharacterBible & { id?: string }) => ({
              id: c.id ?? `char_${Date.now()}_${Math.random()}`,
              name: c.name ?? '',
              personality: c.personality ?? '',
              speechStyle: c.speechStyle ?? '',
              catchphrases: c.catchphrases ?? '',
              strengths: c.strengths ?? '',
              struggles: c.struggles ?? '',
              specialPower: c.specialPower ?? '',
              appearance: c.appearance ?? '',
              signatureItems: c.signatureItems ?? '',
              mannerisms: c.mannerisms ?? '',
              aiImageGuide: c.aiImageGuide ?? '',
              image: c.image,
            })),
          }
          setGuide(imported)
          resolve()
        } catch {
          reject(new Error('Invalid guide file'))
        }
      }
      reader.readAsText(file)
    })
  }, [setGuide])

  return { guide, setGuide, exportGuide, importGuide, resetToDefaults }
}
