"use client";

import { useEffect, useRef, useState } from "react";

type AnswerViewerProps = {
  imageUrl: string;
  alt?: string;
};

export default function AnswerViewer({
  imageUrl,
  alt = "答案画像",
}: AnswerViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  const zoomIn = () => {
    setZoom((current) => Math.min(current + 0.25, 4));
  };

  const zoomOut = () => {
    setZoom((current) => Math.max(current - 0.25, 0.5));
  };

  const resetView = () => {
    setZoom(1);
    setRotation(0);
  };

  const rotateLeft = () => {
    setRotation((current) => current - 90);
  };

  const rotateRight = () => {
    setRotation((current) => current + 90);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "+") {
        zoomIn();
      }

      if (event.key === "-") {
        zoomOut();
      }

      if (event.key === "0") {
        resetView();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  });

  return (
    <div className="answerViewer">
      <div className="answerToolbar">
        <button type="button" onClick={zoomOut}>
          −
        </button>

        <span>{Math.round(zoom * 100)}%</span>

        <button type="button" onClick={zoomIn}>
          ＋
        </button>

        <button type="button" onClick={rotateLeft}>
          ↶
        </button>

        <button type="button" onClick={rotateRight}>
          ↷
        </button>

        <button type="button" onClick={resetView}>
          リセット
        </button>
      </div>

      <div
        ref={containerRef}
        className="answerCanvas"
      >
        <img
          src={imageUrl}
          alt={alt}
          className="answerImage"
          style={{
            transform: `scale(${zoom}) rotate(${rotation}deg)`,
          }}
        />
      </div>
    </div>
  );
}
