import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import multer from 'multer'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PUBLIC_DIR = path.join(__dirname, 'public')
const ASSETS_DIR = path.join(PUBLIC_DIR, 'assets')

const app = express()
app.use(cors())
app.use(express.json({ limit: '20mb' }))

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } })

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// ── Ensure a directory exists ─────────────────────────────────────────────
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}

// ── POST /api/save-asset ──────────────────────────────────────────────────
// Body: { assetPath: "characters/bouncy/happy.png", dataUrl: "data:image/png;base64,..." }
app.post('/api/save-asset', (req, res) => {
  const { assetPath, dataUrl } = req.body

  if (!assetPath || !dataUrl) {
    return res.status(400).json({ error: 'Missing assetPath or dataUrl' })
  }

  // Strip directory traversal attempts
  const safePath = path.normalize(assetPath).replace(/^(\.\.(\/|\\|$))+/, '')
  const fullPath = path.join(ASSETS_DIR, safePath)

  // Only allow writing inside the assets folder
  if (!fullPath.startsWith(ASSETS_DIR)) {
    return res.status(403).json({ error: 'Invalid path' })
  }

  try {
    ensureDir(path.dirname(fullPath))

    // Strip "data:image/...;base64," prefix
    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(base64, 'base64')
    fs.writeFileSync(fullPath, buffer)

    console.log(`[save-asset] Saved: ${safePath}`)
    res.json({ ok: true, savedTo: `/assets/${safePath}` })
  } catch (err) {
    console.error('[save-asset] Error:', err)
    res.status(500).json({ error: String(err) })
  }
})

// ── POST /api/save-project ────────────────────────────────────────────────
// Body: { projectId: string, data: ComicProject }
app.post('/api/save-project', (req, res) => {
  const { projectId, data } = req.body

  if (!projectId || !data) {
    return res.status(400).json({ error: 'Missing projectId or data' })
  }

  const safeId = projectId.replace(/[^a-zA-Z0-9_-]/g, '_')
  const projectsDir = path.join(PUBLIC_DIR, 'projects')
  ensureDir(projectsDir)

  const fullPath = path.join(projectsDir, `${safeId}.json`)
  try {
    fs.writeFileSync(fullPath, JSON.stringify(data, null, 2), 'utf8')
    console.log(`[save-project] Saved: ${safeId}.json`)
    res.json({ ok: true, savedTo: fullPath })
  } catch (err) {
    console.error('[save-project] Error:', err)
    res.status(500).json({ error: String(err) })
  }
})

// ── GET /api/list-projects ────────────────────────────────────────────────
app.get('/api/list-projects', (req, res) => {
  const projectsDir = path.join(PUBLIC_DIR, 'projects')
  ensureDir(projectsDir)
  try {
    const files = fs.readdirSync(projectsDir).filter(f => f.endsWith('.json'))
    const projects = files.map(f => {
      try {
        const raw = fs.readFileSync(path.join(projectsDir, f), 'utf8')
        const p = JSON.parse(raw)
        return { project_id: p.project_id, title: p.title, updated_at: p.updated_at, file: f }
      } catch {
        return null
      }
    }).filter(Boolean)
    res.json(projects)
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

// ── GET /api/load-project/:id ─────────────────────────────────────────────
app.get('/api/load-project/:id', (req, res) => {
  const safeId = req.params.id.replace(/[^a-zA-Z0-9_-]/g, '_')
  const fullPath = path.join(PUBLIC_DIR, 'projects', `${safeId}.json`)
  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({ error: 'Project not found' })
  }
  try {
    const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'))
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

// ── DELETE /api/projects/:id ─────────────────────────────────────────────
app.delete('/api/projects/:id', (req, res) => {
  const safeId = req.params.id.replace(/[^a-zA-Z0-9_-]/g, '_')
  const fullPath = path.join(PUBLIC_DIR, 'projects', `${safeId}.json`)
  try {
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

// ── POST /api/extract-text ────────────────────────────────────────────────
// Accepts multipart upload of .docx or .pdf, returns { text }
app.post('/api/extract-text', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

  const name = req.file.originalname.toLowerCase()

  try {
    if (name.endsWith('.docx')) {
      const mammoth = (await import('mammoth')).default
      const result = await mammoth.extractRawText({ buffer: req.file.buffer })
      return res.json({ text: result.value })
    }

    if (name.endsWith('.pdf')) {
      const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default
      const result = await pdfParse(req.file.buffer)
      return res.json({ text: result.text })
    }

    return res.status(400).json({ error: 'Unsupported file type. Use .txt, .docx, or .pdf' })
  } catch (err) {
    console.error('[extract-text] Error:', err)
    res.status(500).json({ error: String(err) })
  }
})

// ── POST /api/extract-topics ──────────────────────────────────────────────
// Body: { text: string }  →  { topics: string[] }
app.post('/api/extract-topics', async (req, res) => {
  const { text } = req.body
  if (!text?.trim()) return res.status(400).json({ error: 'No text provided' })

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not set on the server.' })
  }

  try {
    const message = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      messages: [
        {
          role: 'user',
          content: `You are an educational content specialist helping a teacher create comics for Singapore primary school students.

Read the document below and extract at least 10 distinct topics or questions that could each become the basis of an educational comic. If the document is rich enough, extract more than 10 — up to 30. Each topic should be:
- A concise phrase or question (under 15 words)
- Standalone and self-explanatory
- Suitable as a topic for a short educational comic for primary school students (ages 7–12)

Return ONLY a JSON array of strings. No explanation, no markdown fences, just the raw JSON array.

Example output:
["Why do plants need sunlight?", "How do bees make honey?", "What happens when we recycle?"]

Document:
${text.slice(0, 60000)}`,
        },
      ],
    })

    // Extract text content from response (skip thinking blocks)
    const textBlock = message.content.find(b => b.type === 'text')
    if (!textBlock) return res.status(500).json({ error: 'No response from AI' })

    let topics
    try {
      // Strip any accidental markdown fences
      const raw = textBlock.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
      topics = JSON.parse(raw)
      if (!Array.isArray(topics)) throw new Error('Not an array')
    } catch {
      return res.status(500).json({ error: 'AI returned unexpected format', raw: textBlock.text })
    }

    console.log(`[extract-topics] Extracted ${topics.length} topics`)
    res.json({ topics })
  } catch (err) {
    console.error('[extract-topics] Error:', err)
    res.status(500).json({ error: String(err) })
  }
})

// ── POST /api/generate-scripts ───────────────────────────────────────────
// Takes { rawText, subject, level } and returns { scripts: [{topic, storyflow}] }
app.post('/api/generate-scripts', express.json(), async (req, res) => {
  const { rawText, subject, level, extraInstructions } = req.body
  if (!rawText?.trim()) return res.status(400).json({ error: 'rawText is required' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set' })

  try {
    const message = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 10000,
      thinking: { type: 'adaptive' },
      messages: [{
        role: 'user',
        content: `You are a content writer for a Primary Science comic series called "Yummy Buddies".

Your task is to review the paragraph, and suggest 10 topics and accompanying learning objective for bite-sized comics.

The topics must be suitable for a simple 6-panel educational comic.

The topic should connect to Singapore context where possible.

Avoid being too textbook-like.

Focus on bite-sized knowledge, not full lesson teaching.

Prefer topics with a strong visual object that can appear clearly in Panel 1.

Avoid:
* Long explanations.
* Complex scientific terms unless explained simply.
* Topics that are too abstract or hard to draw.
* Topics that require too much background knowledge.
* Topics that are directly copied from textbook examples.
* Scary, gross, or overly detailed disease-related content.

When suggesting topics, use this 6 panel comics format:

6-Panel Comic Flow:
Panel 1 — Curiosity Hook: Yummy Buddies characters see the object/thing.
Panel 2 — Reveal: Show the object/thing clearly. Include a clear title or reveal sentence.
Panel 3 — Simple Fact 1: One simple fact about the object/thing.
Panel 4 — Simple Fact 2: One simple fact that links to extra information.
Panel 5 — Simple Fact 3: One simple fact with Singapore context, daily-life connection, or observation activity.
Panel 6 — Closing Remark: End with a short friendly takeaway.

Subject: ${subject || 'General'}
Level: ${level || 'Primary'}

INPUT CONTENT:
${rawText.slice(0, 60000)}${extraInstructions ? `\n\nADDITIONAL INSTRUCTIONS FROM TEACHER:\n${extraInstructions}` : ''}

For each of the 10 topics, provide:
1. A clear, short title (the object/animal/item name — not a question)
2. 1–2 learning objectives (what students will learn), as a single short string
3. Exactly 3 facts (for Panels 3, 4, 5) — each fact is one simple sentence suitable for a comic panel

Return ONLY a valid JSON object with this exact structure — no markdown, no explanation:
{
  "ideas": [
    {
      "topic": "Clear title here",
      "objectives": "Students will learn X. They will also understand Y.",
      "facts": ["Simple fact for panel 3.", "Simple fact for panel 4.", "Simple fact with Singapore context for panel 5."]
    }
  ]
}`,
      }],
    })

    const textBlock = message.content.find(b => b.type === 'text')
    if (!textBlock) return res.status(500).json({ error: 'No response from AI' })

    const raw = textBlock.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return res.status(500).json({ error: 'AI returned unexpected format', raw: textBlock.text })

    const parsed = JSON.parse(jsonMatch[0])
    if (!Array.isArray(parsed.ideas)) throw new Error('Missing ideas array')

    console.log(`[generate-scripts] Generated ${parsed.ideas.length} ideas`)
    res.json(parsed)
  } catch (err) {
    console.error('[generate-scripts] Error:', err)
    res.status(500).json({ error: String(err) })
  }
})

// ── Build sticker-style object prompt ────────────────────────────────────────
function buildObjectStickerPrompt(objectDescription) {
  return `Create the ${objectDescription} in a single isolated object cutout in a clean educational comic style.

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
}

// ── Core image generation helper ──────────────────────────────────────────────
async function generateImage(prompt, outDir, filename, projectId, topicId, { transparent = false } = {}) {
  const fullPrompt = transparent
    ? prompt
    : `${prompt}. Square composition, bright and clear, suitable for a children's educational comic for Singapore primary school students. No text or words in the image.`

  const body = {
    model: 'gpt-image-2',
    prompt: fullPrompt,
    size: '1024x1024',
    quality: 'medium',
    n: 1,
    output_format: 'png',
  }

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify(body),
  })
  const json = await response.json()
  if (!response.ok) {
    const msg = json.error?.message ?? json.error ?? JSON.stringify(json)
    throw new Error(`OpenAI: ${msg}`)
  }
  const imgBuffer = Buffer.from(json.data[0].b64_json, 'base64')
  fs.writeFileSync(path.join(outDir, filename), imgBuffer)
  return `/generated/${projectId}/${topicId}/${filename}`
}

// ── POST /api/create-comic-images ────────────────────────────────────────────
// Generates 5 DALL-E images for a topic's comic panels, saves to disk, returns paths
app.post('/api/create-comic-images', express.json(), async (req, res) => {
  const { projectId, topicId, panel1_photo_prompt,
          panel2_title,
          panel4_scene_prompt, panel5_scene_prompt, panel6_scene_prompt } = req.body

  if (!projectId || !topicId) return res.status(400).json({ error: 'projectId and topicId required' })
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY not set' })

  const genDir = path.join(PUBLIC_DIR, 'generated', projectId, topicId)
  ensureDir(genDir)

  // Build sticker prompt for panel 2 from the object name
  const objectName = (panel2_title ?? '').replace(/!/g, '').trim() || 'object'
  const panel2StickerPrompt = buildObjectStickerPrompt(objectName)

  try {
    const [panel1, panel2_object, panel4_scene, panel5_scene, panel6_scene] = await Promise.all([
      generateImage(panel1_photo_prompt, genDir, 'panel1.png', projectId, topicId),
      generateImage(panel2StickerPrompt, genDir, 'panel2_object.png', projectId, topicId, { transparent: true }),
      generateImage(panel4_scene_prompt, genDir, 'panel4_scene.png', projectId, topicId),
      generateImage(panel5_scene_prompt, genDir, 'panel5_scene.png', projectId, topicId),
      generateImage(panel6_scene_prompt, genDir, 'panel6_scene.png', projectId, topicId),
    ])

    console.log(`[create-comic-images] Generated 5 images for topic: ${topicId}`)
    res.json({
      images: { panel1, panel2_object, panel4_scene, panel5_scene, panel6_scene },
      panel2_object_prompt_used: panel2StickerPrompt,
    })
  } catch (err) {
    console.error('[create-comic-images] Error:', err)
    res.status(500).json({ error: String(err) })
  }
})

// ── POST /api/save-processed-image ───────────────────────────────────────────
// Saves a canvas-processed dataURL back to disk, replacing the raw magenta PNG.
// Returns the same relative URL so the project JSON stays small.
app.post('/api/save-processed-image', express.json({ limit: '20mb' }), (req, res) => {
  const { projectId, topicId, imageKey, dataUrl } = req.body
  if (!projectId || !topicId || !imageKey || !dataUrl)
    return res.status(400).json({ error: 'projectId, topicId, imageKey, dataUrl are required' })

  // Masked versions are saved as separate files so the raw magenta file stays intact
  const filenameMap = {
    panel1:        'panel1_masked.png',
    panel2_object: 'panel2_object_masked.png',
    panel4_scene:  'panel4_scene_masked.png',
    panel5_scene:  'panel5_scene_masked.png',
    panel6_scene:  'panel6_scene_masked.png',
  }
  const filename = filenameMap[imageKey]
  if (!filename) return res.status(400).json({ error: `Unknown imageKey: ${imageKey}` })

  try {
    const genDir = path.join(PUBLIC_DIR, 'generated', projectId, topicId)
    ensureDir(genDir)
    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '')
    fs.writeFileSync(path.join(genDir, filename), Buffer.from(base64, 'base64'))
    const url = `/generated/${projectId}/${topicId}/${filename}?t=${Date.now()}`
    console.log(`[save-processed-image] Saved masked ${filename} for topic: ${topicId}`)
    res.json({ url })
  } catch (err) {
    console.error('[save-processed-image] Error:', err)
    res.status(500).json({ error: String(err) })
  }
})

// ── POST /api/save-export ─────────────────────────────────────────────────────
// Saves an A4 export PNG (base64 dataUrl) to disk and returns the URL.
app.post('/api/save-export', express.json({ limit: '30mb' }), (req, res) => {
  const { projectId, topicId, dataUrl } = req.body
  if (!projectId || !topicId || !dataUrl)
    return res.status(400).json({ error: 'projectId, topicId, dataUrl required' })
  try {
    const genDir = path.join(PUBLIC_DIR, 'generated', projectId, topicId)
    ensureDir(genDir)
    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '')
    const filename = `export_${Date.now()}.png`
    fs.writeFileSync(path.join(genDir, filename), Buffer.from(base64, 'base64'))
    console.log(`[save-export] Saved ${filename} for topic: ${topicId}`)
    res.json({ url: `/generated/${projectId}/${topicId}/${filename}` })
  } catch (err) {
    console.error('[save-export] Error:', err)
    res.status(500).json({ error: String(err) })
  }
})

// ── POST /api/regenerate-image ────────────────────────────────────────────────
// Regenerates a single comic panel image with a (possibly new) prompt
app.post('/api/regenerate-image', express.json(), async (req, res) => {
  const { projectId, topicId, imageKey, prompt } = req.body
  if (!projectId || !topicId || !imageKey || !prompt)
    return res.status(400).json({ error: 'projectId, topicId, imageKey, and prompt are required' })
  if (!process.env.OPENAI_API_KEY)
    return res.status(500).json({ error: 'OPENAI_API_KEY not set' })

  const filenameMap = {
    panel1:       'panel1.png',
    panel2_object:'panel2_object.png',
    panel4_scene: 'panel4_scene.png',
    panel5_scene: 'panel5_scene.png',
    panel6_scene: 'panel6_scene.png',
  }
  const filename = filenameMap[imageKey]
  if (!filename) return res.status(400).json({ error: `Unknown imageKey: ${imageKey}` })

  const genDir = path.join(PUBLIC_DIR, 'generated', projectId, topicId)
  ensureDir(genDir)

  const isObject = imageKey === 'panel2_object'

  try {
    const url = await generateImage(prompt, genDir, filename, projectId, topicId, { transparent: isObject })
    console.log(`[regenerate-image] Regenerated ${imageKey} for topic: ${topicId}`)
    res.json({ url })
  } catch (err) {
    console.error('[regenerate-image] Error:', err)
    res.status(500).json({ error: String(err) })
  }
})

// ── POST /api/generate-comic-panels ─────────────────────────────────────────
// Takes { topic, objectives, facts, projectTitle } → returns per-panel script
app.post('/api/generate-comic-panels', express.json(), async (req, res) => {
  const { topic, objectives, facts, projectTitle } = req.body
  if (!topic || !facts?.length) return res.status(400).json({ error: 'topic and facts are required' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set' })

  try {
    const message = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 4000,
      thinking: { type: 'adaptive' },
      messages: [{
        role: 'user',
        content: `You are a content writer for "Yummy Buddies", a Singapore primary school science comic series.

You are writing the panel scripts for one comic episode about: "${topic}"

Learning objectives: ${objectives}

The 3 panel facts are:
- Fact 1 (Panel 4): ${facts[0]}
- Fact 2 (Panel 5): ${facts[1]}
- Fact 3 / Singapore context (Panel 6): ${facts[2]}

Project: ${projectTitle || 'Yummy Buddies'}

Write the text for all 7 panels. Follow these rules:
- Write for Singapore primary school students (ages 7–12). Keep language simple and fun.
- Panel 1 curiosity question: short, casual, sparks curiosity about the object (1 sentence, under 10 words). Eg: "Have you seen this before?", "What is this growing on the ground?", "Did you spot this near your home?"
- Panel 2 reveal sentence: short intro phrase ending with ellipsis. Eg: "This is a...", "We call this a...", "Meet the..."
- Panel 2 title: the topic name in UPPERCASE (1–3 words), punchy, as it would appear in large display text. Eg: "GRAVITRAP!", "MIMOSA PLANT!", "MUDSKIPPER!"
- Panel 2 object photo prompt: describe a real-world photo of the object for image generation. Natural setting, no text. Do NOT use words like "isolated", "transparent", "cartoon", "illustration", "flat". Describe it as a photo. Eg: "A close-up photo of a Gravitrap mosquito trap placed on a grass patch, black cylindrical container, NEA label visible, natural outdoor lighting"
- Panel 3 trigger question: one surprising "Did you know..." or "Do you know..." question that introduces the 3 facts. Under 15 words.
- Panel 1 photo prompt: describe a real Singapore-context photo of the object in its natural environment. Same rules as panel 2 photo prompt.
- Panels 4–6: use the provided facts exactly as the textbox caption. Write a short character speech line (what the featured creature/object would "say" if it could talk — 1 sentence, fun, in first person). Write a photo/scene prompt for inside the circular frame — describe a real photo or close-up that illustrates that fact. No "illustration" or "cartoon" language.
- Panel 7 closing remark: a friendly Singapore-life takeaway. 1–2 sentences. Eg: "Now you know — look out for Gravitraps in your neighbourhood!", "Names can trick us — always observe carefully!"

Return ONLY a valid JSON object, no markdown:
{
  "panel1_question": "...",
  "panel1_photo_prompt": "...",
  "panel2_reveal": "...",
  "panel2_title": "...",
  "panel2_object_prompt": "...",
  "panel3_trigger": "...",
  "panel4_fact": "${facts[0]}",
  "panel4_speech": "...",
  "panel4_scene_prompt": "...",
  "panel5_fact": "${facts[1]}",
  "panel5_speech": "...",
  "panel5_scene_prompt": "...",
  "panel6_fact": "${facts[2]}",
  "panel6_speech": "...",
  "panel6_scene_prompt": "...",
  "panel7_closing": "..."
}`,
      }],
    })

    const textBlock = message.content.find(b => b.type === 'text')
    if (!textBlock) return res.status(500).json({ error: 'No response from AI' })

    const raw = textBlock.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return res.status(500).json({ error: 'AI returned unexpected format', raw: textBlock.text })

    const parsed = JSON.parse(jsonMatch[0])
    console.log(`[generate-comic-panels] Generated panel script for: ${topic}`)
    res.json({ ...parsed, topicId: req.body.topicId })
  } catch (err) {
    console.error('[generate-comic-panels] Error:', err)
    res.status(500).json({ error: String(err) })
  }
})

const PORT = process.env.API_PORT ?? 3001
app.listen(PORT, () => {
  console.log(`[Comics Buddies API] Running on http://localhost:${PORT}`)
})
