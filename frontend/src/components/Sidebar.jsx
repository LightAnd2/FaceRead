import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const SECTIONS = [
  {
    label: 'Face',
    modes: [
      { id: 'emotion',   name: 'Emotion Analytics' },
      { id: 'age',       name: 'Age Progression'    },
      { id: 'swap',      name: 'Face Swap'          },
      { id: 'filters',   name: 'Face Filters'       },
      { id: 'avatar',    name: 'Avatar Mode'        },
    ],
  },
  {
    label: 'Gesture',
    modes: [
      { id: 'asl',       name: 'ASL Recognition'   },
      { id: 'eye',       name: 'Eye Tracking'       },
      { id: 'gesture',   name: 'Gesture Control'    },
    ],
  },
  {
    label: 'Audio',
    modes: [
      { id: 'voice',     name: 'Voice Emotion'      },
      { id: 'music',     name: 'Music Recognition'  },
    ],
  },
  {
    label: 'Productivity',
    modes: [
      { id: 'interview', name: 'Interview Coach'    },
      { id: 'fatigue',   name: 'Fatigue Detection'  },
      { id: 'bg',        name: 'Background Replace' },
    ],
  },
];

export default function Sidebar({ activeMode, onModeSelect }) {
  const navigate   = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <motion.div
      animate={{ width: collapsed ? 44 : 200 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="h-full flex flex-col shrink-0 overflow-hidden"
      style={{ background: '#000', zIndex: 2, position: 'relative' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-4 pb-3 shrink-0">
        <AnimatePresence>
          {!collapsed && (
            <motion.button
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => navigate('/')}
              className="font-bold text-sm tracking-tight hover:opacity-60 transition-opacity"
              style={{ color: '#006FFF', whiteSpace: 'nowrap' }}
            >
              Perceive
            </motion.button>
          )}
        </AnimatePresence>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center justify-center rounded transition-colors shrink-0"
          style={{
            width: 28, height: 28,
            color: 'rgba(255,255,255,0.2)',
            marginLeft: collapsed ? 'auto' : 0,
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.6)'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.2)'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            {collapsed ? (
              // chevron right (expand)
              <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            ) : (
              // chevron left (collapse)
              <path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            )}
          </svg>
        </button>
      </div>

      {/* Mode list */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex-1 overflow-y-auto no-scrollbar px-3"
          >
            {SECTIONS.map((section) => (
              <div key={section.label} className="mb-4">
                <div className="px-2 mb-1 text-[9px] font-semibold uppercase tracking-widest"
                  style={{ color: 'rgba(255,255,255,0.14)' }}>
                  {section.label}
                </div>
                {section.modes.map((mode) => {
                  const isActive = mode.id === activeMode;
                  return (
                    <button
                      key={mode.id}
                      onClick={() => onModeSelect(mode.id)}
                      className="w-full flex items-center px-2 py-2 rounded-lg text-left relative transition-all"
                      style={{
                        background: isActive ? 'rgba(0,111,255,0.08)' : 'transparent',
                        marginBottom: 1,
                      }}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="active-bar"
                          className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r"
                          style={{ background: '#006FFF' }}
                        />
                      )}
                      <span
                        className="text-[12.5px] truncate"
                        style={{
                          color: isActive ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.28)',
                          fontWeight: isActive ? 500 : 400,
                        }}
                      >
                        {mode.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="py-3 shrink-0" />
    </motion.div>
  );
}
