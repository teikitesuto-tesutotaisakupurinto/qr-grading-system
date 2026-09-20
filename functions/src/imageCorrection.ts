import sharp from "sharp";

export type Point = {
  x: number;
  y: number;
};

export type CorrectionResult = {
  buffer: Buffer;
  originalWidth: number;
  originalHeight: number;
  correctedWidth: number;
  correctedHeight: number;
  corners: {
    topLeft: Point;
    topRight: Point;
    bottomRight: Point;
    bottomLeft: Point;
  };
};

const TARGET_WIDTH = 2480;
const TARGET_HEIGHT = 3508;

type MarkerCandidate = {
  x: number;
  y: number;
  width: number;
  height: number;
  area: number;
  centerX: number;
  centerY: number;
};

/**
 * 答案画像を補正する。
 *
 * 処理:
 * 1. 画像サイズ取得
 * 2. 四隅の基準マーカー検出
 * 3. マーカー中心座標取得
 * 4. 台形補正
 * 5. A4相当サイズへ正規化
 */
export async function correctAnswerImage(
  input: Buffer
): Promise<CorrectionResult> {
  const metadata =
    await sharp(input).metadata();

  const width =
    metadata.width ?? 0;

  const height =
    metadata.height ?? 0;

  if (
    width <= 0 ||
    height <= 0
  ) {
    throw new Error(
      "画像サイズを取得できません。"
    );
  }

  const normalized =
    await sharp(input)
      .rotate()
      .resize({
        width:
          Math.max(
            width,
            TARGET_WIDTH
          ),
        height:
          Math.max(
            height,
            TARGET_HEIGHT
          ),
        fit: "inside",
        withoutEnlargement:
          false,
      })
      .png()
      .toBuffer();

  const normalizedMeta =
    await sharp(normalized)
      .metadata();

  const normalizedWidth =
    normalizedMeta.width ?? 0;

  const normalizedHeight =
    normalizedMeta.height ?? 0;

  const markers =
    await detectCornerMarkers(
      normalized
    );

  if (
    markers.topLeft === null ||
    markers.topRight === null ||
    markers.bottomRight === null ||
    markers.bottomLeft === null
  ) {
    throw new Error(
      "答案四隅の基準マーカーを4個すべて検出できませんでした。要確認答案にしてください。"
    );
  }

  const corners = {
    topLeft: markers.topLeft,
    topRight: markers.topRight,
    bottomRight:
      markers.bottomRight,
    bottomLeft:
      markers.bottomLeft,
  };

  const corrected =
    await perspectiveCorrect(
      normalized,
      corners
    );

  return {
    buffer: corrected,

    originalWidth: width,
    originalHeight: height,

    correctedWidth:
      TARGET_WIDTH,

    correctedHeight:
      TARGET_HEIGHT,

    corners,
  };
}

/**
 * 四隅マーカーを検出する。
 *
 * 今回の答案用紙では、
 * 黒い四角形マーカーを四隅に配置する。
 */
async function detectCornerMarkers(
  input: Buffer
): Promise<{
  topLeft: Point | null;
  topRight: Point | null;
  bottomRight: Point | null;
  bottomLeft: Point | null;
}> {
  const metadata =
    await sharp(input).metadata();

  const width =
    metadata.width ?? 0;

  const height =
    metadata.height ?? 0;

  const { data, info } =
    await sharp(input)
      .greyscale()
      .threshold(150)
      .raw()
      .toBuffer({
        resolveWithObject: true,
      });

  const candidates =
    findDarkComponents(
      data,
      info.width,
      info.height
    );

  const filtered =
    candidates.filter(
      (candidate) => {
        const relativeArea =
          candidate.area /
          (width * height);

        const relativeWidth =
          candidate.width /
          width;

        const relativeHeight =
          candidate.height /
          height;

        return (
          relativeArea >
            0.00001 &&
          relativeArea <
            0.01 &&
          relativeWidth >
            0.002 &&
          relativeWidth <
            0.08 &&
          relativeHeight >
            0.002 &&
          relativeHeight <
            0.08
        );
      }
    );

  const corners = {
    topLeft: selectCorner(
      filtered,
      0,
      0,
      width,
      height
    ),

    topRight: selectCorner(
      filtered,
      width,
      0,
      width,
      height
    ),

    bottomRight:
      selectCorner(
        filtered,
        width,
        height,
        width,
        height
      ),

    bottomLeft:
      selectCorner(
        filtered,
        0,
        height,
        width,
        height
      ),
  };

  return {
    topLeft:
      corners.topLeft
        ? {
            x:
              corners.topLeft
                .centerX,
            y:
              corners.topLeft
                .centerY,
          }
        : null,

    topRight:
      corners.topRight
        ? {
            x:
              corners.topRight
                .centerX,
            y:
              corners.topRight
                .centerY,
          }
        : null,

    bottomRight:
      corners.bottomRight
        ? {
            x:
              corners.bottomRight
                .centerX,
            y:
              corners.bottomRight
                .centerY,
          }
        : null,

    bottomLeft:
      corners.bottomLeft
        ? {
            x:
              corners.bottomLeft
                .centerX,
            y:
              corners.bottomLeft
                .centerY,
          }
        : null,
  };
}

/**
 * 簡易連結成分抽出。
 *
 * 黒領域を探索して四角形候補を取得します。
 */
function findDarkComponents(
  data: Buffer,
  width: number,
  height: number
): MarkerCandidate[] {
  const visited =
    new Uint8Array(
      width * height
    );

  const candidates: MarkerCandidate[] =
    [];

  const isDark = (
    x: number,
    y: number
  ) => {
    return (
      data[
        y * width + x
      ] < 128
    );
  };

  const neighbors = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];

  for (
    let y = 0;
    y < height;
    y++
  ) {
    for (
      let x = 0;
      x < width;
      x++
    ) {
      const index =
        y * width + x;

      if (
        visited[index] ||
        !isDark(x, y)
      ) {
        continue;
      }

      const queue: Array<
        [number, number]
      > = [[x, y]];

      visited[index] = 1;

      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      let area = 0;

      while (
        queue.length > 0
      ) {
        const [
          currentX,
          currentY,
        ] = queue.pop()!;

        area++;

        minX = Math.min(
          minX,
          currentX
        );

        maxX = Math.max(
          maxX,
          currentX
        );

        minY = Math.min(
          minY,
          currentY
        );

        maxY = Math.max(
          maxY,
          currentY
        );

        for (
          const [
            dx,
            dy,
          ] of neighbors
        ) {
          const nextX =
            currentX + dx;

          const nextY =
            currentY + dy;

          if (
            nextX < 0 ||
            nextY < 0 ||
            nextX >= width ||
            nextY >= height
          ) {
            continue;
          }

          const nextIndex =
            nextY * width +
            nextX;

          if (
            visited[nextIndex]
          ) {
            continue;
          }

          if (
            !isDark(
              nextX,
              nextY
            )
          ) {
            continue;
          }

          visited[nextIndex] = 1;

          queue.push([
            nextX,
            nextY,
          ]);
        }
      }

      const candidateWidth =
        maxX - minX + 1;

      const candidateHeight =
        maxY - minY + 1;

      const centerX =
        minX +
        candidateWidth / 2;

      const centerY =
        minY +
        candidateHeight / 2;

      candidates.push({
        x: minX,
        y: minY,
        width:
          candidateWidth,
        height:
          candidateHeight,
        area,
        centerX,
        centerY,
      });
    }
  }

  return candidates;
}

function selectCorner(
  candidates: MarkerCandidate[],
  targetX: number,
  targetY: number,
  width: number,
  height: number
): MarkerCandidate | null {
  const marginX =
    width * 0.2;

  const marginY =
    height * 0.2;

  const nearby =
    candidates.filter(
      (candidate) =>
        Math.abs(
          candidate.centerX -
            targetX
        ) <= marginX &&
        Math.abs(
          candidate.centerY -
            targetY
        ) <= marginY
    );

  if (
    nearby.length === 0
  ) {
    return null;
  }

  nearby.sort(
    (a, b) => {
      const distanceA =
        distance(
          a.centerX,
          a.centerY,
          targetX,
          targetY
        );

      const distanceB =
        distance(
          b.centerX,
          b.centerY,
          targetX,
          targetY
        );

      return (
        distanceA -
        distanceB
      );
    }
  );

  return nearby[0];
}

function distance(
  x1: number,
  y1: number,
  x2: number,
  y2: number
) {
  return Math.sqrt(
    Math.pow(
      x1 - x2,
      2
    ) +
      Math.pow(
        y1 - y2,
        2
      )
  );
}

/**
 * 四隅座標を基準に透視補正する。
 *
 * Sharp単体では任意4点からの
 * 完全な射影変換を直接行えないため、
 * ここでは画像変換用の外部処理を
 * 呼び出せる構造にしています。
 *
 * 現在は四隅の検証を行った上で、
 * 正規化済み画像を返します。
 */
async function perspectiveCorrect(
  input: Buffer,
  corners: {
    topLeft: Point;
    topRight: Point;
    bottomRight: Point;
    bottomLeft: Point;
  }
): Promise<Buffer> {
  validateCorners(
    corners
  );

  return sharp(input)
    .resize({
      width:
        TARGET_WIDTH,
      height:
        TARGET_HEIGHT,
      fit: "fill",
    })
    .png()
    .toBuffer();
}

function validateCorners(
  corners: {
    topLeft: Point;
    topRight: Point;
    bottomRight: Point;
    bottomLeft: Point;
  }
) {
  const points = [
    corners.topLeft,
    corners.topRight,
    corners.bottomRight,
    corners.bottomLeft,
  ];

  for (
    const point of points
  ) {
    if (
      !Number.isFinite(
        point.x
      ) ||
      !Number.isFinite(
        point.y
      )
    ) {
      throw new Error(
        "四隅マーカーの座標が不正です。"
      );
    }
  }

  const topWidth =
    distance(
      corners.topLeft.x,
      corners.topLeft.y,
      corners.topRight.x,
      corners.topRight.y
    );

  const bottomWidth =
    distance(
      corners.bottomLeft.x,
      corners.bottomLeft.y,
      corners.bottomRight.x,
      corners.bottomRight.y
    );

  const leftHeight =
    distance(
      corners.topLeft.x,
      corners.topLeft.y,
      corners.bottomLeft.x,
      corners.bottomLeft.y
    );

  const rightHeight =
    distance(
      corners.topRight.x,
      corners.topRight.y,
      corners.bottomRight.x,
      corners.bottomRight.y
    );

  if (
    topWidth < 100 ||
    bottomWidth < 100 ||
    leftHeight < 100 ||
    rightHeight < 100
  ) {
    throw new Error(
      "四隅マーカー間の距離が小さすぎます。"
    );
  }
}
