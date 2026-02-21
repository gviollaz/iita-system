import { isVideo } from '@/lib/utils'

export function Lightbox({ src, type, onClose }) {
  if (!src) return null
  return (
    <div className="lightbox" onClick={onClose}>
      {isVideo(type) ? <video src={src} controls autoPlay /> : <img src={src} />}
    </div>
  )
}
