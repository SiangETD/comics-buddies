// All calls proxy through Vite → Express on port 3001

export async function saveAsset(assetPath: string, dataUrl: string): Promise<boolean> {
  try {
    const res = await fetch('/api/save-asset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetPath, dataUrl }),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function saveProject(projectId: string, data: unknown): Promise<boolean> {
  try {
    const res = await fetch('/api/save-project', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, data }),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function listProjects(): Promise<{ project_id: string; title: string; updated_at: string; file: string }[]> {
  try {
    const res = await fetch('/api/list-projects')
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

export async function loadProjectFromServer(projectId: string): Promise<unknown | null> {
  try {
    const res = await fetch(`/api/load-project/${projectId}`)
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export async function generateScripts(
  rawText: string,
  opts: { subject?: string; level?: string; extraInstructions?: string } = {},
): Promise<{ topic: string; objectives: string; facts: [string, string, string] }[]> {
  const res = await fetch('/api/generate-scripts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rawText, subject: opts.subject, level: opts.level, extraInstructions: opts.extraInstructions }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? 'Script generation failed')
  }
  const data = await res.json()
  return data.ideas ?? []
}

export async function deleteProjectFromServer(projectId: string): Promise<void> {
  try {
    await fetch(`/api/projects/${projectId}`, { method: 'DELETE' })
  } catch {}
}
