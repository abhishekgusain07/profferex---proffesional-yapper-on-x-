import { motion } from 'framer-motion'

export const AnimatedLogo = ({ animate }: { animate?: boolean }) => {
  return (
    <div className="size-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-sm">
      <motion.svg
        className="size-4 text-white"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        animate={animate ? { rotate: 360 } : {}}
        transition={{
          duration: 2,
          repeat: animate ? Infinity : 0,
          ease: 'linear',
        }}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
        />
      </motion.svg>
    </div>
  )
}