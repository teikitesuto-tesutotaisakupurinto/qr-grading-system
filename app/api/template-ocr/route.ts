import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  ImageAnnotatorClient,
} from "@google-cloud/vision";


type OCRBox = {
  text: string;

  area: {
    x: number;

    y: number;

    width: number;

    height: number;
  };
};



export async function POST(
  request: NextRequest
) {

  try {

    const formData =
      await request.formData();


    const file =
      formData.get(
        "file"
      );


    if (
      !(file instanceof File)
    ) {

      return NextResponse.json(
        {
          error:
            "画像ファイルがありません。",
        },
        {
          status:
            400,
        }
      );

    }



    const bytes =
      await file.arrayBuffer();


    const buffer =
      Buffer.from(
        bytes
      );



    const client =
      new ImageAnnotatorClient({
        credentials:
          process.env.GOOGLE_VISION_CREDENTIALS
            ? JSON.parse(
                process.env.GOOGLE_VISION_CREDENTIALS
              )
            : undefined,
      });



    const [
      result,
    ] =
      await client.documentTextDetection(
        {
          image:
            {
              content:
                buffer.toString(
                  "base64"
                ),
            },
        }
      );



    const annotations =
      result.fullTextAnnotation
        ?.pages
        ?.flatMap(
          (
            page
          ) =>
            page.blocks ??
            []
        )
        ?.flatMap(
          (
            block
          ) =>
            block.paragraphs ??
            []
        )
        ?.flatMap(
          (
            paragraph
          ) =>
            paragraph.words ??
            []
        )
        ??
        [];



    const boxes:
      OCRBox[] =
      annotations.map(
        (
          word
        ) => {

          const vertices =
            word.boundingBox
              ?.vertices ??
              [];


          const xs =
            vertices.map(
              (
                vertex
              ) =>
                vertex.x ??
                0
            );


          const ys =
            vertices.map(
              (
                vertex
              ) =>
                vertex.y ??
                0
            );


          const minX =
            Math.min(
              ...xs
            );


          const maxX =
            Math.max(
              ...xs
            );


          const minY =
            Math.min(
              ...ys
            );


          const maxY =
            Math.max(
              ...ys
            );



          return {
            text:
              word.symbols
                ?.map(
                  (
                    symbol
                  ) =>
                    symbol.text ??
                    ""
                )
                .join(""),

            area:
              {
                x:
                  minX,

                y:
                  minY,

                width:
                  maxX -
                  minX,

                height:
                  maxY -
                  minY,
              },
          };

        }
      );



    return NextResponse.json(
      {
        boxes,
      }
    );



  } catch (
    error
  ) {

    console.error(
      "Template OCR error:",
      error
    );


    return NextResponse.json(
      {
        error:
          "OCR解析に失敗しました。",
      },
      {
        status:
          500,
      }
    );

  }

}
