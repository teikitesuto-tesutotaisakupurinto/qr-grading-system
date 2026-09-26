"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
} from "firebase/firestore";

import {
  auth,
  db,
} from "@/lib/firebase";

import {
  getAppUser,
} from "@/lib/auth";

import {
  getAllAnswers,
  getAnswerWithUrl,
  type Answer,
} from "@/lib/answers";

import {
  getGradingResult,
  saveFirstReview,
} from "@/lib/grading";

import {
  getTemplatesByTest,
  type AnswerTemplate,
} from "@/lib/template";

import {
  loadGradingTemplate,
  type GradingTemplate,
  type QuestionArea,
} from "@/lib/grading-template";

import type {
  GradingMark,
  GradingResult,
  Test,
  TestQuestion,
  UserRole,
} from "@/lib/types";


/* =========================================================
   Types
   ========================================================= */

type QuestionRow =
  TestQuestion & {
    order:number;
  };


type QuestionAnswerCard = {
  answer:Answer;

  questionId:string;

  imageUrl:string|null;

  cropArea:{
    x:number;
    y:number;
    width:number;
    height:number;
  } | null;

  result:
    | GradingResult
    | null;

  selected:boolean;
};


type MarkMode =
  | "○"
  | "×"
  | "△";


/* =========================================================
   Page
   ========================================================= */

export default function GradingPage(){

  const [
    role,
    setRole,
  ] =
  useState<UserRole|null>(null);


  const [
    tests,
    setTests,
  ] =
  useState<Test[]>([]);


  const [
    selectedTestId,
    setSelectedTestId,
  ] =
  useState("");


  const [
    templates,
    setTemplates,
  ] =
  useState<AnswerTemplate[]>([]);


  const [
    selectedTemplateId,
    setSelectedTemplateId,
  ] =
  useState("");


  const [
    gradingTemplate,
    setGradingTemplate,
  ] =
  useState<GradingTemplate|null>(null);


  const [
    questions,
    setQuestions,
  ] =
  useState<QuestionRow[]>([]);


  const [
    selectedQuestionId,
    setSelectedQuestionId,
  ] =
  useState("");


  const [
    answers,
    setAnswers,
  ] =
  useState<QuestionAnswerCard[]>([]);


  const [
    loading,
    setLoading,
  ] =
  useState(true);


  const [
    error,
    setError,
  ] =
  useState("");


  const [
    message,
    setMessage,
  ] =
  useState("");


  const [
    saving,
    setSaving,
  ] =
  useState(false);


  const [
    markMode,
    setMarkMode,
  ] =
  useState<MarkMode|null>(null);


  /* =======================================================
     Init
     ======================================================= */

  useEffect(()=>{
    void initialize();
  },[]);



  async function initialize(){

    try{

      setLoading(true);


      const user =
        await getAppUser(
          auth.currentUser
        );


      if(!user){

        throw new Error(
          "ログインしてください。"
        );

      }


      if(user.role==="生徒"){

        throw new Error(
          "採点権限がありません。"
        );

      }


      setRole(
        user.role
      );


      const snapshot =
        await getDocs(
          query(
            collection(
              db,
              "tests"
            ),

            where(
              "organizationId",
              "==",
              user.organizationId
            ),

            where(
              "active",
              "==",
              true
            ),

            orderBy(
              "createdAt",
              "desc"
            )
          )
        );


      const loaded =
        snapshot.docs.map(
          (
            item
          ) =>
            normalizeTest(
              item.id,
              item.data()
            )
        );


      setTests(
        loaded
      );


      if(
        loaded.length
      ){

        setSelectedTestId(
          loaded[0].id
        );

      }


    }catch(error){

      setError(
        userError(
          error,
          "採点画面を読み込めませんでした。"
        )
      );


    }finally{

      setLoading(
        false
      );

    }

  }
  // Part 2/5


  /* =======================================================
     Template load
     ======================================================= */

  const selectedTest =
    tests.find(
      (
        test
      ) =>
        test.id ===
        selectedTestId
    )
    ??
    null;



  useEffect(()=>{

    if(
      !selectedTest
    ){

      setTemplates([]);

      setSelectedTemplateId("");

      setGradingTemplate(null);

      return;

    }


    void loadTemplates(
      selectedTest
    );


  },[
    selectedTestId
  ]);





  async function loadTemplates(
    test:Test
  ){

    try{

      const result =
        await getTemplatesByTest(
          test.testId ||
          test.id
        );


      setTemplates(
        result
      );


      if(
        result.length > 0
      ){

        setSelectedTemplateId(
          result[0].id
        );

      }


    }catch(error){

      console.error(
        error
      );

      setTemplates([]);

    }

  }





  useEffect(()=>{

    if(
      !selectedTemplateId
    ){

      setGradingTemplate(null);

      return;

    }


    void loadTemplate(
      selectedTemplateId
    );


  },[
    selectedTemplateId
  ]);





  async function loadTemplate(
    id:string
  ){

    const template =
      await loadGradingTemplate(
        id
      );


    setGradingTemplate(
      template
    );

  }





  /* =======================================================
     Questions
     ======================================================= */


  useEffect(()=>{

    if(
      !selectedTest
    ){

      setQuestions([]);

      return;

    }


    void loadQuestions(
      selectedTest
    );


  },[
    selectedTestId
  ]);





  async function loadQuestions(
    test:Test
  ){

    const snapshot =
      await getDocs(
        query(
          collection(
            db,
            "testQuestions"
          ),

          where(
            "testId",
            "==",
            test.id
          )
        )
      );



    const loaded =
      snapshot.docs
      .map(
        (
          item
        )=>{

          const data =
            item.data();


          return {

            id:
              item.id,


            testId:
              test.id,


            questionNumber:
              stringValue(
                data.questionNumber
              ),


            title:
              stringValue(
                data.title
              ),


            maxScore:
              safeNumber(
                data.maxScore
              ),


            gradingMethod:
              data.gradingMethod ===
              "automatic"
                ? "automatic"
                : "manual",


            correctAnswer:
              stringValue(
                data.correctAnswer
              ),


            rubric:
              stringValue(
                data.rubric
              ),


            requiresReview:
              data.requiresReview ===
              true,


            order:
              safeNumber(
                data.order
              ),

          } as QuestionRow;

        }
      )
      .sort(
        (
          a,
          b
        ) =>
          Number(
            a.questionNumber
          )
          -
          Number(
            b.questionNumber
          )
      );



    setQuestions(
      loaded
    );


    if(
      loaded.length
    ){

      setSelectedQuestionId(
        loaded[0].id
      );

    }

  }




  const selectedQuestion =
    questions.find(
      (
        question
      ) =>
        question.id ===
        selectedQuestionId
    )
    ??
    null;




  const selectedArea =
    gradingTemplate?.questions.find(
      (
        question
      ) =>
        question.number ===
        selectedQuestion?.questionNumber
    )
    ??
    null;



  /* =======================================================
     Answers
     ======================================================= */


  useEffect(()=>{

    if(
      !selectedTest ||
      !selectedQuestion
    ){

      setAnswers([]);

      return;

    }


    void loadAnswers(
      selectedTest,
      selectedQuestion
    );


  },[
    selectedTestId,
    selectedQuestionId
  ]);





  async function loadAnswers(
    test:Test,
    question:QuestionRow
  ){

    const loaded =
      await getAllAnswers(
        test.testId ||
        test.id,

        test.subject
      );



    const cards =
      await Promise.all(
        loaded.map(
          async(
            answer
          )=>{

            let imageUrl:
              string|null =
              null;


            let result:
              GradingResult|null =
              null;



            try{

              const image =
                await getAnswerWithUrl(
                  answer.id
                );


              imageUrl =
                image?.signedUrl ??
                null;


            }catch(error){

              console.error(
                error
              );

            }



            try{

              const grading =
                await getGradingResult(
                  answer.id
                );


              result =
                grading?.results?.find(
                  (
                    item:GradingResult
                  ) =>
                    item.questionId ===
                    question.id
                )
                ??
                null;


            }catch(error){

              console.error(
                error
              );

            }



            return {

              answer,

              questionId:
                question.id,


              imageUrl,


              cropArea:
                selectedArea?.area ??
                null,


              result,


              selected:false,

            };


          }
        )
      );



    setAnswers(
      cards
    );

  }
  // Part 3/5


  /* =======================================================
     Selection
     ======================================================= */


  function toggleAnswer(
    id:string
  ){

    setAnswers(
      current =>
        current.map(
          card =>
            card.answer.id === id
              ? {
                  ...card,

                  selected:
                    !card.selected,
                }
              : card
        )
    );

  }





  function selectAll(){

    setAnswers(
      current =>
        current.map(
          card => ({
            ...card,

            selected:
              true,
          })
        )
    );

  }




  function clearSelection(){

    setAnswers(
      current =>
        current.map(
          card => ({
            ...card,

            selected:
              false,
          })
        )
    );

  }




  const selectedCount =
    answers.filter(
      item =>
        item.selected
    ).length;





  /* =======================================================
     Mark
     ======================================================= */


  async function applyMark(
    mark:MarkMode
  ){

    if(
      !selectedQuestion
    ){
      return;
    }


    const targets =
      answers.filter(
        card =>
          card.selected
      );


    if(
      targets.length === 0
    ){

      setError(
        "答案を選択してください。"
      );

      return;

    }



    if(
      mark === "△"
    ){

      setMarkMode(
        "△"
      );

      return;

    }



    try{

      setSaving(
        true
      );


      for(
        const card of targets
      ){

        await saveMark(
          card,
          mark,
          selectedQuestion
        );

      }



      setAnswers(
        current =>
          current.map(
            card =>
              card.selected
                ? {

                    ...card,

                    selected:
                      false,

                    result:
                      createLocalResult(
                        selectedQuestion,
                        mark
                      ),

                  }

                : card
          )
      );


      setMessage(
        `${targets.length}件に${mark}を設定しました。`
      );


    }catch(error){

      setError(
        userError(
          error,
          "採点保存に失敗しました。"
        )
      );


    }finally{

      setSaving(
        false
      );

    }

  }





  async function applyPartialScore(
    score:number
  ){

    if(
      !selectedQuestion
    ){
      return;
    }


    const targets =
      answers.filter(
        card =>
          card.selected
      );


    try{

      setSaving(
        true
      );


      for(
        const card of targets
      ){

        await saveMark(
          card,
          "△",
          selectedQuestion,
          score
        );

      }



      setAnswers(
        current =>
          current.map(
            card =>
              card.selected
                ? {

                    ...card,

                    selected:
                      false,

                    result:
                      createLocalResult(
                        selectedQuestion,
                        "△",
                        score
                      ),

                  }

                : card
          )
      );


      setMarkMode(
        null
      );


    }finally{

      setSaving(
        false
      );

    }

  }





  async function saveMark(
    card:QuestionAnswerCard,
    mark:MarkMode,
    question:QuestionRow,
    score?:number
  ){

    const current =
      await getGradingResult(
        card.answer.id
      );


    const results =
      Array.isArray(
        current?.results
      )
        ? [
            ...current.results
          ]
        :
          [];



    const next =
      createLocalResult(
        question,
        mark,
        score
      );



    const index =
      results.findIndex(
        item =>
          item.questionId ===
          question.id
      );


    if(
      index >= 0
    ){

      results[index] =
        next;

    }else{

      results.push(
        next
      );

    }



    const user =
      await getAppUser();



    if(
      !user
    ){

      throw new Error(
        "ログインしてください。"
      );

    }



    await saveFirstReview(
      {

        answerId:
          card.answer.id,


        testId:
          card.answer.testId,


        subjectId:
          card.answer.subjectId,


        studentNumber:
          card.answer.studentNumber ??
          "",


        reviewerId:
          user.uid,


        results,


        internalNote:
          "",


        publicAnnotation:
          "",

      }
    );

  }






  /* =======================================================
     Keyboard shortcut
     ======================================================= */


  useEffect(()=>{

    function handleKey(
      event:KeyboardEvent
    ){

      const target =
        event.target;


      if(
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ){

        return;

      }


      if(
        event.key === "k" ||
        event.key === "K"
      ){

        void applyMark(
          "○"
        );

      }



      if(
        event.key === "l" ||
        event.key === "L"
      ){

        void applyMark(
          "×"
        );

      }


      if(
        event.key === "Escape"
      ){

        clearSelection();

        setMarkMode(
          null
        );

      }

    }


    window.addEventListener(
      "keydown",
      handleKey
    );


    return ()=>{

      window.removeEventListener(
        "keydown",
        handleKey
      );

    };


  },[
    answers,
    selectedQuestion
  ]);
  // Part 4/5


  /* =======================================================
     Render
     ======================================================= */


  if(
    loading
  ){

    return (
      <main className="page">

        <section className="content">

          <h1>
            採点
          </h1>

          <p>
            読み込み中...
          </p>

        </section>

      </main>
    );

  }




  return (

    <main
      className="page"
    >

      <section
        className="content"
        style={{
          maxWidth:
            1800,

          margin:
            "0 auto",
        }}
      >



        <header
          className="pageHeader"
        >

          <div>

            <h1>
              採点
            </h1>


            <p
              className="muted"
            >
              問題ごとに答案を並べて採点します。
            </p>


          </div>

        </header>




        {error && (

          <div
            className="errorMessage"
          >

            {
              error
            }

          </div>

        )}




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

          <div
            style={{
              display:
                "grid",

              gridTemplateColumns:
                "1fr 1fr 1fr",

              gap:
                12,
            }}
          >


            <label>

              テスト


              <select

                value={
                  selectedTestId
                }

                onChange={(
                  event
                ) =>
                  setSelectedTestId(
                    event.target.value
                  )
                }

                style={{
                  width:
                    "100%",
                }}

              >

                {tests.map(
                  test => (

                    <option
                      key={
                        test.id
                      }

                      value={
                        test.id
                      }
                    >

                      {
                        test.name
                      }

                    </option>

                  )
                )}

              </select>

            </label>





            <label>

              テンプレート


              <select

                value={
                  selectedTemplateId
                }

                onChange={(
                  event
                ) =>
                  setSelectedTemplateId(
                    event.target.value
                  )
                }

                style={{
                  width:
                    "100%",
                }}

              >

                {templates.map(
                  template => (

                    <option
                      key={
                        template.id
                      }

                      value={
                        template.id
                      }
                    >

                      テンプレート

                      {
                        template.id.slice(
                          0,
                          8
                        )
                      }

                    </option>

                  )
                )}

              </select>


            </label>






            <label>

              問題


              <select

                value={
                  selectedQuestionId
                }

                onChange={(
                  event
                ) =>
                  setSelectedQuestionId(
                    event.target.value
                  )
                }

                style={{
                  width:
                    "100%",
                }}

              >

                {questions.map(
                  question => (

                    <option
                      key={
                        question.id
                      }

                      value={
                        question.id
                      }
                    >

                      問
                      {
                        question.questionNumber
                      }

                    </option>

                  )
                )}

              </select>


            </label>


          </div>


        </section>







        <section
          className="card"
          style={{
            marginTop:
              16,
          }}
        >

          <div
            style={{
              display:
                "flex",

              gap:
                8,

              alignItems:
                "center",

              flexWrap:
                "wrap",
            }}
          >

            <button
              type="button"
              className="button"
              onClick={
                selectAll
              }
            >

              全選択

            </button>



            <button
              type="button"
              className="button"
              onClick={
                clearSelection
              }
            >

              選択解除

            </button>




            <button
              type="button"
              className="button"
              disabled={
                saving
              }

              onClick={() =>
                void applyMark(
                  "○"
                )
              }
            >

              ○

            </button>




            <button
              type="button"
              className="button"
              disabled={
                saving
              }

              onClick={() =>
                void applyMark(
                  "×"
                )
              }
            >

              ×

            </button>




            <button
              type="button"
              className="button"
              disabled={
                saving
              }

              onClick={() =>
                setMarkMode(
                  "△"
                )
              }
            >

              △

            </button>




            <span
              className="muted"
            >

              {
                selectedCount
              }
              件選択

            </span>



            <span
              className="muted"
            >

              K:
              ○

              /
              L:
              ×

            </span>


          </div>





          {markMode ===
            "△" && (

            <div
              style={{
                marginTop:
                  12,

                display:
                  "flex",

                gap:
                  8,
              }}
            >

              {createScoreList(
                selectedQuestion?.maxScore ??
                0
              ).map(
                score => (

                  <button
                    key={
                      score
                    }

                    type="button"

                    className="button"

                    onClick={() =>
                      void applyPartialScore(
                        score
                      )
                    }
                  >

                    {
                      score
                    }
                    点

                  </button>

                )
              )}

            </div>

          )}

        </section>






        <section
          className="card"
          style={{
            marginTop:
              16,
          }}
        >


          <div
            style={{
              display:
                "grid",

              gridTemplateColumns:
                "repeat(auto-fit,minmax(230px,1fr))",

              gap:
                12,
            }}
          >



            {/* 模範解答 */}

            <div
              style={{
                border:
                  "2px solid #111",

                borderRadius:
                  8,

                overflow:
                  "hidden",
              }}
            >

              <div
                style={{
                  padding:
                    8,

                  background:
                    "#111",

                  color:
                    "#fff",

                  textAlign:
                    "center",
                }}
              >

                模範解答

              </div>



              <div
                style={{
                  minHeight:
                    250,

                  display:
                    "flex",

                  alignItems:
                    "center",

                  justifyContent:
                    "center",

                  padding:
                    15,
                }}
              >

                {
                  selectedQuestion?.correctAnswer
                  ||
                  "未設定"
                }


              </div>


            </div>





            {answers.map(
              card => (

                <AnswerCardView

                  key={
                    card.answer.id
                  }

                  card={
                    card
                  }

                  onToggle={
                    toggleAnswer
                  }

                />

              )
            )}



          </div>


        </section>


      </section>


    </main>

  );
  // Part 5/5


/* =========================================================
   Answer Card
   ========================================================= */

function AnswerCardView({
  card,
  onToggle,
}: {
  card:
    QuestionAnswerCard;

  onToggle:
    (
      id:string
    ) => void;
}) {


  return (

    <button

      type="button"

      onClick={() =>
        onToggle(
          card.answer.id
        )
      }

      style={{
        position:
          "relative",

        border:
          card.selected
            ? "3px solid #111"
            : "1px solid #ccc",

        borderRadius:
          8,

        overflow:
          "hidden",

        background:
          "#fff",

        padding:
          0,

        cursor:
          "pointer",

        textAlign:
          "left",
      }}

    >


      <div
        style={{
          position:
            "absolute",

          top:
            8,

          left:
            8,

          zIndex:
            5,

          background:
            "#fff",

          borderRadius:
            4,

          padding:
            3,
        }}
      >

        <input
          type="checkbox"

          checked={
            card.selected
          }

          readOnly

        />

      </div>



      <AnswerCrop

        imageUrl={
          card.imageUrl
        }

        area={
          card.cropArea
        }

      />



      {card.result?.mark && (

        <div
          style={{
            position:
              "absolute",

            right:
              10,

            bottom:
              10,

            width:
              45,

            height:
              45,

            borderRadius:
              "50%",

            background:
              "#fff",

            border:
              "3px solid #111",

            display:
              "flex",

            alignItems:
              "center",

            justifyContent:
              "center",

            fontSize:
              26,

            fontWeight:
              700,
          }}
        >

          {
            card.result.mark
          }

        </div>

      )}



      {card.result && (

        <div
          style={{
            textAlign:
              "center",

            padding:
              8,

            borderTop:
              "1px solid #eee",

            fontSize:
              12,
          }}
        >

          {
            card.result.score
          }

          /

          {
            card.result.maxScore
          }

          点

        </div>

      )}

    </button>

  );

}





/* =========================================================
   Crop
   ========================================================= */


function AnswerCrop({
  imageUrl,
  area,
}:{
  imageUrl:
    string|null;

  area:
    | {
        x:number;

        y:number;

        width:number;

        height:number;

      }
    | null;
}){


  if(
    !imageUrl
  ){

    return (

      <div
        style={{
          height:
            260,

          display:
            "flex",

          alignItems:
            "center",

          justifyContent:
            "center",

          color:
            "#777",
        }}
      >

        答案なし

      </div>

    );

  }




  if(
    !area
  ){

    return (

      <img

        src={
          imageUrl
        }

        alt=""

        style={{
          width:
            "100%",

          aspectRatio:
            "4/3",

          objectFit:
            "contain",
        }}

      />

    );

  }




  return (

    <div
      style={{
        width:
          "100%",

        aspectRatio:
          "4/3",

        overflow:
          "hidden",

        background:
          "#f5f5f5",
      }}
    >

      <img

        src={
          imageUrl
        }

        alt=""

        style={{
          position:
            "relative",

          left:
            -area.x,

          top:
            -area.y,

          maxWidth:
            "none",

        }}

      />

    </div>

  );

}






/* =========================================================
   Result
   ========================================================= */

function createLocalResult(
  question:QuestionRow,
  mark:GradingMark,
  score?:number
):GradingResult{


  let point =
    0;


  if(
    score !==
    undefined
  ){

    point =
      Math.max(
        0,
        Math.min(
          question.maxScore,
          score
        )
      );

  }
  else if(
    mark ===
    "○"
  ){

    point =
      question.maxScore;

  }



  return {

    questionId:
      question.id,


    questionNumber:
      question.questionNumber,


    answerText:
      "",


    mark,


    score:
      point,


    maxScore:
      question.maxScore,


    confidence:
      1,


    reviewRequired:
      mark ===
      "△",


    reason:
      "手動採点",


    rubric:
      question.rubric,

  };

}






/* =========================================================
   Score list
   ========================================================= */

function createScoreList(
  max:number
){

  return Array.from(
    {
      length:
        max + 1,
    },

    (
      _,
      index
    ) =>
      index

  );

}






/* =========================================================
   Helpers
   ========================================================= */


function normalizeTest(
  id:string,
  data:Record<string,unknown>
):Test{

  return {

    id,

    organizationId:
      stringValue(
        data.organizationId
      ),

    schoolId:
      stringValue(
        data.schoolId
      ),

    testId:
      stringValue(
        data.testId
      )
      ||
      id,

    name:
      stringValue(
        data.name
      ),

    subject:
      stringValue(
        data.subject
      ),

    grade:
      stringValue(
        data.grade
      ),

    className:
      stringValue(
        data.className
      ),

    examDate:
      stringValue(
        data.examDate
      ),

    totalScore:
      safeNumber(
        data.totalScore
      ),

    active:
      data.active !==
      false,

    isRetest:
      data.isRetest ===
      true,

    originalTestId:
      null,

    automaticGrading:
      false,

    createdAt:
      data.createdAt,

    updatedAt:
      data.updatedAt,

  };

}



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



function userError(
  error:unknown,
  fallback:string
){

  const message =
    error instanceof Error
      ? error.message
      : String(
          error ??
          ""
        );


  if(
    message.includes(
      "Missing or insufficient permissions"
    )
  ){

    return "権限がありません。";

  }


  return message ||
    fallback;

}
