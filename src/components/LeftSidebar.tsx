import { useApp, useStore } from '../App'
import type { NavItem } from '../App'
import styles from './LeftSidebar.module.css'

const TOP_NAV: { id: NavItem; icon: string; label: string }[] = [
  { id: 'project',         icon: '📁', label: 'Project' },
  { id: 'generate-script', icon: '📝', label: 'Generate Topics' },
  { id: 'generate-comics', icon: '🎬', label: 'Generate Comics' },
  { id: 'review-comics',   icon: '📋', label: 'Review Script' },
  { id: 'edit-comics',     icon: '✏️',  label: 'Edit Comics' },
]

const BOTTOM_NAV: { id: NavItem; icon: string; label: string }[] = [
  { id: 'creative-guide', icon: '🎨', label: 'Creative Guide' },
  { id: 'library',        icon: '🗂️', label: 'Library' },
]

export default function LeftSidebar() {
  const { activeNav, setActiveNav, sidebarOpen, setSidebarOpen, setOpenProjectEdit, isGenerating } = useApp()
  const store = useStore()
  const hasProject = !!store.project
  const hasScripts = (store.project?.scripts?.length ?? 0) > 0
  const hasPanels = Object.keys(store.project?.panels ?? {}).length > 0
  const hasCreatedComics = Object.keys(store.project?.createdComics ?? {}).length > 0

  function isDisabled(id: NavItem) {
    if (isGenerating && id !== activeNav) return true
    if (!hasProject && id === 'generate-script') return true
    if (!hasProject && id === 'generate-comics') return true
    if (!hasProject && id === 'review-comics') return true
    if (!hasProject && id === 'edit-comics') return true
    if (!hasScripts && id === 'generate-comics') return true
    if (!hasPanels && id === 'review-comics') return true
    if (!hasCreatedComics && id === 'edit-comics') return true
    return false
  }

  function NavButton({ item }: { item: { id: NavItem; icon: string; label: string } }) {
    const active = activeNav === item.id
    const disabled = isDisabled(item.id)
    const showSpinner = isGenerating && (item.id === 'generate-script' || item.id === 'generate-comics')
    return (
      <button
        key={item.id}
        className={`${styles.navItem} ${active ? styles.navActive : ''} ${disabled ? styles.navDisabled : ''}`}
        onClick={() => !disabled && setActiveNav(item.id)}
        title={!sidebarOpen ? item.label : undefined}
      >
        {showSpinner
          ? <span className={styles.navSpinner} />
          : <span className={styles.navIcon}>{item.icon}</span>
        }
        {sidebarOpen && <span className={styles.navLabel}>{item.label}</span>}
      </button>
    )
  }

  return (
    <aside className={`${styles.sidebar} ${sidebarOpen ? styles.open : styles.closed}`}>

      {/* ── Logo / toggle ── */}
      <button className={styles.logoBar} onClick={() => setSidebarOpen(!sidebarOpen)}>
        <img src="/logo.png" alt="Logo" className={styles.logoImg} />
        {sidebarOpen && <span className={styles.logoLabel}>Comics Buddies</span>}
      </button>

      {/* ── Active project pill ── */}
      {sidebarOpen && hasProject && (
        <button className={styles.projectPill} onClick={() => { setActiveNav('project'); setOpenProjectEdit(true) }}>
          <span className={styles.projectPillLabel}>Active project ✏️</span>
          <span className={styles.projectPillName}>{store.project!.title}</span>
        </button>
      )}

      {/* ── Top nav ── */}
      <nav className={styles.nav}>
        <div className={styles.divider} />
        {TOP_NAV.map(item => <NavButton key={item.id} item={item} />)}
      </nav>

      {/* ── Bottom nav ── */}
      <nav className={styles.navBottom}>
        <div className={styles.divider} />
        {BOTTOM_NAV.map(item => <NavButton key={item.id} item={item} />)}
      </nav>

      {sidebarOpen && (
        <img src="/yummy-buddies.png" alt="Yummy Buddies" className={styles.ybFooter} />
      )}
    </aside>
  )
}
