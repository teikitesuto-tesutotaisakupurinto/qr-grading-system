import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  setDoc,
  orderBy,
} from "firebase/firestore";

import {
  db,
} from "@/lib/firebase";


/* =========================================================
   Types
   ========================================================= */

export type TemplateAreaType =
  | "クラス"
  | "氏名"
  | "生徒QR"
  | "テストQR"
  | "大問"
  | "小問"
  | "得点欄"
  | "解答欄";


export type TemplateArea = {

  id: string;

  type: TemplateAreaType;

  number?: string;

  score?: number;

  text?: string;


  area: {

    x:number;

    y:number;

    width:number;

    height:number;

  };

};



export type AnswerTemplate = {

  id:string;

  organizationId:string;

  testId:string;

  imageUrl:string;

  areas:TemplateArea[];

  totalScore:number;

  createdAt?:unknown;

  updatedAt?:unknown;

};





/* =========================================================
   Save
   ========================================================= */


export async function saveAnswerTemplate(
  input:{
    organizationId:string;

    testId:string;

    imageUrl:string;

    areas:TemplateArea[];
  }
){

  const ref =
    doc(
      collection(
        db,
        "answerTemplates"
      )
    );


  const totalScore =
    input.areas
      .filter(
        (
          area
        ) =>
          area.type ===
          "小問"
      )
      .reduce(
        (
          total,
          area
        ) =>
          total +
          (
            area.score ??
            0
          ),

        0
      );



  await setDoc(
    ref,
    {

      organizationId:
        input.organizationId,


      testId:
        input.testId,


      imageUrl:
        input.imageUrl,


      areas:
        input.areas,


      totalScore,


      createdAt:
        serverTimestamp(),


      updatedAt:
        serverTimestamp(),

    }
  );


  return ref.id;

}





/* =========================================================
   Get one
   ========================================================= */


export async function getAnswerTemplate(
  templateId:string
)
:Promise<AnswerTemplate|null>{


  const snapshot =
    await getDoc(
      doc(
        db,
        "answerTemplates",
        templateId
      )
    );


  if(
    !snapshot.exists()
  ){

    return null;

  }



  const data =
    snapshot.data();



  return {

    id:
      snapshot.id,


    organizationId:
      stringValue(
        data.organizationId
      ),


    testId:
      stringValue(
        data.testId
      ),


    imageUrl:
      stringValue(
        data.imageUrl
      ),


    areas:
      Array.isArray(
        data.areas
      )
        ? data.areas as TemplateArea[]
        : [],


    totalScore:
      safeNumber(
        data.totalScore
      ),


    createdAt:
      data.createdAt,


    updatedAt:
      data.updatedAt,

  };

}






/* =========================================================
   Get by test
   ========================================================= */


export async function getTemplatesByTest(
  testId:string
)
:Promise<AnswerTemplate[]>{


  const snapshot =
    await getDocs(
      query(
        collection(
          db,
          "answerTemplates"
        ),

        where(
          "testId",
          "==",
          testId
        ),

        orderBy(
          "createdAt",
          "desc"
        )
      )
    );



  return snapshot.docs.map(
    (
      item
    ) => {

      const data =
        item.data();


      return {

        id:
          item.id,


        organizationId:
          stringValue(
            data.organizationId
          ),


        testId:
          stringValue(
            data.testId
          ),


        imageUrl:
          stringValue(
            data.imageUrl
          ),


        areas:
          Array.isArray(
            data.areas
          )
            ? data.areas as TemplateArea[]
            : [],


        totalScore:
          safeNumber(
            data.totalScore
          ),


        createdAt:
          data.createdAt,


        updatedAt:
          data.updatedAt,

      };

    }
  );

}







/* =========================================================
   Helpers
   ========================================================= */


function stringValue(
  value:unknown
){

  return typeof value ===
    "string"
      ? value
      : "";

}



function safeNumber(
  value:unknown
){

  const number =
    Number(
      value ??
      0
    );


  return Number.isFinite(
    number
  )
    ? number
    : 0;

}
