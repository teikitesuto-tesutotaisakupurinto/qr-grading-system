"use client";

import {
  PointerEvent as ReactPointerEvent,
  useRef,
  useState,
} from "react";

export type RegionType =
  | "section"
  | "question"
  | "answer"
  | "score"
  | "result"
  | "rubric"
  | "comment"
  | "name"
  | "qr";

export type Region = {
  id: string;
  type: RegionType;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

type RegionEditorProps = {
  imageUrl: string;
  regions?: Region[];
  onChange?: (regions: Region[]) => void;
};

const regionLabels: Record<RegionType, string> = {
  section: "大問枠",
  question: "小問枠",
  answer: "解答枠",
  score: "得点枠",
  result: "採点結果枠",
  rubric: "観点枠",
  comment: "コメント枠",
  name: "氏名枠",
  qr: "QR枠",
};

export default function RegionEditor({
  imageUrl,
  regions = [],
  onChange,
}: RegionEditorProps) {
  const imageRef = useRef<HTMLImageElement>(null);

  const [items, setItems] = useState<Region[]>(regions);
  const [selectedType, setSelectedType] =
    useState<RegionType>("answer");

  const [drawing, setDrawing] = useState(false);

  const [start, setStart] = useState({
    x: 0,
    y: 0,
  });

  const [preview, setPreview] = useState<Region | null>(
    null
  );

  function getRelativePosition(
    event: ReactPointerEvent<HTMLDivElement>
  ) {
    const image = imageRef.current;

    if (!image) {
      return null;
    }

    const rect = image.getBoundingClientRect();

    const x =
      ((event.clientX - rect.left) / rect.width) * 100;

    const y =
      ((event.clientY - rect.top) / rect.height) * 100;

    return {
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    };
  }

  function handlePointerDown(
    event: ReactPointerEvent<HTMLDivElement>
  ) {
    const position = getRelativePosition(event);

    if (!position) return;

    setDrawing(true);

    setStart(position);

    setPreview({
      id: `region-${Date.now()}`,
      type: selectedType,
      label: regionLabels[selectedType],
      x: position.x,
      y: position.y,
      width: 0,
      height: 0,
    });
  }

  function handlePointerMove(
    event: ReactPointerEvent<HTMLDivElement>
  ) {
    if (!drawing || !preview) return;

    const position = getRelativePosition(event);

    if (!position) return;

    const x = Math.min(start.x, position.x);
    const y = Math.min(start.y, position.y);

    const width = Math.abs(position.x - start.x);
    const height = Math.abs(position.y - start.y);

    setPreview({
      ...preview,
      x,
      y,
      width,
      height,
    });
  }

  function handlePointerUp() {
    if (!drawing || !preview) return;

    setDrawing(false);

    if (
      preview.width < 1 ||
      preview.height < 1
    ) {
      setPreview(null);
      return;
    }

    const next = [...items, preview];

    setItems(next);
    onChange?.(next);

    setPreview(null);
  }

  function removeRegion(id: string) {
    const next = items.filter(
      (region) => region.id !== id
    );

    setItems(next);
    onChange?.(next);
  }

  function clearRegions() {
    setItems([]);
    onChange?.([]);
  }

  return (
    <div className="regionEditor">
      <div className="regionToolbar">
        <div className="regionTypeSelector">
          <label htmlFor="region-type">
            枠の種類
          </label>

          <select
            id="region-type"
            value={selectedType}
            onChange={(event) =>
              setSelectedType(
                event.target.value as RegionType
              )
            }
          >
            {Object.entries(regionLabels).map(
              ([type, label]) => (
                <option
                  key={type}
                  value={type}
                >
                  {label}
                </option>
              )
            )}
          </select>
        </div>

        <button
          type="button"
          onClick={clearRegions}
        >
          すべて削除
        </button>
      </div>

      <div
        className="regionCanvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          setDrawing(false);
          setPreview(null);
        }}
      >
        <img
          ref={imageRef}
          src={imageUrl}
          alt="解答画像"
          className="regionImage"
          draggable={false}
        />

        {items.map((region) => (
          <div
            key={region.id}
            className={`regionBox region-${region.type}`}
            style={{
              left: `${region.x}%`,
              top: `${region.y}%`,
              width: `${region.width}%`,
              height: `${region.height}%`,
            }}
            onPointerDown={(event) =>
              event.stopPropagation()
            }
          >
            <span className="regionLabel">
              {region.label}
            </span>

            <button
              type="button"
              className="regionDelete"
              onPointerDown={(event) =>
                event.stopPropagation()
              }
              onClick={() =>
                removeRegion(region.id)
              }
              aria-label={`${region.label}を削除`}
            >
              ×
            </button>
          </div>
        ))}

        {preview && (
          <div
            className="regionBox regionPreview"
            style={{
              left: `${preview.x}%`,
              top: `${preview.y}%`,
              width: `${preview.width}%`,
              height: `${preview.height}%`,
            }}
          >
            <span className="regionLabel">
              {preview.label}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
