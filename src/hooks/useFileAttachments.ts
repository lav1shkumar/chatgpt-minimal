import { useCallback, useRef, useState, type SetStateAction } from 'react'
import { MAX_IMAGE_SIZE } from '@/lib/chat-attachment-shared'
import {
  convertImageToSupportedFormat,
  createUploadedImage,
  getImageMimeType,
  isImageFile,
  readFileAsDataUrl,
  type UploadedImage
} from '@/lib/chat-attachments'
import { formatSizeInMB } from '@/lib/size'
import { toast } from 'sonner'

const MAX_IMAGE_SIZE_LABEL = formatSizeInMB(MAX_IMAGE_SIZE)

interface UseFileAttachmentsReturn {
  uploadedImages: UploadedImage[]
  fileInputRef: React.RefObject<HTMLInputElement | null>
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>
  handlePaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void
  handleImagePreviewError: (imageId: string, url: string) => void
  removeImage: (id: string) => void
  resetAttachments: () => void
  restoreAttachments: (images: UploadedImage[]) => void
  hasAttachments: boolean
  hasCurrentAttachments: () => boolean
}

export function useFileAttachments(): UseFileAttachmentsReturn {
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([])

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const failedPreviewIdsRef = useRef<Set<string>>(new Set())
  const uploadedImagesRef = useRef<UploadedImage[]>([])

  const updateUploadedImages = useCallback((nextState: SetStateAction<UploadedImage[]>) => {
    setUploadedImages((currentImages) => {
      const nextImages = typeof nextState === 'function' ? nextState(currentImages) : nextState

      uploadedImagesRef.current = nextImages

      const currentImageIds = new Set(nextImages.map(({ id }) => id))
      for (const id of failedPreviewIdsRef.current) {
        if (!currentImageIds.has(id)) {
          failedPreviewIdsRef.current.delete(id)
        }
      }

      return nextImages
    })
  }, [])

  const convertImageFile = useCallback(async (file: File): Promise<UploadedImage | null> => {
    try {
      const dataUrl = await readFileAsDataUrl(file)
      const converted = await convertImageToSupportedFormat(dataUrl, getImageMimeType(file))
      return createUploadedImage({
        url: converted.url,
        mimeType: converted.mimeType,
        name: file.name || undefined
      })
    } catch (error) {
      console.error('Error reading file:', error)
      toast.error(
        file.name
          ? `Unsupported image format: ${file.name}. Supported: JPEG, PNG, GIF, WebP`
          : 'Unsupported image format. Supported: JPEG, PNG, GIF, WebP'
      )
      return null
    }
  }, [])

  const addConvertedImages = useCallback(
    async (conversions: Array<Promise<UploadedImage | null>>) => {
      if (conversions.length === 0) {
        return
      }

      const results = await Promise.all(conversions)
      const successful = results.filter((image): image is UploadedImage => image !== null)
      if (successful.length > 0) {
        updateUploadedImages((prev) => [...prev, ...successful])
      }
    },
    [updateUploadedImages]
  )

  const queueImageConversion = useCallback(
    (file: File, conversions: Array<Promise<UploadedImage | null>>, source: 'upload' | 'paste') => {
      if (file.size > MAX_IMAGE_SIZE) {
        if (source === 'upload') {
          toast.error(`Image too large: ${file.name}. Maximum size is ${MAX_IMAGE_SIZE_LABEL}.`)
        } else {
          toast.error(`Image too large to paste. Maximum size is ${MAX_IMAGE_SIZE_LABEL}.`)
        }
        return
      }

      conversions.push(convertImageFile(file))
    },
    [convertImageFile]
  )

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (!files || files.length === 0) return

      const imageConversions: Array<Promise<UploadedImage | null>> = []

      for (const file of files) {
        if (!isImageFile(file)) {
          toast.error(`Unsupported file type: ${file.name}. Only images are supported.`)
          continue
        }

        queueImageConversion(file, imageConversions, 'upload')
      }

      await addConvertedImages(imageConversions)

      const fileInput = fileInputRef.current
      if (fileInput) {
        fileInput.value = ''
      }
    },
    [addConvertedImages, queueImageConversion]
  )

  const removeImage = useCallback(
    (id: string) => {
      updateUploadedImages((prev) => prev.filter((image) => image.id !== id))
    },
    [updateUploadedImages]
  )

  const handleImagePreviewError = useCallback(
    (id: string, url: string) => {
      const currentImage = uploadedImagesRef.current.find((image) => image.id === id)
      if (!currentImage || currentImage.url !== url || failedPreviewIdsRef.current.has(id)) {
        return
      }

      failedPreviewIdsRef.current.add(id)
      updateUploadedImages((prev) => {
        const imageToRemove = prev.find((image) => image.id === id)
        if (!imageToRemove || imageToRemove.url !== url) {
          return prev
        }

        return prev.filter((image) => image.id !== id)
      })
      toast.error('Failed to load the image preview. Try uploading it again.')
    },
    [updateUploadedImages]
  )

  const handlePaste = useCallback(
    (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = event.clipboardData?.items
      if (!items) return

      const pastedImageConversions: Array<Promise<UploadedImage | null>> = []
      let hasPastedImage = false
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (!item?.type?.startsWith('image/')) continue

        const file = item.getAsFile()
        if (!file) continue

        hasPastedImage = true
        queueImageConversion(file, pastedImageConversions, 'paste')
      }

      if (!hasPastedImage) {
        return
      }

      event.preventDefault()
      void addConvertedImages(pastedImageConversions)
    },
    [addConvertedImages, queueImageConversion]
  )

  const resetAttachments = useCallback(() => {
    updateUploadedImages([])
  }, [updateUploadedImages])

  const restoreAttachments = updateUploadedImages

  const hasAttachments = uploadedImages.length > 0

  const hasCurrentAttachments = useCallback(() => uploadedImagesRef.current.length > 0, [])

  return {
    uploadedImages,
    fileInputRef,
    handleFileUpload,
    handlePaste,
    handleImagePreviewError,
    removeImage,
    resetAttachments,
    restoreAttachments,
    hasAttachments,
    hasCurrentAttachments
  }
}
