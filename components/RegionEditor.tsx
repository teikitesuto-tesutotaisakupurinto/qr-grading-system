"use client";

import {
  PointerEvent,
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

  x: number;
  y: number;
  width: number;
  height: number;

  questionId?: string;
  questionNumber?: string;
  label?: string;
};

type RegionEditorProps = {
  imageUrl: string;
  regions: Region[];
  onChange: (
    regions: Region[]
  ) => void;
  disabled?: boolean;
};

const regionTypes: {
  value: RegionType;
  label: string;
}[] = [
  {
    value: "section",
    label: "大問枠",
  },
  {
    value: "question",
    label: "小問枠",
  },
  {
    value: "answer",
    label: "解答枠",
  },
  {
    value: "score",
    label: "得点枠",
  },
  {
    value: "result",
    label: "採点結果枠",
  },
  {
    value: "rubric",
    label: "観点枠",
  },
  {
    value: "comment",
    label: "コメント枠",
  },
  {
    value: "name",
    label: "氏名枠",
  },
  {
    value: "qr",
    label: "QR枠",
  },
];

export default function RegionEditor({
  imageUrl,
  regions,
  onChange,
  disabled = false,
}: RegionEditorProps) {
  const canvasRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const [selectedType, setSelectedType] =
    useState<RegionType>(
      "answer"
    );

  const [drawing, setDrawing] =
    useState(false);

  const [start, setStart] =
    useState({
      x: 0,
      y: 0,
    });

  const [preview, setPreview] =
    useState<Region | null>(null);

  const [selectedRegionId, setSelectedRegionId] =
    useState<string | null>(
      null
    );

  function getPosition(
    event: PointerEvent
  ) {
    const element =
      canvasRef.current;

    if (!element) {
      return null;
    }

    const rect =
      element.getBoundingClientRect();

    if (
      rect.width <= 0 ||
      rect.height <= 0
    ) {
      return null;
    }

    const x =
      Math.max(
        0,
        Math.min(
          1,
          (event.clientX -
            rect.left) /
            rect.width
        )
      );

    const y =
      Math.max(
        0,
        Math.min(
          1,
          (event.clientY -
            rect.top) /
            rect.height
        )
      );

    return {
      x,
      y,
    };
  }

  function handlePointerDown(
    event: PointerEvent<HTMLDivElement>
  ) {
    if (disabled) {
      return;
    }

    /*
     * 既存の枠をクリックした場合は
     * 新しい枠を作らない。
     */
    if (
      event.target !==
      event.currentTarget
    ) {
      return;
    }

    const position =
      getPosition(event);

    if (!position) {
      return;
    }

    setSelectedRegionId(
      null
    );

    setDrawing(true);

    setStart(position);

    setPreview({
      id: "preview",
      type: selectedType,

      x: position.x,
      y: position.y,

      width: 0,
      height: 0,
    });

    event.currentTarget.setPointerCapture(
      event.pointerId
    );
  }

  function handlePointerMove(
    event: PointerEvent<HTMLDivElement>
  ) {
    if (
      !drawing ||
      disabled
    ) {
      return;
    }

    const position =
      getPosition(event);

    if (!position) {
      return;
    }

    const x =
      Math.min(
        start.x,
        position.x
      );

    const y =
      Math.min(
        start.y,
        position.y
      );

    const width =
      Math.abs(
        position.x -
          start.x
      );

    const height =
      Math.abs(
        position.y -
          start.y
      );

    setPreview({
      id: "preview",
      type: selectedType,

      x,
      y,

      width,
      height,
    });
  }

  function handlePointerUp(
    event: PointerEvent<HTMLDivElement>
  ) {
    if (
      !drawing ||
      disabled
    ) {
      return;
    }

    const position =
      getPosition(event);

    setDrawing(false);

    if (!position) {
      setPreview(null);
      return;
    }

    const x =
      Math.min(
        start.x,
        position.x
      );

    const y =
      Math.min(
        start.y,
        position.y
      );

    const width =
      Math.abs(
        position.x -
          start.x
      );

    const height =
      Math.abs(
        position.y -
          start.y
      );

    /*
     * 小さすぎる枠は登録しない。
     */
    if (
      width < 0.01 ||
      height < 0.01
    ) {
      setPreview(null);
      return;
    }

    const region: Region = {
      id:
        typeof crypto !==
          "undefined" &&
        "randomUUID" in crypto
          ? crypto.randomUUID()
          : `region-${Date.now()}`,

      type:
        selectedType,

      x,
      y,
      width,
      height,

      label:
        getRegionLabel(
          selectedType
        ),
    };

    onChange([
      ...regions,
      region,
    ]);

    setSelectedRegionId(
      region.id
    );

    setPreview(null);

    event.currentTarget.releasePointerCapture(
      event.pointerId
    );
  }

  function deleteRegion(
    regionId: string
  ) {
    onChange(
      regions.filter(
        (region) =>
          region.id !==
          regionId
      )
    );

    if (
      selectedRegionId ===
      regionId
    ) {
      setSelectedRegionId(
        null
      );
    }
  }

  function updateRegion(
    regionId: string,
    patch: Partial<Region>
  ) {
    onChange(
      regions.map(
        (region) =>
          region.id ===
          regionId
            ? {
                ...region,
                ...patch,
              }
            : region
      )
    );
  }

  return (
    <div className="regionEditor">
      <div className="regionToolbar">
        <div className="regionTypeSelector">
          <label>
            枠タイプ
          </label>

          <select
            value={selectedType}
            disabled={disabled}
            onChange={(event) =>
              setSelectedType(
                event.target
                  .value as RegionType
              )
            }
          >
            {regionTypes.map(
              (type) => (
                <option
                  key={type.value}
                  value={
                    type.value
                  }
                >
                  {type.label}
                </option>
              )
            )}
          </select>
        </div>

        <span
          style={{
            color: "#777",
            fontSize: 12,
          }}
        >
          画像上をドラッグして枠を作成
        </span>
      </div>

      <div
        ref={canvasRef}
        className="regionCanvas"
        onPointerDown={
          handlePointerDown
        }
        onPointerMove={
          handlePointerMove
        }
        onPointerUp={
          handlePointerUp
        }
        onPointerCancel={() => {
          setDrawing(false);
          setPreview(null);
        }}
      >
        <img
          src={imageUrl}
          alt="採点設定用解答画像"
          className="regionImage"
          draggable={false}
        />

        {regions.map(
          (region) => {
            const selected =
              selectedRegionId ===
              region.id;

            return (
              <div
                key={region.id}
                className={[
                  "regionBox",
                  `region-${region.type}`,
                ]
                  .filter(
                    Boolean
                  )
                  .join(" ")}
                style={{
                  left:
                    `${region.x * 100}%`,
                  top:
                    `${region.y * 100}%`,
                  width:
                    `${region.width * 100}%`,
                  height:
                    `${region.height * 100}%`,
                  outline:
                    selected
                      ? "2px solid #000"
                      : undefined,
                }}
                onPointerDown={(
                  event
                ) => {
                  event.stopPropagation();

                  setSelectedRegionId(
                    region.id
                  );
                }}
              >
                <div className="regionLabel">
                  {region.label ??
                    getRegionLabel(
                      region.type
                    )}
                </div>

                {selected &&
                  !disabled && (
                    <button
                      type="button"
                      className="regionDelete"
                      onPointerDown={(
                        event
                      ) =>
                        event.stopPropagation()
                      }
                      onClick={(
                        event
                      ) => {
                        event.stopPropagation();

                        deleteRegion(
                          region.id
                        );
                      }}
                    >
                      ×
                    </button>
                  )}
              </div>
            );
          }
        )}

        {preview && (
          <div
            className="regionBox regionPreview"
            style={{
              left:
                `${preview.x * 100}%`,
              top:
                `${preview.y * 100}%`,
              width:
                `${preview.width * 100}%`,
              height:
                `${preview.height * 100}%`,
            }}
          >
            <div className="regionLabel">
              {getRegionLabel(
                preview.type
              )}
            </div>
          </div>
        )}
      </div>

      {selectedRegionId && (
        <RegionProperties
          region={
            regions.find(
              (item) =>
                item.id ===
                selectedRegionId
            ) ?? null
          }
          disabled={disabled}
          onChange={updateRegion}
          onDelete={
            deleteRegion
          }
        />
      )}

      <div
        className="selectionPanel"
        style={{
          marginTop: 12,
        }}
      >
        <span>
          設定済み：
          {regions.length}
          個
        </span>
      </div>
    </div>
  );
}

type RegionPropertiesProps = {
  region: Region | null;
  disabled: boolean;
  onChange: (
    id: string,
    patch: Partial<Region>
  ) => void;
  onDelete: (
    id: string
  ) => void;
};

function RegionProperties({
  region,
  disabled,
  onChange,
  onDelete,
}: RegionPropertiesProps) {
  if (!region) {
    return null;
  }

  return (
    <div
      className="formCard"
      style={{
        marginTop: 12,
      }}
    >
      <h3>
        選択中の枠
      </h3>

      <label>
        枠名

        <input
          value={
            region.label ?? ""
          }
          disabled={disabled}
          onChange={(event) =>
            onChange(
              region.id,
              {
                label:
                  event.target
                    .value,
              }
            )
          }
        />
      </label>

      <label>
        問題ID

        <input
          value={
            region.questionId ??
            ""
          }
          disabled={disabled}
          onChange={(event) =>
            onChange(
              region.id,
              {
                questionId:
                  event.target
                    .value ||
                  undefined,
              }
            )
          }
          placeholder="question-id"
        />
      </label>

      <label>
        問題番号

        <input
          value={
            region.questionNumber ??
            ""
          }
          disabled={disabled}
          onChange={(event) =>
            onChange(
              region.id,
              {
                questionNumber:
                  event.target
                    .value ||
                  undefined,
              }
            )
          }
          placeholder="1"
        />
      </label>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "1fr 1fr",
          gap: 8,
        }}
      >
        <label>
          X

          <input
            type="number"
            min={0}
            max={1}
            step={0.001}
            value={
              region.x
            }
            disabled={disabled}
            onChange={(event) =>
              onChange(
                region.id,
                {
                  x:
                    Number(
                      event.target
                        .value
                    ),
                }
              )
            }
          />
        </label>

        <label>
          Y

          <input
            type="number"
            min={0}
            max={1}
            step={0.001}
            value={
              region.y
            }
            disabled={disabled}
            onChange={(event) =>
              onChange(
                region.id,
                {
                  y:
                    Number(
                      event.target
                        .value
                    ),
                }
              )
            }
          />
        </label>

        <label>
          幅

          <input
            type="number"
            min={0}
            max={1}
            step={0.001}
            value={
              region.width
            }
            disabled={disabled}
            onChange={(event) =>
              onChange(
                region.id,
                {
                  width:
                    Number(
                      event.target
                        .value
                    ),
                }
              )
            }
          />
        </label>

        <label>
          高さ

          <input
            type="number"
            min={0}
            max={1}
            step={0.001}
            value={
              region.height
            }
            disabled={disabled}
            onChange={(event) =>
              onChange(
                region.id,
                {
                  height:
                    Number(
                      event.target
                        .value
                    ),
                }
              )
            }
          />
        </label>
      </div>

      {!disabled && (
        <button
          type="button"
          className="dangerButton"
          onClick={() =>
            onDelete(
              region.id
            )
          }
        >
          この枠を削除
        </button>
      )}
    </div>
  );
}

function getRegionLabel(
  type: RegionType
) {
  const found =
    regionTypes.find(
      (item) =>
        item.value === type
    );

  return (
    found?.label ??
    "枠"
  );
}
