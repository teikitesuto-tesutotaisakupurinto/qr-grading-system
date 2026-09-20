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

type MarkerCandidate = {
  x: number;
  y: number;
  width: number;
  height: number;
  area: number;
  centerX: number;
  centerY: number;
};

type BinaryImage = {
  data: Uint8Array;
  width: number;
  height: number;
};

const TARGET_WIDTH = 2480;
const TARGET_HEIGHT = 3508;

const MIN_MARKER_AREA = 100;
const MAX_MARKER_AREA_RATIO = 0.01;

const MARKER_MARGIN_RATIO = 0.2;

/* =========================================================
   メイン
   ========================================================= */

export async function correctAnswerImage(
  input: Buffer
): Promise<CorrectionResult> {
  if (!input.length) {
    throw new Error(
      "補正対象の画像が空です。"
    );
  }

  const metadata =
    await sharp(input).metadata();

  const originalWidth =
    metadata.width ?? 0;

  const originalHeight =
    metadata.height ?? 0;

  if (
    originalWidth <= 0 ||
    originalHeight <= 0
  ) {
    throw new Error(
      "画像サイズを取得できません。"
    );
  }

  /*
   * EXIF回転を先に反映。
   */
  const normalized =
    await sharp(input)
      .rotate()
      .png()
      .toBuffer();

  const normalizedMetadata =
    await sharp(normalized)
      .metadata();

  const width =
    normalizedMetadata.width ?? 0;

  const height =
    normalizedMetadata.height ?? 0;

  if (
    width <= 0 ||
    height <= 0
  ) {
    throw new Error(
      "正規化後の画像サイズを取得できません。"
    );
  }

  /*
   * 四隅マーカーを検出。
   */
  const corners =
    await detectCornerMarkers(
      normalized
    );

  validateCornerGeometry(
    corners,
    width,
    height
  );

  /*
   * 四隅4点 → A4基準4点
   * のホモグラフィーを計算。
   */
  const homography =
    calculateHomography(
      [
        corners.topLeft,
        corners.topRight,
        corners.bottomRight,
        corners.bottomLeft,
      ],
      [
        {
          x: 0,
          y: 0,
        },
        {
          x: TARGET_WIDTH - 1,
          y: 0,
        },
        {
          x: TARGET_WIDTH - 1,
          y: TARGET_HEIGHT - 1,
        },
        {
          x: 0,
          y: TARGET_HEIGHT - 1,
        },
      ]
    );

  /*
   * 実際にピクセルを透視変換。
   */
  const corrected =
    await perspectiveWarp(
      normalized,
      width,
      height,
      homography,
      TARGET_WIDTH,
      TARGET_HEIGHT
    );

  return {
    buffer: corrected,

    originalWidth,
    originalHeight,

    correctedWidth:
      TARGET_WIDTH,

    correctedHeight:
      TARGET_HEIGHT,

    corners,
  };
}

/* =========================================================
   四隅マーカー検出
   ========================================================= */

async function detectCornerMarkers(
  input: Buffer
): Promise<{
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
}> {
  const metadata =
    await sharp(input).metadata();

  const width =
    metadata.width ?? 0;

  const height =
    metadata.height ?? 0;

  /*
   * マーカー探索用に縮小。
   *
   * 大きな答案をそのまま全画素探索すると
   * CPU負荷が高くなるため、長辺1600px程度にする。
   */
  const detectionWidth =
    Math.min(1600, width);

  const scale =
    detectionWidth / width;

  const detectionHeight =
    Math.max(
      1,
      Math.round(
        height * scale
      )
    );

  const {
    data,
    info,
  } =
    await sharp(input)
      .resize({
        width:
          detectionWidth,
        height:
          detectionHeight,
        fit: "fill",
      })
      .grayscale()
      .normalize()
      .threshold(180)
      .raw()
      .toBuffer({
        resolveWithObject:
          true,
      });

  const binary: BinaryImage = {
    data,
    width: info.width,
    height: info.height,
  };

  const candidates =
    findMarkerCandidates(
      binary
    );

  const filtered =
    candidates.filter(
      (candidate) =>
        candidate.area >=
          MIN_MARKER_AREA &&
        candidate.area <=
          binary.width *
            binary.height *
            MAX_MARKER_AREA_RATIO
    );

  const topLeft =
    selectCornerCandidate(
      filtered,
      0,
      0,
      binary.width,
      binary.height
    );

  const topRight =
    selectCornerCandidate(
      filtered,
      binary.width,
      0,
      binary.width,
      binary.height
    );

  const bottomRight =
    selectCornerCandidate(
      filtered,
      binary.width,
      binary.height,
      binary.width,
      binary.height
    );

  const bottomLeft =
    selectCornerCandidate(
      filtered,
      0,
      binary.height,
      binary.width,
      binary.height
    );

  if (
    !topLeft ||
    !topRight ||
    !bottomRight ||
    !bottomLeft
  ) {
    throw new Error(
      "答案用紙の四隅マーカーを4個すべて検出できませんでした。"
    );
  }

  /*
   * 縮小画像上の座標を元画像へ戻す。
   */
  return {
    topLeft: scalePoint(
      topLeft,
      1 / scale
    ),

    topRight: scalePoint(
      topRight,
      1 / scale
    ),

    bottomRight:
      scalePoint(
        bottomRight,
        1 / scale
      ),

    bottomLeft:
      scalePoint(
        bottomLeft,
        1 / scale
      ),
  };
}

/* =========================================================
   黒領域の連結成分検出
   ========================================================= */

function findMarkerCandidates(
  image: BinaryImage
): MarkerCandidate[] {
  const {
    data,
    width,
    height,
  } = image;

  /*
   * threshold後の黒画素だけを見る。
   *
   * 0 = 黒
   * 255 = 白
   */
  const visited =
    new Uint8Array(
      width * height
    );

  const candidates: MarkerCandidate[] =
    [];

  /*
   * 答案全体を1ピクセルずつ探索。
   */
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
        data[index] > 20
      ) {
        continue;
      }

      const component =
        floodFill(
          data,
          visited,
          width,
          height,
          x,
          y
        );

      if (!component) {
        continue;
      }

      const componentWidth =
        component.maxX -
        component.minX +
        1;

      const componentHeight =
        component.maxY -
        component.minY +
        1;

      if (
        componentWidth <= 0 ||
        componentHeight <= 0
      ) {
        continue;
      }

      const aspectRatio =
        componentWidth /
        componentHeight;

      /*
       * 四角形マーカーなので
       * 極端に細長いものを除外。
       */
      if (
        aspectRatio < 0.65 ||
        aspectRatio > 1.55
      ) {
        continue;
      }

      const fillRatio =
        component.area /
        (componentWidth *
          componentHeight);

      /*
       * 中身がある程度詰まった黒四角を
       * マーカー候補とする。
       */
      if (fillRatio < 0.45) {
        continue;
      }

      candidates.push({
        x: component.minX,
        y: component.minY,
        width:
          componentWidth,
        height:
          componentHeight,
        area:
          component.area,
        centerX:
          component.minX +
          componentWidth / 2,
        centerY:
          component.minY +
          componentHeight / 2,
      });
    }
  }

  return candidates;
}

function floodFill(
  data: Uint8Array,
  visited: Uint8Array,
  width: number,
  height: number,
  startX: number,
  startY: number
) {
  const queueX: number[] = [
    startX,
  ];

  const queueY: number[] = [
    startY,
  ];

  let queueIndex = 0;

  const startIndex =
    startY * width +
    startX;

  visited[startIndex] = 1;

  let minX = startX;
  let maxX = startX;
  let minY = startY;
  let maxY = startY;

  let area = 0;

  /*
   * 4近傍。
   */
  const directions = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];

  /*
   * 巨大な黒領域をマーカーとして
   * 探索し続けないための上限。
   */
  const MAX_COMPONENT_PIXELS =
    50000;

  while (
    queueIndex <
    queueX.length
  ) {
    const x =
      queueX[queueIndex];

    const y =
      queueY[queueIndex];

    queueIndex++;

    area++;

    if (
      area >
      MAX_COMPONENT_PIXELS
    ) {
      return null;
    }

    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;

    for (
      const [
        dx,
        dy,
      ] of directions
    ) {
      const nx = x + dx;
      const ny = y + dy;

      if (
        nx < 0 ||
        ny < 0 ||
        nx >= width ||
        ny >= height
      ) {
        continue;
      }

      const index =
        ny * width + nx;

      if (visited[index]) {
        continue;
      }

      if (data[index] > 20) {
        continue;
      }

      visited[index] = 1;

      queueX.push(nx);
      queueY.push(ny);
    }
  }

  return {
    minX,
    maxX,
    minY,
    maxY,
    area,
  };
}

/* =========================================================
   四隅候補選択
   ========================================================= */

function selectCornerCandidate(
  candidates: MarkerCandidate[],
  targetX: number,
  targetY: number,
  width: number,
  height: number
): MarkerCandidate | null {
  const marginX =
    width *
    MARKER_MARGIN_RATIO;

  const marginY =
    height *
    MARKER_MARGIN_RATIO;

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
    (a, b) =>
      distanceSquared(
        a.centerX,
        a.centerY,
        targetX,
        targetY
      ) -
      distanceSquared(
        b.centerX,
        b.centerY,
        targetX,
        targetY
      )
  );

  return nearby[0];
}

function scalePoint(
  point: MarkerCandidate,
  factor: number
): Point {
  return {
    x:
      point.centerX *
      factor,

    y:
      point.centerY *
      factor,
  };
}

function distanceSquared(
  x1: number,
  y1: number,
  x2: number,
  y2: number
) {
  const dx =
    x1 - x2;

  const dy =
    y1 - y2;

  return (
    dx * dx +
    dy * dy
  );
}

/* =========================================================
   四隅形状検証
   ========================================================= */

function validateCornerGeometry(
  corners: {
    topLeft: Point;
    topRight: Point;
    bottomRight: Point;
    bottomLeft: Point;
  },
  width: number,
  height: number
) {
  const topWidth =
    distance(
      corners.topLeft,
      corners.topRight
    );

  const bottomWidth =
    distance(
      corners.bottomLeft,
      corners.bottomRight
    );

  const leftHeight =
    distance(
      corners.topLeft,
      corners.bottomLeft
    );

  const rightHeight =
    distance(
      corners.topRight,
      corners.bottomRight
    );

  const minimumWidth =
    width * 0.5;

  const minimumHeight =
    height * 0.5;

  if (
    topWidth <
      minimumWidth ||
    bottomWidth <
      minimumWidth ||
    leftHeight <
      minimumHeight ||
    rightHeight <
      minimumHeight
  ) {
    throw new Error(
      "四隅マーカーの位置が答案用紙として不正です。"
    );
  }

  /*
   * 上下・左右が極端に違う場合は
   * 誤検出の可能性が高い。
   */
  const widthRatio =
    Math.min(
      topWidth,
      bottomWidth
    ) /
    Math.max(
      topWidth,
      bottomWidth
    );

  const heightRatio =
    Math.min(
      leftHeight,
      rightHeight
    ) /
    Math.max(
      leftHeight,
      rightHeight
    );

  if (
    widthRatio < 0.5 ||
    heightRatio < 0.5
  ) {
    throw new Error(
      "四隅マーカーの配置が不正です。"
    );
  }
}

function distance(
  a: Point,
  b: Point
) {
  return Math.sqrt(
    Math.pow(
      a.x - b.x,
      2
    ) +
      Math.pow(
        a.y - b.y,
        2
      )
  );
}

/* =========================================================
   ホモグラフィー
   ========================================================= */

type Matrix3x3 = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number
];

function calculateHomography(
  source: Point[],
  destination: Point[]
): Matrix3x3 {
  if (
    source.length !== 4 ||
    destination.length !== 4
  ) {
    throw new Error(
      "ホモグラフィー計算には4点が必要です。"
    );
  }

  /*
   * h33 = 1 として8未知数を解く。
   */
  const A: number[][] = [];
  const B: number[] = [];

  for (
    let i = 0;
    i < 4;
    i++
  ) {
    const x =
      source[i].x;

    const y =
      source[i].y;

    const u =
      destination[i].x;

    const v =
      destination[i].y;

    A.push([
      x,
      y,
      1,
      0,
      0,
      0,
      -u * x,
      -u * y,
    ]);

    B.push(u);

    A.push([
      0,
      0,
      0,
      x,
      y,
      1,
      -v * x,
      -v * y,
    ]);

    B.push(v);
  }

  const h =
    solveLinearSystem(
      A,
      B
    );

  return [
    h[0],
    h[1],
    h[2],
    h[3],
    h[4],
    h[5],
    h[6],
    h[7],
    1,
  ];
}

function solveLinearSystem(
  A: number[][],
  B: number[]
): number[] {
  const n = B.length;

  const matrix =
    A.map(
      (row, index) => [
        ...row,
        B[index],
      ]
    );

  for (
    let column = 0;
    column < n;
    column++
  ) {
    let pivot = column;

    for (
      let row =
        column + 1;
      row < n;
      row++
    ) {
      if (
        Math.abs(
          matrix[row][column]
        ) >
        Math.abs(
          matrix[pivot][column]
        )
      ) {
        pivot = row;
      }
    }

    if (
      Math.abs(
        matrix[pivot][column]
      ) < 1e-12
    ) {
      throw new Error(
        "ホモグラフィー行列を計算できません。"
      );
    }

    [
      matrix[column],
      matrix[pivot],
    ] = [
      matrix[pivot],
      matrix[column],
    ];

    const divisor =
      matrix[column][
        column
      ];

    for (
      let j = column;
      j <= n;
      j++
    ) {
      matrix[column][j] /=
        divisor;
    }

    for (
      let row = 0;
      row < n;
      row++
    ) {
      if (
        row === column
      ) {
        continue;
      }

      const factor =
        matrix[row][
          column
        ];

      for (
        let j = column;
        j <= n;
        j++
      ) {
        matrix[row][j] -=
          factor *
          matrix[column][j];
      }
    }
  }

  return matrix.map(
    (row) => row[n]
  );
}

/* =========================================================
   透視変換
   ========================================================= */

async function perspectiveWarp(
  input: Buffer,
  sourceWidth: number,
  sourceHeight: number,
  homography: Matrix3x3,
  targetWidth: number,
  targetHeight: number
): Promise<Buffer> {
  /*
   * 入力画像をRGBA rawにする。
   */
  const {
    data,
    info,
  } =
    await sharp(input)
      .ensureAlpha()
      .raw()
      .toBuffer({
        resolveWithObject:
          true,
      });

  const source =
    new Uint8Array(data);

  /*
   * 出力はRGBA。
   */
  const output =
    Buffer.allocUnsafe(
      targetWidth *
        targetHeight *
        4
    );

  /*
   * 出力→入力の逆変換を使います。
   *
   * H:
   * 入力 → 出力
   *
   * H^-1:
   * 出力 → 入力
   */
  const inverse =
    invertMatrix3x3(
      homography
    );

  for (
    let y = 0;
    y < targetHeight;
    y++
  ) {
    for (
      let x = 0;
      x < targetWidth;
      x++
    ) {
      const denominator =
        inverse[6] * x +
        inverse[7] * y +
        inverse[8];

      if (
        Math.abs(
          denominator
        ) < 1e-12
      ) {
        setWhitePixel(
          output,
          targetWidth,
          x,
          y
        );

        continue;
      }

      const sourceX =
        (
          inverse[0] * x +
          inverse[1] * y +
          inverse[2]
        ) /
        denominator;

      const sourceY =
        (
          inverse[3] * x +
          inverse[4] * y +
          inverse[5]
        ) /
        denominator;

      if (
        sourceX < 0 ||
        sourceY < 0 ||
        sourceX >=
          sourceWidth - 1 ||
        sourceY >=
          sourceHeight - 1
      ) {
        setWhitePixel(
          output,
          targetWidth,
          x,
          y
        );

        continue;
      }

      /*
       * バイリニア補間。
       */
      sampleBilinear(
        source,
        info.width,
        info.height,
        sourceX,
        sourceY,
        output,
        targetWidth,
        x,
        y
      );
    }
  }

  return sharp(output, {
    raw: {
      width:
        targetWidth,
      height:
        targetHeight,
      channels: 4,
    },
  })
    .png()
    .toBuffer();
}

function sampleBilinear(
  source: Uint8Array,
  sourceWidth: number,
  sourceHeight: number,
  x: number,
  y: number,
  output: Buffer,
  outputWidth: number,
  outputX: number,
  outputY: number
) {
  const x0 =
    Math.floor(x);

  const y0 =
    Math.floor(y);

  const x1 =
    Math.min(
      x0 + 1,
      sourceWidth - 1
    );

  const y1 =
    Math.min(
      y0 + 1,
      sourceHeight - 1
    );

  const dx =
    x - x0;

  const dy =
    y - y0;

  const outputIndex =
    (
      outputY *
        outputWidth +
      outputX
    ) * 4;

  for (
    let channel = 0;
    channel < 4;
    channel++
  ) {
    const p00 =
      source[
        (
          y0 *
            sourceWidth +
          x0
        ) *
          4 +
        channel
      ];

    const p10 =
      source[
        (
          y0 *
            sourceWidth +
          x1
        ) *
          4 +
        channel
      ];

    const p01 =
      source[
        (
          y1 *
            sourceWidth +
          x0
        ) *
          4 +
        channel
      ];

    const p11 =
      source[
        (
          y1 *
            sourceWidth +
          x1
        ) *
          4 +
        channel
      ];

    const top =
      p00 +
      (p10 - p00) *
        dx;

    const bottom =
      p01 +
      (p11 - p01) *
        dx;

    output[
      outputIndex +
        channel
    ] = Math.round(
      top +
        (bottom - top) *
          dy
    );
  }
}

function setWhitePixel(
  output: Buffer,
  width: number,
  x: number,
  y: number
) {
  const index =
    (y * width + x) *
    4;

  output[index] = 255;
  output[index + 1] = 255;
  output[index + 2] = 255;
  output[index + 3] = 255;
}

/* =========================================================
   3×3行列逆行列
   ========================================================= */

function invertMatrix3x3(
  matrix: Matrix3x3
): Matrix3x3 {
  const [
    a,
    b,
    c,
    d,
    e,
    f,
    g,
    h,
    i,
  ] = matrix;

  const A =
    e * i - f * h;

  const B =
    -(d * i - f * g);

  const C =
    d * h - e * g;

  const D =
    -(b * i - c * h);

  const E =
    a * i - c * g;

  const F =
    -(a * h - b * g);

  const G =
    b * f - c * e;

  const H =
    -(a * f - c * d);

  const I =
    a * e - b * d;

  const determinant =
    a * A +
    b * B +
    c * C;

  if (
    Math.abs(
      determinant
    ) < 1e-12
  ) {
    throw new Error(
      "透視変換行列を反転できません。"
    );
  }

  return [
    A / determinant,
    D / determinant,
    G / determinant,

    B / determinant,
    E / determinant,
    H / determinant,

    C / determinant,
    F / determinant,
    I / determinant,
  ];
}
