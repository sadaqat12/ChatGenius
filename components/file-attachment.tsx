import Image from 'next/image'
import { FileIcon, DownloadIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface FileAttachmentProps {
  file: {
    name: string
    type: string
    url: string
  }
}

export function FileAttachment({ file }: FileAttachmentProps) {
  const isImage = file.type.startsWith('image/')

  if (isImage) {
    return (
      <div className="mt-2">
        <Image
          src={file.url}
          alt={file.name}
          width={300}
          height={200}
          className="rounded-md object-cover"
        />
      </div>
    )
  }

  return (
    <div className="mt-2 flex items-center space-x-2">
      <FileIcon className="h-5 w-5 text-blue-500" />
      <a
        href={file.url}
        download={file.name}
        className="text-blue-500 hover:underline"
      >
        {file.name}
      </a>
      <Button variant="ghost" size="sm" className="ml-2" asChild>
        <a href={file.url} download={file.name}>
          <DownloadIcon className="h-4 w-4" />
        </a>
      </Button>
    </div>
  )
}

