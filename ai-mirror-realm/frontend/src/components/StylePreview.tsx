import Image from 'next/image';

interface StylePreviewProps {
  src: string;
  alt: string;
  fill?: boolean;
  sizes?: string;
  className?: string;
}

const SHEETS = {
  career: { width: 1086, height: 1448, columns: [0, 272, 543, 815, 1086], rows: [0, 483, 965, 1448] },
  women: { width: 1086, height: 1448, columns: [0, 272, 543, 815, 1086], rows: [0, 483, 965, 1448] },
  creative: { width: 1254, height: 1254, columns: [0, 314, 627, 941, 1254], rows: [0, 416, 832, 1254] },
  family: { width: 1254, height: 1254, columns: [0, 314, 627, 941, 1254], rows: [0, 418, 836, 1254] },
} as const;

/** Show one contact-sheet cell at its native proportions, cropping to the card. */
export function StylePreview({ src, alt, fill = true, sizes, className = '' }: StylePreviewProps) {
  const match = /^catalog:(career|women|creative|family):(\d{1,2})$/.exec(src);
  if (!match) {
    return <Image src={src} alt={alt} fill={fill} sizes={sizes} className={className} />;
  }

  const tile = Number(match[2]);
  if (tile > 11) return null;
  const sheet = match[1] as keyof typeof SHEETS;
  const { width, height, columns, rows } = SHEETS[sheet];
  const column = tile % 4;
  const row = Math.floor(tile / 4);
  // Generated contact sheets have slightly uneven seams. Exclude their edge pixels.
  const x = columns[column] + 1;
  const y = rows[row] + 1;
  const tileWidth = columns[column + 1] - columns[column] - 2;
  const tileHeight = rows[row + 1] - rows[row] - 2;
  return (
    <svg
      role={alt ? 'img' : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      className={`absolute inset-0 h-full w-full overflow-hidden ${className}`}
      viewBox={`0 0 ${tileWidth} ${tileHeight}`}
      preserveAspectRatio="xMidYMid slice"
    >
      <image
        href={`/catalog-sheets/${sheet}.png`}
        x={-x}
        y={-y}
        width={width}
        height={height}
        preserveAspectRatio="none"
      />
    </svg>
  );
}
