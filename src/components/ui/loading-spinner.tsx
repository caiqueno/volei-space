type Props = {
  size?: number
  className?: string
}

export default function LoadingSpinner({ size = 96, className = '' }: Props) {
  return (
    <div
      className={`loading-spinner vs-motion-fade ${className}`}
      style={{ fontSize: size / 16 }}
      role="status"
      aria-label="Carregando"
    >
      <div className="loading-spinner__outer-ring" />
      <div className="loading-spinner__inner-ring" />
      <div className="loading-spinner__track-cover" />
      <div className="loading-spinner__ball">
        <div className="loading-spinner__ball-texture" />
        <div className="loading-spinner__ball-outer-shadow" />
        <div className="loading-spinner__ball-inner-shadow" />
        <div className="loading-spinner__ball-side-shadows" />
      </div>
    </div>
  )
}
