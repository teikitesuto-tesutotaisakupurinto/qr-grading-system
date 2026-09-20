"use client";

import {
  useEffect,
  useState,
  WheelEvent,
} from "react";

type AnswerViewerProps = {
  imageUrl: string;
  alt?: string;
  initialZoom?: number;
};

export default function AnswerViewer({
  imageUrl,
  alt = "答案画像",
  initialZoom = 1,
}: AnswerViewerProps) {
  const [zoom, setZoom] =
    useState(initialZoom);

  const [rotation, setRotation] =
    useState(0);

  const [x, setX] =
    useState(0);

  const [y, setY] =
    useState(0);

  const [dragging, setDragging] =
    useState(false);

  const [dragStart, setDragStart] =
    useState({
      x: 0,
      y: 0,
    });

  function zoomIn() {
    setZoom((current) =>
      Math.min(
        4,
        Number(
          (current + 0.1).toFixed(2)
        )
      )
    );
  }

  function zoomOut() {
    setZoom((current) =>
      Math.max(
        0.5,
        Number(
          (current - 0.1).toFixed(2)
        )
      )
    );
  }

  function resetView() {
    setZoom(initialZoom);
    setRotation(0);
    setX(0);
    setY(0);
  }

  function rotateLeft() {
    setRotation((current) =>
      current - 90
    );
  }

  function rotateRight() {
    setRotation((current) =>
      current + 90
    );
  }

  function handleWheel(
    event: WheelEvent<HTMLDivElement>
  ) {
    if (
      !event.ctrlKey &&
      !event.metaKey
    ) {
      return;
    }

    event.preventDefault();

    setZoom((current) => {
      const next =
        event.deltaY < 0
          ? current + 0.1
          : current - 0.1;

      return Math.min(
        4,
        Math.max(
          0.5,
          Number(
            next.toFixed(2)
          )
        )
      );
    });
  }

  function startDrag(
    clientX: number,
    clientY: number
  ) {
    setDragging(true);

    setDragStart({
      x: clientX - x,
      y: clientY - y,
    });
  }

  function moveDrag(
    clientX: number,
    clientY: number
  ) {
    if (!dragging) {
      return;
    }

    setX(
      clientX -
        dragStart.x
    );

    setY(
      clientY -
        dragStart.y
    );
  }

  function stopDrag() {
    setDragging(false);
  }

  useEffect(() => {
    function handleKeyDown(
      event: KeyboardEvent
    ) {
      const target =
        event.target as HTMLElement | null;

      if (
        target?.tagName ===
          "INPUT" ||
        target?.tagName ===
          "TEXTAREA" ||
        target?.tagName ===
          "SELECT"
      ) {
        return;
      }

      if (
        event.key === "+" ||
        event.key === "="
      ) {
        event.preventDefault();
        zoomIn();
      }

      if (
        event.key === "-" ||
        event.key === "_"
      ) {
        event.preventDefault();
        zoomOut();
      }

      if (
        event.key.toLowerCase() ===
        "r"
      ) {
        event.preventDefault();
        rotateRight();
      }

      if (
        event.key === "0"
      ) {
        event.preventDefault();
        resetView();
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [
    zoom,
    dragging,
    dragStart,
    x,
    y,
  ]);

  return (
    <div className="answerViewer">
      <div className="answerToolbar">
        <button
          type="button"
          onClick={zoomOut}
          aria-label="縮小"
        >
          −
        </button>

        <span
          style={{
            minWidth: 55,
            textAlign: "center",
            fontSize: 12,
          }}
        >
          {Math.round(
            zoom * 100
          )}
          %
        </span>

        <button
          type="button"
          onClick={zoomIn}
          aria-label="拡大"
        >
          ＋
        </button>

        <button
          type="button"
          onClick={rotateLeft}
          aria-label="左回転"
        >
          ↺
        </button>

        <button
          type="button"
          onClick={rotateRight}
          aria-label="右回転"
        >
          ↻
        </button>

        <button
          type="button"
          onClick={resetView}
        >
          リセット
        </button>

        <span
          style={{
            marginLeft: "auto",
            color: "#777",
            fontSize: 11,
          }}
        >
          Ctrl/Cmd + ホイール：拡大縮小
        </span>
      </div>

      <div
        className="answerCanvas"
        onWheel={handleWheel}
        onMouseDown={(event) =>
          startDrag(
            event.clientX,
            event.clientY
          )
        }
        onMouseMove={(event) =>
          moveDrag(
            event.clientX,
            event.clientY
          )
        }
        onMouseUp={stopDrag}
        onMouseLeave={stopDrag}
        style={{
          cursor: dragging
            ? "grabbing"
            : "grab",
        }}
      >
        <img
          src={imageUrl}
          alt={alt}
          className="answerImage"
          draggable={false}
          style={{
            transform:
              `translate(${x}px, ${y}px) ` +
              `scale(${zoom}) ` +
              `rotate(${rotation}deg)`,
          }}
        />
      </div>
    </div>
  );
}
