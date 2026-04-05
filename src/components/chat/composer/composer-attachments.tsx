import { memo, useState } from 'react'
import Image from 'next/image'
import { AppIconButton } from '@/components/common/app-button'
import { ImagePreviewDialog } from '@/components/common/image-preview-dialog'
import { type UploadedImage } from '@/lib/chat-attachments'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'

interface ComposerAttachmentsProps {
  uploadedImages: UploadedImage[]
  onRemoveImage: (id: string) => void
  onImagePreviewError: (imageId: string, url: string) => void
}

type RemoveAttachmentButtonProps = {
  className: string
  label: string
  onClick: () => void
}

function RemoveAttachmentButton({
  className,
  label,
  onClick
}: RemoveAttachmentButtonProps): React.JSX.Element {
  return (
    <AppIconButton
      type="button"
      variant="ghost"
      size="icon-sm"
      touch={false}
      mutedDisabled={false}
      onClick={onClick}
      className={cn(
        'bg-destructive/90 text-destructive-foreground hover:bg-destructive/90 rounded-full shadow-sm',
        className
      )}
      aria-label={label}
    >
      <X aria-hidden="true" />
    </AppIconButton>
  )
}

export const ComposerAttachments = memo(function ComposerAttachments({
  uploadedImages,
  onRemoveImage,
  onImagePreviewError
}: ComposerAttachmentsProps): React.JSX.Element {
  const [previewImage, setPreviewImage] = useState<{ src: string; alt: string } | null>(null)

  return (
    <>
      <div className="flex flex-wrap gap-2 px-4 pt-3">
        {uploadedImages.map((img) => (
          <div key={img.id} className="group relative size-20">
            <button
              type="button"
              className="focus-visible:ring-ring/60 focus-visible:ring-offset-background relative block size-full rounded-xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              aria-label="Open image preview"
              onClick={() => setPreviewImage({ src: img.url, alt: img.name || 'Upload preview' })}
            >
              <Image
                src={img.url}
                alt={img.name || 'Upload preview'}
                fill
                unoptimized
                sizes="80px"
                className="border-border/50 rounded-xl border object-cover shadow-sm transition-opacity group-hover:opacity-95"
                onError={() => onImagePreviewError(img.id, img.url)}
              />
            </button>
            <RemoveAttachmentButton
              onClick={() => onRemoveImage(img.id)}
              className="absolute -top-1.5 -right-1.5 size-11 opacity-100 transition-opacity duration-200 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
              label="Remove image"
            />
          </div>
        ))}
      </div>
      {previewImage && (
        <ImagePreviewDialog
          open
          onOpenChange={() => setPreviewImage(null)}
          src={previewImage.src}
          alt={previewImage.alt}
        />
      )}
    </>
  )
})
