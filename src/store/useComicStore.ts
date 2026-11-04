import { useState, useCallback, useEffect, useRef } from 'react'
import type {
  ComicProject,
  ComicIdea,
  ComicPanelScript,
  CreatedComic,
  ComicPage,
  Panel,
  ComicElement,
  CharacterElement,
  SpeechBubbleElement,
  ObjectElement,
} from '../types'
import { saveProject } from '../services/api'

const LS_KEY = 'cb_active_project'

function loadFromStorage(): ComicProject | null {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveToStorage(p: ComicProject | null) {
  try {
    if (p) localStorage.setItem(LS_KEY, JSON.stringify(p))
    else localStorage.removeItem(LS_KEY)
  } catch {}
}

export type SelectionType = { pageIdx: number; panelId: string; elementId: string } | null

export function useComicStore() {
  const [project, setProject] = useState<ComicProject | null>(loadFromStorage)
  const [currentPageIdx, setCurrentPageIdx] = useState(0)
  const [selection, setSelection] = useState<SelectionType>(null)

  // Debounced server save
  const serverSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function persistProject(p: ComicProject | null) {
    saveToStorage(p)
    if (!p) return
    if (serverSaveTimer.current) clearTimeout(serverSaveTimer.current)
    serverSaveTimer.current = setTimeout(() => {
      saveProject(p.project_id, p)
    }, 1500)
  }

  const loadProject = useCallback((p: ComicProject) => {
    setProject(p)
    setCurrentPageIdx(0)
    setSelection(null)
    persistProject(p)
  }, [])

  const updateElement = useCallback(
    (pageIdx: number, panelId: string, elementId: string, updates: Partial<ComicElement>) => {
      setProject(prev => {
        if (!prev) return prev
        const pages = prev.pages.map((pg, pIdx) => {
          if (pIdx !== pageIdx) return pg
          return {
            ...pg,
            panels: pg.panels.map(panel => {
              if (panel.id !== panelId) return panel
              return {
                ...panel,
                elements: panel.elements.map(el =>
                  el.id === elementId ? ({ ...el, ...updates } as ComicElement) : el,
                ),
              }
            }),
          }
        })
        const next = { ...prev, pages, updated_at: new Date().toISOString() }
        persistProject(next)
        return next
      })
    },
    [],
  )

  const deleteElement = useCallback((pageIdx: number, panelId: string, elementId: string) => {
    setProject(prev => {
      if (!prev) return prev
      const pages = prev.pages.map((pg, pIdx) => {
        if (pIdx !== pageIdx) return pg
        return {
          ...pg,
          panels: pg.panels.map(panel => {
            if (panel.id !== panelId) return panel
            return { ...panel, elements: panel.elements.filter(el => el.id !== elementId) }
          }),
        }
      })
      const next = { ...prev, pages }
      persistProject(next)
      return next
    })
    setSelection(null)
  }, [])

  const addElement = useCallback(
    (pageIdx: number, panelId: string, element: ComicElement) => {
      setProject(prev => {
        if (!prev) return prev
        const pages = prev.pages.map((pg, pIdx) => {
          if (pIdx !== pageIdx) return pg
          return {
            ...pg,
            panels: pg.panels.map(panel => {
              if (panel.id !== panelId) return panel
              return { ...panel, elements: [...panel.elements, element] }
            }),
          }
        })
        const next = { ...prev, pages }
        persistProject(next)
        return next
      })
    },
    [],
  )

  const updatePanelBackground = useCallback(
    (pageIdx: number, panelId: string, backgroundId: string) => {
      setProject(prev => {
        if (!prev) return prev
        const pages = prev.pages.map((pg, pIdx) => {
          if (pIdx !== pageIdx) return pg
          return {
            ...pg,
            panels: pg.panels.map(panel =>
              panel.id === panelId ? { ...panel, background_id: backgroundId } : panel,
            ),
          }
        })
        const next = { ...prev, pages }
        persistProject(next)
        return next
      })
    },
    [],
  )

  const getSelectedElement = useCallback((): ComicElement | null => {
    if (!project || !selection) return null
    const page = project.pages[selection.pageIdx]
    if (!page) return null
    const panel = page.panels.find(p => p.id === selection.panelId)
    if (!panel) return null
    return panel.elements.find(el => el.id === selection.elementId) ?? null
  }, [project, selection])

  const getSelectedPanel = useCallback((): Panel | null => {
    if (!project || !selection) return null
    const page = project.pages[selection.pageIdx]
    if (!page) return null
    return page.panels.find(p => p.id === selection.panelId) ?? null
  }, [project, selection])

  const setProjectScripts = useCallback((scripts: ComicIdea[]) => {
    setProject(prev => {
      if (!prev) return prev
      const next = { ...prev, scripts, updated_at: new Date().toISOString() }
      persistProject(next)
      return next
    })
  }, [])

  const setCreatedComic = useCallback((topicId: string, comic: CreatedComic) => {
    setProject(prev => {
      if (!prev) return prev
      const next = {
        ...prev,
        createdComics: { ...(prev.createdComics ?? {}), [topicId]: comic },
        updated_at: new Date().toISOString(),
      }
      persistProject(next)
      return next
    })
  }, [])

  const setProjectPanel = useCallback((topicId: string, panel: ComicPanelScript) => {
    setProject(prev => {
      if (!prev) return prev
      const next = {
        ...prev,
        panels: { ...(prev.panels ?? {}), [topicId]: panel },
        updated_at: new Date().toISOString(),
      }
      persistProject(next)
      return next
    })
  }, [])

  const closeProject = useCallback(() => {
    setProject(null)
    setCurrentPageIdx(0)
    setSelection(null)
    saveToStorage(null)
  }, [])

  const currentPage: ComicPage | null = project?.pages[currentPageIdx] ?? null

  return {
    project,
    setProject,
    currentPageIdx,
    setCurrentPageIdx,
    selection,
    setSelection,
    loadProject,
    setProjectScripts,
    setProjectPanel,
    setCreatedComic,
    closeProject,
    updateElement,
    deleteElement,
    addElement,
    updatePanelBackground,
    getSelectedElement,
    getSelectedPanel,
    currentPage,
  }
}

export type ComicStore = ReturnType<typeof useComicStore>
