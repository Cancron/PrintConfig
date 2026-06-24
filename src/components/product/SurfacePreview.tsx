import type { ProductSurface } from '../../types';

interface Props {
  surface: ProductSurface;
  size?: number;
}

export function SurfacePreview({ surface, size = 200 }: Props) {
  const { width, height, dpi, bleed, safeArea, backgroundColor, allowTransparency } = surface;

  // Calculate pixel dimensions
  const widthPx = width * dpi;
  const heightPx = height * dpi;
  const bleedTopPx = bleed.top * dpi;
  const bleedRightPx = bleed.right * dpi;
  const bleedBottomPx = bleed.bottom * dpi;
  const bleedLeftPx = bleed.left * dpi;
  const safeTopPx = safeArea.top * dpi;
  const safeRightPx = safeArea.right * dpi;
  const safeBottomPx = safeArea.bottom * dpi;
  const safeLeftPx = safeArea.left * dpi;

  const totalWidthPx = widthPx + bleedLeftPx + bleedRightPx;
  const totalHeightPx = heightPx + bleedTopPx + bleedBottomPx;

  // Scale to fit within the preview box
  const scale = Math.min(size / totalWidthPx, size / totalHeightPx);

  const previewW = totalWidthPx * scale;
  const previewH = totalHeightPx * scale;

  const bleedLeftS = bleedLeftPx * scale;
  const bleedTopS = bleedTopPx * scale;
  const bleedRightS = bleedRightPx * scale;
  const bleedBottomS = bleedBottomPx * scale;

  const safeLeftS = safeLeftPx * scale;
  const safeTopS = safeTopPx * scale;
  const safeRightS = safeRightPx * scale;
  const safeBottomS = safeBottomPx * scale;

  const trimW = previewW - bleedLeftS - bleedRightS;
  const trimH = previewH - bleedTopS - bleedBottomS;

  const safeW = trimW - safeLeftS - safeRightS;
  const safeH = trimH - safeTopS - safeBottomS;

  return (
    <div className="flex flex-col items-center gap-2">
      <svg
        width={previewW}
        height={previewH}
        viewBox={`0 0 ${previewW} ${previewH}`}
        className="rounded-sm"
        style={{ backgroundColor: '#f3f4f6' }}
      >
        {/* Background (bleed area) */}
        <rect
          x={0}
          y={0}
          width={previewW}
          height={previewH}
          fill={allowTransparency ? '#e5e7eb' : backgroundColor}
          opacity={allowTransparency ? 0.5 : 1}
        />
        {/* Transparent checkered pattern if allowed */}
        {allowTransparency && (
          <>
            <defs>
              <pattern id={`checker-${surface.id}`} width="8" height="8" patternUnits="userSpaceOnUse">
                <rect width="8" height="8" fill="#e5e7eb" />
                <rect width="4" height="4" fill="#d1d5db" />
                <rect x="4" y="4" width="4" height="4" fill="#d1d5db" />
              </pattern>
            </defs>
            <rect
              x={0}
              y={0}
              width={previewW}
              height={previewH}
              fill={`url(#checker-${surface.id})`}
            />
          </>
        )}

        {/* Trim area fill */}
        <rect
          x={bleedLeftS}
          y={bleedTopS}
          width={trimW}
          height={trimH}
          fill={allowTransparency ? 'url(#checker-' + surface.id + ')' : backgroundColor}
          opacity={allowTransparency ? 0.8 : 1}
        />

        {/* Bleed border (outer dashed) */}
        <rect
          x={0.5}
          y={0.5}
          width={previewW - 1}
          height={previewH - 1}
          fill="none"
          stroke="#ef4444"
          strokeWidth={1}
          strokeDasharray="4 3"
          opacity={0.7}
        />

        {/* Trim border (solid) */}
        <rect
          x={bleedLeftS + 0.5}
          y={bleedTopS + 0.5}
          width={trimW - 1}
          height={trimH - 1}
          fill="none"
          stroke="#10b981"
          strokeWidth={1}
        />

        {/* Safe area border (inner dashed) */}
        {safeW > 0 && safeH > 0 && (
          <rect
            x={bleedLeftS + safeLeftS + 0.5}
            y={bleedTopS + safeTopS + 0.5}
            width={safeW - 1}
            height={safeH - 1}
            fill="none"
            stroke="#3b82f6"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 border border-red-400 border-dashed rounded-sm" />
          Bleed
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 border border-emerald-500 rounded-sm" />
          Trim
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 border border-blue-500 border-dashed rounded-sm" />
          Safe
        </span>
      </div>
    </div>
  );
}
