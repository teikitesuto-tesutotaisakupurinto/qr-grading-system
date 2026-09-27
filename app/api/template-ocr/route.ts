import {
  NextRequest,
  NextResponse,
} from "next/server";


type OCRBox = {
  text: string;

  area: {
    x: number;

    y: number;

    width: number;

    height: number;
  };
};



/*
 * OCR API
 *
 * 現在はNext側の受け口。
 *
 * 実際のOCR処理は
 * Firebase Functions
 * + Google Vision API
 * 側で実行する。
 *
 * このAPIでは
 * templates/page.tsx
 * との通信形式を固定する。
 */


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



    /*
     * TODO:
     *
     * Firebase Functions
     * analyzeAnswerTemplate
     *
     * 呼び出しへ接続する。
     *
     * 戻り値:
     *
     * {
     *   boxes:[
     *     {
     *       text:"氏名",
     *       area:{
     *          x,
     *          y,
     *          width,
     *          height
     *       }
     *     }
     *   ]
     * }
     *
     */



    const boxes:
      OCRBox[] =
      [];



    return NextResponse.json(
      {
        boxes,
      }
    );



  } catch(error){

    console.error(
      "template OCR error:",
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
