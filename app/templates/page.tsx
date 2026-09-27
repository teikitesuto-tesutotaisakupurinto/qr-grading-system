"use client";

import {
  ChangeEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  collection,
  doc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import {
  auth,
  db,
} from "@/lib/firebase";

import {
  getAppUser,
} from "@/lib/auth";


/* =========================================================
   Types
   ========================================================= */

type AreaType =
  | "クラス"
  | "氏名"
  | "生徒QR"
  | "テストQR"
  | "大問"
  | "小問"
  | "得点欄"
  | "解答欄";


type TemplateArea = {

  id:string;

  type:AreaType;

  number?:string;

  score?:number;

  text?:string;

  area:{
    x:number;

    y:number;

    width:number;

    height:number;
  };

};



type OCRBox = {

  text:string;

  area:{
    x:number;

    y:number;

    width:number;

    height:number;
  };

};



const AREA_TYPES:
  AreaType[] = [

    "クラス",

    "氏名",

    "生徒QR",

    "テストQR",

    "大問",

    "小問",

    "得点欄",

    "解答欄",

  ];



/* =========================================================
   Page
   ========================================================= */


export default function TemplatesPage(){

  const [
    organizationId,
    setOrganizationId,
  ] =
  useState("");



  const [
    testId,
    setTestId,
  ] =
  useState("");



  const [
    imageUrl,
    setImageUrl,
  ] =
  useState("");



  const [
    imageFile,
    setImageFile,
  ] =
  useState<File|null>(
    null
  );



  const [
    areas,
    setAreas,
  ] =
  useState<TemplateArea[]>(
    []
  );



  const [
    selectedAreaId,
    setSelectedAreaId,
  ] =
  useState<string|null>(
    null
  );



  const [
    selectedType,
    setSelectedType,
  ] =
  useState<AreaType>(
    "小問"
  );



  const [
    loading,
    setLoading,
  ] =
  useState(false);



  const [
    message,
    setMessage,
  ] =
  useState("");



  const imageRef =
    useRef<HTMLImageElement|null>(
      null
    );



  /* =======================================================
     User
     ======================================================= */


  useEffect(()=>{

    void loadUser();

  },[]);



  async function loadUser(){

    const user =
      await getAppUser(
        auth.currentUser
      );


    if(
      user?.organizationId
    ){

      setOrganizationId(
        user.organizationId
      );

    }

  }



  /* =======================================================
     Image
     ======================================================= */


  function handleImageChange(
    event:
      ChangeEvent<HTMLInputElement>
  ){

    const file =
      event.target.files?.[0];


    if(
      !file
    ){

      return;

    }



    setImageFile(
      file
    );


    setImageUrl(
      URL.createObjectURL(
        file
      )
    );


    setAreas([]);


    setMessage(
      "画像を読み込みました。"
    );

  }




  /* =======================================================
     OCR
     ======================================================= */


  async function runOCR(){

    if(
      !imageFile
    ){

      setMessage(
        "答案画像を選択してください。"
      );

      return;

    }



    try{

      setLoading(
        true
      );



      const formData =
        new FormData();


      formData.append(
        "file",
        imageFile
      );



      const response =
        await fetch(
          "/api/template-ocr",
          {
            method:
              "POST",

            body:
              formData,
          }
        );



      if(
        !response.ok
      ){

        throw new Error(
          "OCR解析に失敗しました。"
        );

      }



      const data =
        await response.json();



      const boxes:
        OCRBox[] =
        Array.isArray(
          data.boxes
        )
          ? data.boxes
          : [];



      const generated =
        boxes.map(
          (
            box
          ) => ({

            id:
              createId(),

            type:
              detectType(
                box.text
              ),

            text:
              box.text,

            area:
              box.area,

          })
        );



      setAreas(
        generated
      );


      setMessage(
        "OCR解析が完了しました。"
      );


    }catch(error){

      console.error(
        error
      );


      setMessage(
        "OCR解析に失敗しました。"
      );


    }finally{

      setLoading(
        false
      );

    }

  }
  // Part2/4


  /* =======================================================
     Area control
     ======================================================= */


  function addArea(
    x:number,
    y:number
  ){

    const area:
      TemplateArea =
      {

        id:
          createId(),


        type:
          selectedType,


        number:
          selectedType ===
          "小問"
            ? String(
                getNextQuestionNumber()
              )
            : undefined,


        score:
          selectedType ===
          "小問"
            ? 0
            : undefined,


        area:{

          x,

          y,

          width:
            150,

          height:
            80,

        },

      };



    setAreas(
      current => [
        ...current,
        area,
      ]
    );



    setSelectedAreaId(
      area.id
    );

  }





  function getNextQuestionNumber(){

    const numbers =
      areas
        .filter(
          item =>
            item.type ===
            "小問"
        )
        .map(
          item =>
            Number(
              item.number
            )
        )
        .filter(
          Number.isFinite
        );


    if(
      numbers.length ===
      0
    ){

      return 1;

    }


    return (
      Math.max(
        ...numbers
      )
      +
      1
    );

  }





  function updateArea(
    id:string,
    update:
      Partial<TemplateArea>
  ){

    setAreas(
      current =>
        current.map(
          item =>
            item.id === id
              ? {
                  ...item,

                  ...update,
                }
              : item
        )
    );

  }





  function deleteArea(
    id:string
  ){

    setAreas(
      current =>
        current.filter(
          item =>
            item.id !==
            id
        )
    );


    setSelectedAreaId(
      null
    );

  }






  function updateScore(
    id:string,
    score:number
  ){

    setAreas(
      current =>
        current.map(
          item =>
            item.id === id
              ? {

                  ...item,

                  score,

                }

              : item
        )
    );

  }







  /* =======================================================
     Canvas
     ======================================================= */


  function handleCanvasClick(
    event:
      React.MouseEvent<HTMLDivElement>
  ){

    if(
      !event.shiftKey
    ){

      return;

    }



    const rect =
      event.currentTarget
        .getBoundingClientRect();



    addArea(
      event.clientX -
        rect.left,

      event.clientY -
        rect.top
    );

  }







  function moveArea(
    event:
      React.MouseEvent,

    id:string
  ){

    const target =
      areas.find(
        item =>
          item.id === id
      );


    if(
      !target
    ){

      return;

    }



    const startX =
      event.clientX;


    const startY =
      event.clientY;


    function move(
      moveEvent:
        MouseEvent
    ){

      const dx =
        moveEvent.clientX -
        startX;


      const dy =
        moveEvent.clientY -
        startY;



      updateArea(
        id,
        {

          area:{
            ...target.area,

            x:
              target.area.x +
              dx,

            y:
              target.area.y +
              dy,

          }

        }
      );

    }





    function end(){

      window.removeEventListener(
        "mousemove",
        move
      );


      window.removeEventListener(
        "mouseup",
        end
      );

    }




    window.addEventListener(
      "mousemove",
      move
    );


    window.addEventListener(
      "mouseup",
      end
    );

  }







  /* =======================================================
     Parent detection
     ======================================================= */


  function getChildQuestions(
    parent:TemplateArea
  ){

    return areas.filter(
      item =>

        item.type ===
        "小問"

        &&

        isInside(
          parent,
          item
        )
    );

  }





  function isInside(
    parent:TemplateArea,
    child:TemplateArea
  ){

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







  /* =======================================================
     Save
     ======================================================= */


  async function saveTemplate(){

    try{

      setLoading(
        true
      );


      const user =
        await getAppUser(
          auth.currentUser
        );


      if(
        !user?.organizationId
      ){

        throw new Error(
          "組織情報がありません。"
        );

      }




      const ref =
        doc(
          collection(
            db,
            "answerTemplates"
          )
        );



      const totalScore =
        areas
          .filter(
            item =>
              item.type ===
              "小問"
          )
          .reduce(
            (
              total,
              item
            ) =>
              total +
              (
                item.score ??
                0
              ),

            0
          );




      await setDoc(
        ref,
        {

          organizationId:
            user.organizationId,


          testId,


          imageUrl,


          areas,


          totalScore,


          createdAt:
            serverTimestamp(),


          updatedAt:
            serverTimestamp(),

        }
      );



      setMessage(
        "テンプレートを保存しました。"
      );


    }catch(error){

      console.error(
        error
      );


      setMessage(
        "保存に失敗しました。"
      );


    }finally{

      setLoading(
        false
      );

    }

  }
  // Part3/4


  /* =======================================================
     Render
     ======================================================= */


  return (

    <main
      className="page"
    >

      <section
        className="content"
        style={{
          maxWidth:
            1500,

          margin:
            "0 auto",
        }}
      >


        <header
          className="pageHeader"
        >

          <div>

            <h1>
              答案テンプレート設定
            </h1>


            <p
              className="muted"
            >
              OCR解析後に枠を修正して採点範囲を設定します。
            </p>

          </div>


        </header>





        {message && (

          <div
            className="successMessage"
          >

            {
              message
            }

          </div>

        )}






        <section
          className="card"
        >

          <h2>
            答案画像
          </h2>



          <input

            type="file"

            accept="
              image/png,
              image/jpeg,
              application/pdf
            "

            onChange={
              handleImageChange
            }

          />




          <div
            style={{
              display:
                "flex",

              gap:
                10,

              marginTop:
                12,
            }}
          >


            <input

              value={
                testId
              }

              onChange={

                event =>
                  setTestId(
                    event.target.value
                  )

              }

              placeholder="テストID"

            />




            <button

              type="button"

              className="button"

              disabled={
                loading
              }

              onClick={
                runOCR
              }

            >

              {
                loading
                  ? "OCR解析中..."
                  : "OCR解析"
              }


            </button>


          </div>


        </section>








        <div

          style={{
            display:
              "grid",

            gridTemplateColumns:
              "1fr 320px",

            gap:
              16,

            marginTop:
              16,
          }}

        >





          {/* ==================================================
              Image Canvas
             ================================================== */}


          <section
            className="card"
          >


            <h2>
              枠編集
            </h2>


            <p
              className="muted"
              style={{
                fontSize:
                  12,
              }}
            >
              Shift + クリックで枠追加。枠をドラッグして移動できます。
            </p>




            <div

              onClick={
                handleCanvasClick
              }

              style={{

                position:
                  "relative",

                display:
                  "inline-block",

                maxWidth:
                  "100%",

              }}

            >


              {imageUrl && (

                <img

                  ref={
                    imageRef
                  }

                  src={
                    imageUrl
                  }

                  alt="template"

                  style={{
                    maxWidth:
                      "100%",

                    display:
                      "block",
                  }}

                />

              )}






              {areas.map(
                area => (

                  <div

                    key={
                      area.id
                    }


                    onMouseDown={
                      event => {

                        event.stopPropagation();


                        setSelectedAreaId(
                          area.id
                        );


                        moveArea(
                          event,
                          area.id
                        );

                      }
                    }


                    style={{

                      position:
                        "absolute",


                      left:
                        area.area.x,


                      top:
                        area.area.y,


                      width:
                        area.area.width,


                      height:
                        area.area.height,



                      border:
                        selectedAreaId ===
                        area.id
                          ? "3px solid red"
                          : "2px solid blue",



                      background:
                        "rgba(0,0,255,0.12)",



                      cursor:
                        "move",

                    }}

                  >


                    <span
                      style={{

                        background:
                          "#fff",

                        fontSize:
                          11,

                      }}
                    >

                      {
                        area.type
                      }

                    </span>


                  </div>


                )
              )}



            </div>


          </section>







          {/* ==================================================
              Setting
             ================================================== */}


          <section
            className="card"
          >


            <h2>
              設定
            </h2>




            <label>

              枠種類


              <select

                value={
                  selectedType
                }

                onChange={

                  event =>
                    setSelectedType(
                      event.target
                        .value as AreaType
                    )

                }

                style={{
                  width:
                    "100%",
                }}

              >


                {AREA_TYPES.map(
                  type => (

                    <option

                      key={
                        type
                      }

                      value={
                        type
                      }

                    >

                      {
                        type
                      }

                    </option>


                  )
                )}


              </select>


            </label>






            {selectedAreaId && (

              <AreaEditor

                area={
                  areas.find(
                    item =>
                      item.id ===
                      selectedAreaId
                  )
                  ??
                  null
                }


                onChange={
                  updateArea
                }


                onDelete={
                  deleteArea
                }


                onScore={
                  updateScore
                }

              />

            )}






            <div
              style={{
                marginTop:
                  20,
              }}
            >

              <strong>
                合計配点
              </strong>


              <p>
                {
                  areas
                    .filter(
                      item =>
                        item.type ===
                        "小問"
                    )
                    .reduce(
                      (
                        total,
                        item
                      ) =>
                        total +
                        (
                          item.score ??
                          0
                        ),

                      0
                    )
                }
                点
              </p>


            </div>




            <button

              type="button"

              className="button primary"

              onClick={
                saveTemplate
              }

            >

              テンプレート確定

            </button>


          </section>


        </div>


      </section>


    </main>

  );
  // Part4/4


/* =========================================================
   Area Editor
   ========================================================= */


function AreaEditor({
  area,
  onChange,
  onDelete,
  onScore,
}:{
  area:
    | TemplateArea
    | null;


  onChange:
    (
      id:string,
      update:Partial<TemplateArea>
    )=>void;


  onDelete:
    (
      id:string
    )=>void;


  onScore:
    (
      id:string,
      score:number
    )=>void;

}){


  if(
    !area
  ){

    return (

      <p
        className="muted"
      >
        枠を選択してください。
      </p>

    );

  }



  return (

    <div
      style={{
        marginTop:
          16,

        display:
          "grid",

        gap:
          10,
      }}
    >



      <label>

        種類


        <select

          value={
            area.type
          }

          onChange={
            event =>
              onChange(
                area.id,
                {
                  type:
                    event.target
                      .value as AreaType
                }
              )
          }

          style={{
            width:
              "100%",
          }}

        >

          {AREA_TYPES.map(
            type => (

              <option
                key={
                  type
                }

                value={
                  type
                }
              >

                {
                  type
                }

              </option>

            )
          )}


        </select>


      </label>





      {(area.type === "大問" ||
        area.type === "小問") && (

        <label>

          番号


          <input

            value={
              area.number ??
              ""
            }

            onChange={
              event =>
                onChange(
                  area.id,
                  {
                    number:
                      event.target.value
                  }
                )
            }

            style={{
              width:
                "100%",
            }}

          />

        </label>

      )}






      {area.type === "小問" && (

        <label>

          配点


          <input

            type="number"

            min="0"

            value={
              area.score ??
              0
            }

            onChange={
              event =>
                onScore(
                  area.id,
                  Number(
                    event.target.value
                  )
                )
            }

            style={{
              width:
                "100%",
            }}

          />


        </label>

      )}







      <label>

        OCR文字


        <input

          value={
            area.text ??
            ""
          }

          onChange={
            event =>
              onChange(
                area.id,
                {
                  text:
                    event.target.value
                }
              )
          }

          style={{
            width:
              "100%",
          }}

        />


      </label>






      <button

        type="button"

        className="button"

        onClick={() =>
          onDelete(
            area.id
          )
        }

      >

        枠を削除

      </button>



    </div>

  );

}







/* =========================================================
   Detection
   ========================================================= */


function detectType(
  text:string
):AreaType{


  const value =
    text.trim();



  if(
    value.includes(
      "氏名"
    )
  ){

    return "氏名";

  }


  if(
    value.includes(
      "クラス"
    )
  ){

    return "クラス";

  }


  if(
    value.includes(
      "QR"
    )
  ){

    return "生徒QR";

  }


  if(
    /^問?\d+/.test(
      value
    )
  ){

    return "小問";

  }


  if(
    value.includes(
      "合計"
    )
    ||
    value.includes(
      "点"
    )
  ){

    return "得点欄";

  }


  return "解答欄";

}







/* =========================================================
   ID
   ========================================================= */


function createId(){

  if(
    typeof crypto !==
    "undefined"
    &&
    "randomUUID" in crypto
  ){

    return crypto.randomUUID();

  }


  return (
    Date.now()
    +
    "-"
    +
    Math.random()
      .toString(36)
      .slice(2)
  );

}







/* =========================================================
   Primitive
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
