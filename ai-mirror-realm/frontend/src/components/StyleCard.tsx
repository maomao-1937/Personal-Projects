import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import type { MergedStyle } from '@/hooks/useStyles';

interface StyleCardProps {
  style: MergedStyle;
  priority?: boolean;
}

export default function StyleCard({ style, priority = false }: StyleCardProps) {
  return (
    <Link
      href={`/styles/${encodeURIComponent(style.id)}`}
      className="group block rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
      aria-label={`查看${style.name}模板详情`}
    >
      <div className="photo-frame aspect-[3/4]">
        {style.previewImage ? (
          <Image
            src={style.previewImage}
            alt={`${style.name}写真模板预览`}
            fill
            priority={priority}
            sizes="(max-width: 639px) 50vw, (max-width: 1023px) 33vw, 25vw"
            className="object-cover transition-transform duration-300 ease-out group-hover:scale-[1.025]"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-[#e7e3db] px-5 text-center text-sm text-muted">
            暂无预览图
          </div>
        )}
      </div>
      <div className="flex items-start justify-between gap-3 border-b border-line py-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{style.name}</p>
          <p className="mt-0.5 truncate text-sm text-muted">{style.category} · {style.description}</p>
        </div>
        <ArrowUpRight size={17} className="mt-1 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
      </div>
    </Link>
  );
}
