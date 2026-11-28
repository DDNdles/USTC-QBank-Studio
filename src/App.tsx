import { useEffect, useState } from 'react'
import { MotionConfig, AnimatePresence, motion } from 'framer-motion'
import { StudyProvider, useStudy } from './context/StudyContext'
import { NavigationShell } from './components/NavigationShell'
import { OpticalGlassDefs } from './components/OpticalGlassDefs'
import { FeedbackModal } from './components/FeedbackModal'
import { CommandPalette } from './components/CommandPalette'
import { HomeView } from './views/HomeView'
import { BankView } from './views/BankView'
import { PaperStudioView } from './views/PaperStudioView'
import { PptStudioView } from './views/PptStudioView'
import { SourcesView } from './views/SourcesView'
import type { QuestionRecord } from './types/study'

function StudioShell() {
  const { activeTab, toast } = useStudy()
  const [feedbackTarget, setFeedbackTarget] = useState<{
    source_id: string
    question: QuestionRecord
  } | null>(null)
  const [commandOpen, setCommandOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCommandOpen(v => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="min-h-dvh bg-[var(--bg-canvas)] text-[var(--ink-primary)] transition-colors duration-300">
      <OpticalGlassDefs />
      <NavigationShell onOpenCommand={() => setCommandOpen(true)} />

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          {activeTab === 'home' && <HomeView />}
          {activeTab === 'bank' && <BankView onOpenFeedback={setFeedbackTarget} />}
          {activeTab === 'paper' && <PaperStudioView />}
          {activeTab === 'ppt' && <PptStudioView />}
          {activeTab === 'sources' && <SourcesView />}
        </motion.div>
      </AnimatePresence>

      <FeedbackModal target={feedbackTarget} onClose={() => setFeedbackTarget(null)} />
      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} />

      {/* Editorial Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.96 }}
            className="no-print fixed top-16 left-1/2 -translate-x-1/2 z-50 max-w-[92vw]"
          >
            <div
              className={`glass-pill-optical rounded-full px-4 py-2 text-xs font-medium ${
                toast.tone === 'error'
                  ? 'glass-pill-error'
                  : toast.tone === 'success'
                    ? 'glass-pill-success'
                    : ''
              }`}
            >
              {toast.text}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function App() {
  return (
    <MotionConfig reducedMotion="user">
      <StudyProvider>
        <StudioShell />
      </StudyProvider>
    </MotionConfig>
  )
}

export default App
