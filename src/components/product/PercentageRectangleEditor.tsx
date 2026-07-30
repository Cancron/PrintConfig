import { useEffect, useRef, useState } from 'react';

export interface PercentageRectangle {
  x: number;
  y: number;
  width: number;
  height: number;
  cornerRadius?: number;
}

interface Props {
  imageUrl: string;
  imageAlt: string;
  value: PercentageRectangle;
  onChange: (value: PercentageRectangle) => void;
}

type Corner = 'nw' | 'ne' | 'sw' | 'se';
type Interaction = {
  type: 'draw' | 'move' | 'resize';
  startX: number;
  startY: number;
  initial: PercentageRectangle;
  corner?: Corner;
};

export function PercentageRectangleEditor({ imageUrl, imageAlt, value, onChange }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const interactionRef = useRef<Interaction | null>(null);
  const [loadedUrl, setLoadedUrl] = useState('');

  useEffect(() => {
    setLoadedUrl('');
    interactionRef.current = null;
  }, [imageUrl]);

  function pointerPercent(event: React.PointerEvent) {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect?.width || !rect.height) return null;
    return {
      x: clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100),
      y: clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100),
    };
  }

  function capture(event: React.PointerEvent, interaction: Interaction) {
    interactionRef.current = interaction;
    wrapperRef.current?.setPointerCapture(event.pointerId);
  }

  function startDraw(event: React.PointerEvent<HTMLDivElement>) {
    const target = event.target;
    if (target !== event.currentTarget && target !== wrapperRef.current?.querySelector('img')) return;
    const point = pointerPercent(event);
    if (point) capture(event, { type: 'draw', startX: point.x, startY: point.y, initial: value });
  }

  function startMove(event: React.PointerEvent) {
    event.stopPropagation();
    const point = pointerPercent(event);
    if (point) capture(event, { type: 'move', startX: point.x, startY: point.y, initial: value });
  }

  function startResize(event: React.PointerEvent, corner: Corner) {
    event.stopPropagation();
    const point = pointerPercent(event);
    if (point) capture(event, { type: 'resize', corner, startX: point.x, startY: point.y, initial: value });
  }

  function handleMove(event: React.PointerEvent<HTMLDivElement>) {
    const interaction = interactionRef.current;
    const point = pointerPercent(event);
    if (!interaction || !point) return;

    if (interaction.type === 'draw') {
      const left = Math.min(interaction.startX, point.x);
      const right = Math.max(interaction.startX, point.x);
      const top = Math.min(interaction.startY, point.y);
      const bottom = Math.max(interaction.startY, point.y);
      onChange({ ...value, x: left, y: top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) });
      return;
    }

    if (interaction.type === 'move') {
      onChange({
        ...value,
        x: clamp(interaction.initial.x + point.x - interaction.startX, 0, 100 - interaction.initial.width),
        y: clamp(interaction.initial.y + point.y - interaction.startY, 0, 100 - interaction.initial.height),
        width: interaction.initial.width,
        height: interaction.initial.height,
      });
      return;
    }

    const initialRight = interaction.initial.x + interaction.initial.width;
    const initialBottom = interaction.initial.y + interaction.initial.height;
    const left = interaction.corner?.includes('w') ? clamp(point.x, 0, initialRight - 1) : interaction.initial.x;
    const right = interaction.corner?.includes('e') ? clamp(point.x, interaction.initial.x + 1, 100) : initialRight;
    const top = interaction.corner?.includes('n') ? clamp(point.y, 0, initialBottom - 1) : interaction.initial.y;
    const bottom = interaction.corner?.includes('s') ? clamp(point.y, interaction.initial.y + 1, 100) : initialBottom;
    onChange({ ...value, x: left, y: top, width: right - left, height: bottom - top });
  }

  function endInteraction(event: React.PointerEvent<HTMLDivElement>) {
    interactionRef.current = null;
    if (wrapperRef.current?.hasPointerCapture(event.pointerId)) wrapperRef.current.releasePointerCapture(event.pointerId);
  }

  const rectangle = normalizeRectangle(value);

  return (
    <div className="flex min-h-[440px] items-center justify-center overflow-hidden bg-slate-50 p-5">
      {!imageUrl ? (
        <p className="text-sm text-gray-500">Choose a mockup image to draw its printable design region.</p>
      ) : (
        <div
          ref={wrapperRef}
          onPointerDown={startDraw}
          onPointerMove={handleMove}
          onPointerUp={endInteraction}
          onPointerCancel={endInteraction}
          className="relative inline-block max-h-[70vh] max-w-full touch-none select-none"
        >
          <img
            src={imageUrl}
            alt={imageAlt}
            onLoad={() => setLoadedUrl(imageUrl)}
            className="block h-auto max-h-[70vh] w-auto max-w-full object-contain"
            draggable={false}
          />
          {loadedUrl === imageUrl && (
            <div
              onPointerDown={startMove}
              className="absolute box-border cursor-move border-2 border-cyan-500 bg-cyan-400/15"
              style={{
                left: `${rectangle.x}%`,
                top: `${rectangle.y}%`,
                width: `${rectangle.width}%`,
                height: `${rectangle.height}%`,
                borderRadius: `${clamp(Number(value.cornerRadius ?? 0), 0, 50)}%`,
              }}
            >
              <span className="pointer-events-none absolute left-1 top-1 rounded bg-cyan-700 px-1.5 py-0.5 text-[10px] font-semibold text-white">Design area</span>
              {(['nw', 'ne', 'sw', 'se'] as const).map((corner) => (
                <button
                  key={corner}
                  type="button"
                  aria-label={`Resize ${corner}`}
                  onPointerDown={(event) => startResize(event, corner)}
                  className={`absolute h-3 w-3 rounded-full border border-white bg-cyan-600 ${
                    corner === 'nw'
                      ? '-left-1.5 -top-1.5 cursor-nwse-resize'
                      : corner === 'ne'
                        ? '-right-1.5 -top-1.5 cursor-nesw-resize'
                        : corner === 'sw'
                          ? '-bottom-1.5 -left-1.5 cursor-nesw-resize'
                          : '-bottom-1.5 -right-1.5 cursor-nwse-resize'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function normalizeRectangle(value: PercentageRectangle) {
  const width = clamp(finite(value.width, 1), 1, 100);
  const height = clamp(finite(value.height, 1), 1, 100);
  return {
    x: clamp(finite(value.x, 0), 0, 100 - width),
    y: clamp(finite(value.y, 0), 0, 100 - height),
    width,
    height,
  };
}

function finite(value: number, fallback: number) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
