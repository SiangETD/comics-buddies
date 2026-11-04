import { useStore } from '../App'
import styles from './PagesThumbnailPanel.module.css'

const PAGE_TYPE_LABELS: Record<string, string> = {
  introduction_question: 'Introduction',
  problem_misunderstanding: 'Problem',
  explanation: 'Explanation',
  example_consequence: 'Example',
  singapore_context: 'Singapore',
  ending_reflection: 'Ending',
}

const PAGE_TYPE_COLORS: Record<string, string> = {
  introduction_question: '#4ade80',
  problem_misunderstanding: '#f87171',
  explanation: '#60a5fa',
  example_consequence: '#fb923c',
  singapore_context: '#e94560',
  ending_reflection: '#a78bfa',
}

export default function PagesThumbnailPanel() {
  const store = useStore()
  if (!store.project) return <div className={styles.panel} />

  return (
    <div className={styles.panel}>
      <div className={styles.header}>Pages</div>
      <div className={styles.list}>
        {store.project.pages.map((page, idx) => {
          const color = PAGE_TYPE_COLORS[page.page_type] ?? '#888'
          const label = PAGE_TYPE_LABELS[page.page_type] ?? `Page ${page.page_number}`
          const active = store.currentPageIdx === idx
          return (
            <button
              key={page.page_number}
              className={`${styles.thumb} ${active ? styles.active : ''}`}
              onClick={() => {
                store.setCurrentPageIdx(idx)
                store.setSelection(null)
              }}
            >
              <div className={styles.thumbCanvas} style={{ borderColor: active ? color : 'transparent' }}>
                <div className={styles.thumbGrid}>
                  {page.panels.map(p => (
                    <div key={p.id} className={styles.thumbPanel} style={{ background: color + '22' }}>
                      <div className={styles.thumbPanelDot} style={{ background: color }} />
                    </div>
                  ))}
                </div>
                <div className={styles.thumbNum} style={{ background: color }}>{page.page_number}</div>
              </div>
              <div className={styles.thumbLabel} style={{ color: active ? color : undefined }}>{label}</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
