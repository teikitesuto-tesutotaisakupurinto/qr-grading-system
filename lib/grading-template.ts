import {
  getAnswerTemplate,
  type TemplateArea,
} from "@/lib/template";


/* =========================================================
   Types
   ========================================================= */


export type QuestionArea = {

  id:string;

  type:
    | "大問"
    | "小問";

  number:string;

  score:number;

  area:{
    x:number;

    y:number;

    width:number;

    height:number;
  };

};



export type GradingTemplate = {

  templateId:string;

  testId:string;

  imageUrl:string;

  questions:QuestionArea[];

  totalScore:number;

};




/* =========================================================
   Load template for grading
   ========================================================= */


export async function loadGradingTemplate(
  templateId:string
)
:Promise<GradingTemplate|null>{


  const template =
    await getAnswerTemplate(
      templateId
    );


  if(
    !template
  ){

    return null;

  }



  const questions =
    template.areas
      .filter(
        (
          area
        ) =>
          area.type ===
            "大問" ||

          area.type ===
            "小問"
      )
      .map(
        (
          area
        ) => ({

          id:
            area.id,

          type:
            area.type as
              | "大問"
              | "小問",

          number:
            area.number ??
            "",

          score:
            area.score ??
            0,

          area:
            area.area,

        })
      );



  return {

    templateId:
      template.id,


    testId:
      template.testId,


    imageUrl:
      template.imageUrl,


    questions,


    totalScore:
      template.totalScore,

  };

}






/* =========================================================
   Find questions inside big question
   ========================================================= */


export function getSubQuestions(
  areas:TemplateArea[],
  bigQuestion:TemplateArea
)
{

  return areas.filter(
    (
      area
    ) =>

      area.type ===
        "小問"

      &&

      isInside(
        bigQuestion,
        area
      )

  );

}





/* =========================================================
   Area check
   ========================================================= */


function isInside(
  parent:TemplateArea,

  child:TemplateArea
)
{

  const centerX =
    child.area.x +
    child.area.width /
    2;


  const centerY =
    child.area.y +
    child.area.height /
    2;



  return (

    centerX >=
      parent.area.x

    &&

    centerX <=
      parent.area.x +
      parent.area.width


    &&


    centerY >=
      parent.area.y

    &&

    centerY <=
      parent.area.y +
      parent.area.height

  );

}







/* =========================================================
   Crop area
   ========================================================= */


/*
 * 実際の画像切り抜き処理は
 * Storage/Cloud Function側で行う。
 *
 * ここでは切り抜き範囲情報を返す。
 */


export function createCropRequests(
  template:GradingTemplate
)
{

  return template.questions.map(
    (
      question
    ) => ({

      questionId:
        question.id,


      questionNumber:
        question.number,


      crop:
        question.area,


      score:
        question.score,

    })
  );

}
