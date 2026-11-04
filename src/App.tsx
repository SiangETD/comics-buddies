import { createContext, useContext, useState } from 'react'
import type { ComicStore } from './store/useComicStore'
import { useComicStore } from './store/useComicStore'
import { useCharacterImages } from './hooks/useCharacterImages'
import LeftSidebar from './components/LeftSidebar'
import ProjectView from './components/views/ProjectView'
import GenerateScriptView from './components/views/GenerateScriptView'
import GenerateComicsView from './components/views/GenerateComicsView'
import ReviewComicsView from './components/views/ReviewComicsView'
import EditComicsView from './components/views/EditComicsView'
import LibraryView from './components/views/LibraryView'
import CreativeGuideView from './components/views/CreativeGuideView'
import styles from './App.module.css'

export type NavItem =
  | 'project'
  | 'generate-script'
  | 'generate-comics'
  | 'review-comics'
  | 'edit-comics'
  | 'library'
  | 'creative-guide'

interface AppState {
  activeNav: NavItem
  setActiveNav: (n: NavItem) => void
  sidebarOpen: boolean
  setSidebarOpen: (v: boolean) => void
  openProjectEdit: boolean
  setOpenProjectEdit: (v: boolean) => void
  isGenerating: boolean
  setIsGenerating: (v: boolean) => void
  editComicsTopicId: string | null
  setEditComicsTopicId: (id: string | null) => void
}

export type CharImageStore = ReturnType<typeof useCharacterImages>

export const StoreContext = createContext<ComicStore | null>(null)
export const AppContext = createContext<AppState | null>(null)
export const CharImageContext = createContext<CharImageStore | null>(null)

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore outside StoreContext')
  return ctx
}
export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp outside AppContext')
  return ctx
}
export function useCharImages() {
  const ctx = useContext(CharImageContext)
  if (!ctx) throw new Error('useCharImages outside CharImageContext')
  return ctx
}

export default function App() {
  const store = useComicStore()
  const charImages = useCharacterImages()
  const [activeNav, setActiveNav] = useState<NavItem>('project')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [openProjectEdit, setOpenProjectEdit] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [editComicsTopicId, setEditComicsTopicId] = useState<string | null>(null)

  const appState: AppState = { activeNav, setActiveNav, sidebarOpen, setSidebarOpen, openProjectEdit, setOpenProjectEdit, isGenerating, setIsGenerating, editComicsTopicId, setEditComicsTopicId }

  return (
    <StoreContext.Provider value={store}>
      <AppContext.Provider value={appState}>
        <CharImageContext.Provider value={charImages}>
          <div className={styles.appShell}>
            <LeftSidebar />
            <main className={styles.main}>
              {activeNav === 'project'         && <ProjectView />}
              {activeNav === 'generate-script' && <GenerateScriptView />}
              {activeNav === 'generate-comics' && <GenerateComicsView />}
              {activeNav === 'review-comics'   && <ReviewComicsView />}
              {activeNav === 'edit-comics'     && <EditComicsView />}
              {activeNav === 'library'         && <LibraryView />}
              {activeNav === 'creative-guide'  && <CreativeGuideView />}
            </main>
          </div>
        </CharImageContext.Provider>
      </AppContext.Provider>
    </StoreContext.Provider>
  )
}
