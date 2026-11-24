import type { ProductSurface, ProductVariant } from '../../types';
import { toPixels } from '../../lib/validation';

interface Props {
  surface: ProductSurface | null;
  variant: Pick<ProductVariant, '_id' | 'width' | 'height' | 'unit' | 'dpi'>;
  size?: number;
  showLegend?: boolean;
}

export function SurfacePreview({ surface, variant, size = 200, showLegend = true }: Props) {
  const bleed = surface?.bleed ?? { top: 0, right: 0, bottom: 0, left: 0, unit: variant.unit };
  const safeArea = surface?.safeArea ?? { top: 0, right: 0, bottom: 0, left: 0, unit: variant.unit };
  const backgroundColor = surface?.backgroundColor ?? '#ffffff';
  const allowTransparency = surface?.allowTransparency ?? false;

  const widthPx = toPixels(variant.width, variant.unit, variant.dpi);
  const heightPx = toPixels(variant.height, variant.unit, variant.dpi);
  const bleedTopPx = toPixels(bleed.top, bleed.unit, variant.dpi);
  const bleedRightPx = toPixels(bleed.right, bleed.unit, variant.dpi);
  const bleedBottomPx = toPixels(bleed.bottom, bleed.unit, variant.dpi);
  const bleedLeftPx = toPixels(bleed.left, bleed.unit, variant.dpi);
  const safeTopPx = toPixels(safeArea.top, safeArea.unit, variant.dpi);
  const safeRightPx = toPixels(safeArea.right, safeArea.unit, variant.dpi);
  const safeBottomPx = toPixels(safeArea.bottom, safeArea.unit, variant.dpi);
  const safeLeftPx = toPixels(safeArea.left, safeArea.unit, variant.dpi);

  const totalWidthPx = widthPx + bleedLeftPx + bleedRightPx;
  const totalHeightPx = heightPx + bleedTopPx + bleedBottomPx;
  const hasValidSize = totalWidthPx > 0 && totalHeightPx > 0;
  const scale = hasValidSize ? Math.min(size / totalWidthPx, size / totalHeightPx) : 1;

  const previewW = hasValidSize ? totalWidthPx * scale : size;
  const previewH = hasValidSize ? totalHeightPx * scale : size;
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
  const checkerId = `checker-${surface?._id ?? variant._id}`;

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={previewW} height={previewH} viewBox={`0 0 ${previewW} ${previewH}`} className="rounded-sm" style={{ backgroundColor: '#f3f4f6' }}>
        <defs>
          <pattern id={checkerId} width="8" height="8" patternUnits="userSpaceOnUse">
            <rect width="8" height="8" fill="#e5e7eb" />
            <rect width="4" height="4" fill="#d1d5db" />
            <rect x="4" y="4" width="4" height="4" fill="#d1d5db" />
          </pattern>
        </defs>

        <rect x={0} y={0} width={previewW} height={previewH} fill={allowTransparency ? `url(#${checkerId})` : backgroundColor} opacity={allowTransparency ? 0.9 : 1} />
        <rect x={bleedLeftS} y={bleedTopS} width={Math.max(trimW, 0)} height={Math.max(trimH, 0)} fill={allowTransparency ? `url(#${checkerId})` : backgroundColor} />

        <rect x={0.5} y={0.5} width={Math.max(previewW - 1, 0)} height={Math.max(previewH - 1, 0)} fill="none" stroke="#ef4444" strokeWidth={1} strokeDasharray="4 3" opacity={0.75} />
        <rect x={bleedLeftS + 0.5} y={bleedTopS + 0.5} width={Math.max(trimW - 1, 0)} height={Math.max(trimH - 1, 0)} fill="none" stroke="#10b981" strokeWidth={1} />
        {safeW > 0 && safeH > 0 && (
          <rect x={bleedLeftS + safeLeftS + 0.5} y={bleedTopS + safeTopS + 0.5} width={safeW - 1} height={safeH - 1} fill="none" stroke="#3b82f6" strokeWidth={1} strokeDasharray="3 3" />
        )}
      </svg>

      {showLegend && (
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm border border-dashed border-red-400" />Bleed</span>
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm border border-emerald-500" />Trim</span>
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm border border-dashed border-blue-500" />Safe</span>
        </div>
      )}
    </div>
  );
}
