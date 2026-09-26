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

type TestRow =
  Test;


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

  saving:boolean;

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
  useState<UserRole|null>(
    null
  );


  const [
    tests,
    setTests,
  ] =
  useState<TestRow[]>(
    []
  );


  const [
    templates,
    setTemplates,
  ] =
  useState<AnswerTemplate[]>(
    []
  );


  const [
    gradingTemplate,
    setGradingTemplate,
  ] =
  useState<GradingTemplate|null>(
    null
  );


  const [
    questions,
    setQuestions,
  ] =
  useState<QuestionRow[]>(
    []
  );


  const [
    answers,
    setAnswers,
  ] =
  useState<QuestionAnswerCard[]>(
    []
  );


  const [
    selectedTestId,
    setSelectedTestId,
  ] =
  useState("");


  const [
    selectedTemplateId,
    setSelectedTemplateId,
  ] =
  useState("");


  const [
    selectedQuestionId,
    setSelectedQuestionId,
  ] =
  useState("");


  const [
    loading,
    setLoading,
  ] =
  useState(true);


  const [
    loadingAnswers,
    setLoadingAnswers,
  ] =
  useState(false);


  const [
    loadingQuestions,
    setLoadingQuestions,
  ] =
  useState(false);


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
    markMode,
    setMarkMode,
  ] =
  useState<MarkMode|null>(
    null
  );


  const [
    saving,
    setSaving,
  ] =
  useState(false);



  /* =======================================================
     Initialize
     ======================================================= */

  useEffect(()=>{
    void initialize();
  },[]);



  async function initialize(){

    try{

      setLoading(true);

      setError("");


      const user =
        await getAppUser(
          auth.currentUser
        );


      if(!user){

        throw new Error(
          "ログインしてください。"
        );

      }


      if(
        user.role === "生徒"
      ){

        throw new Error(
          "採点権限がありません。"
        );

      }


      setRole(
        user.role
      );


      if(
        !user.organizationId
      ){

        throw new Error(
          "所属組織がありません。"
        );

      }


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
  // Part2/4

  /* =======================================================
     Selected test
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



  /* =======================================================
     Load template
     ======================================================= */

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

      setGradingTemplate(
        null
      );

      return;

    }


    void loadTemplate(
      selectedTemplateId
    );


  },[
    selectedTemplateId
  ]);





  async function loadTemplate(
    templateId:string
  ){

    try{

      const template =
        await loadGradingTemplate(
          templateId
        );


      setGradingTemplate(
        template
      );


    }catch(error){

      console.error(
        error
      );

      setGradingTemplate(
        null
      );

    }

  }





  /* =======================================================
     Load questions
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

    try{

      setLoadingQuestions(
        true
      );


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
              questionOrder(a)
              -
              questionOrder(b)
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


    }catch(error){

      console.error(
        error
      );

      setError(
        userError(
          error,
          "問題を取得できませんでした。"
        )
      );

    }finally{

      setLoadingQuestions(
        false
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
     Load answers for selected question
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

    try{

      setLoadingAnswers(
        true
      );


      const loaded =
        await getAllAnswers(
          test.testId ||
          test.id,

          test.subject
        );



      const cards =
        await Promise.all(
          loaded.map(
            async (
              answer
            )=>{


              let imageUrl:
                string |
                null =
                null;


              let result:
                GradingResult |
                null =
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
                  selectedArea?.area
                  ??
                  null,


                result,


                selected:
                  false,


                saving:
                  false,

              };

            }
          )
        );


      setAnswers(
        cards
      );


    }catch(error){

      console.error(
        error
      );


      setError(
        userError(
          error,
          "答案を取得できませんでした。"
        )
      );


    }finally{

      setLoadingAnswers(
        false
      );

    }

  }
  // Part3/4


  /* =======================================================
     Selection
     ======================================================= */

  function toggleAnswer(
    answerId:string
  ){

    setAnswers(
      (
        current
      ) =>
        current.map(
          (
            card
          ) =>
            card.answer.id ===
            answerId
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
      (
        current
      ) =>
        current.map(
          (
            card
          )=>({

            ...card,

            selected:
              true,

          })
        )
    );

  }




  function clearSelect(){

    setAnswers(
      (
        current
      ) =>
        current.map(
          (
            card
          )=>({

            ...card,

            selected:
              false,

          })
        )
    );

  }





  const selectedCount =
    answers.filter(
      (
        item
      ) =>
        item.selected
    )
    .length;






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
        (
          card
        ) =>
          card.selected
      );


    if(
      targets.length ===
      0
    ){

      setError(
        "答案を選択してください。"
      );

      return;

    }



    if(
      mark ===
      "△"
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
        const card of
          targets
      ){

        await saveMark(
          card,
          mark,
          selectedQuestion
        );

      }



      setAnswers(
        (
          current
        ) =>
          current.map(
            (
              card
            ) =>
              card.selected
                ? {

                    ...card,


                    selected:
                      false,


                    result:
                      createLocalResult(
                        card.result,
                        selectedQuestion,
                        mark
                      ),

                  }
                :
                  card
          )
      );


      setMessage(
        `${targets.length}件に${mark}を付けました。`
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





  async function applyPartial(
    score:number
  ){

    if(
      !selectedQuestion
    ){
      return;
    }


    const targets =
      answers.filter(
        (
          card
        ) =>
          card.selected
      );


    try{

      setSaving(
        true
      );


      for(
        const card of
          targets
      ){

        await saveMark(
          card,
          "△",
          selectedQuestion,
          score
        );

      }



      setAnswers(
        (
          current
        ) =>
          current.map(
            (
              card
            ) =>
              card.selected
                ? {

                    ...card,

                    selected:
                      false,

                    result:
                      createLocalResult(
                        card.result,
                        selectedQuestion,
                        "△",
                        score
                      ),

                  }
                :
                  card
          )
      );


      setMarkMode(
        null
      );


    }catch(error){

      setError(
        userError(
          error,
          "部分点保存に失敗しました。"
        )
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
    scoreOverride?:number
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



    const newResult =
      createLocalResult(
        results.find(
          (
            item:GradingResult
          ) =>
            item.questionId ===
            question.id
        )
        ??
        null,

        question,

        mark,

        scoreOverride
      );



    const index =
      results.findIndex(
        (
          item:GradingResult
        ) =>
          item.questionId ===
          question.id
      );



    if(
      index >=
      0
    ){

      results[index] =
        newResult;

    }else{

      results.push(
        newResult
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
     Keyboard
     ======================================================= */


  useEffect(()=>{


    function keyDown(
      event:KeyboardEvent
    ){


      const target =
        event.target;



      if(
        target instanceof
          HTMLInputElement
        ||
        target instanceof
          HTMLTextAreaElement
        ||
        target instanceof
          HTMLSelectElement
      ){

        return;

      }



      if(
        event.key ===
        "k"
        ||
        event.key ===
        "K"
      ){

        void applyMark(
          "○"
        );

      }



      if(
        event.key ===
        "l"
        ||
        event.key ===
        "L"
      ){

        void applyMark(
          "×"
        );

      }



      if(
        event.key ===
        "Escape"
      ){

        clearSelect();

        setMarkMode(
          null
        );

      }

    }



    window.addEventListener(
      "keydown",
      keyDown
    );


    return ()=>{

      window.removeEventListener(
        "keydown",
        keyDown
      );

    };


  },[
    answers,
    selectedQuestion
  ]);
  // Part4/4


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
                "1fr 1fr",

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
                  (
                    test
                  ) => (

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
                  (
                    question
                  ) => (

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

              marginBottom:
                12,
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
                clearSelect
              }
            >
              解除
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


          </div>





          {markMode ===
            "△" && (

            <div
              style={{
                display:
                  "flex",

                gap:
                  8,

                marginBottom:
                  12,
              }}
            >

              {createScoreList(
                selectedQuestion?.maxScore ??
                0
              ).map(
                (
                  score
                ) => (

                  <button
                    key={
                      score
                    }

                    type="button"

                    className="button"

                    onClick={() =>
                      void applyPartial(
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






          <div
            style={{
              display:
                "grid",

              gridTemplateColumns:
                "repeat(auto-fit,minmax(220px,1fr))",

              gap:
                12,
            }}
          >



            {/* 模範解答 */}

            <div
              className="card"
            >

              <strong>
                模範解答
              </strong>


              <div
                style={{
                  marginTop:
                    12,

                  textAlign:
                    "center",
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
              (
                card
              ) => (

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

}





/* =========================================================
   Answer card
   ========================================================= */


function AnswerCardView({
  card,
  onToggle,
}:{
  card:
    QuestionAnswerCard;

  onToggle:
    (
      id:string
    )=>void;
}){


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

        background:
          "#fff",

        padding:
          0,

        borderRadius:
          8,

        overflow:
          "hidden",
      }}
    >

      <div
        style={{
          position:
            "absolute",

          left:
            8,

          top:
            8,

          zIndex:
            2,
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




      {card.imageUrl ? (

        <img

          src={
            card.imageUrl
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

      ):(
        <div>
          答案なし
        </div>
      )}



      {card.result?.mark && (

        <div
          style={{
            fontSize:
              28,

            fontWeight:
              700,
          }}
        >

          {
            card.result.mark
          }

        </div>

      )}

    </button>

  );

}
// helpers追加部分

/* =========================================================
   Create local result
   ========================================================= */

function createLocalResult(
  previous:
    | GradingResult
    | null,

  question:
    QuestionRow,

  mark:
    GradingMark,

  scoreOverride?: number
): GradingResult {


  let score =
    0;


  if(
    scoreOverride !==
    undefined
  ){

    score =
      Math.max(
        0,
        Math.min(
          question.maxScore,
          scoreOverride
        )
      );

  }else if(
    mark ===
    "○"
  ){

    score =
      question.maxScore;

  }



  return {

    questionId:
      question.id,


    questionNumber:
      question.questionNumber,


    answerText:
      previous?.answerText ??
      "",


    mark,


    score,


    maxScore:
      question.maxScore,


    confidence:
      previous?.confidence ??
      1,


    reviewRequired:
      mark ===
      "△"
      ||
      question.requiresReview,


    reason:
      mark ===
      "○"
        ? "正解"
        :
          mark ===
          "×"
            ? "不正解"
            : "部分点",


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

  if(
    max <=
    0
  ){

    return [
      0
    ];

  }


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
   Normalize test
   ========================================================= */


function normalizeTest(
  id:string,

  data:
    Record<
      string,
      unknown
    >
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
      nullableString(
        data.originalTestId
      ),


    automaticGrading:
      data.automaticGrading ===
      true,


    createdAt:
      data.createdAt,


    updatedAt:
      data.updatedAt,

  };

}





/* =========================================================
   Question order
   ========================================================= */


function questionOrder(
  question:
    QuestionRow
){

  const value =
    Number(
      question.questionNumber
    );


  return Number.isFinite(
    value
  )
    ? value
    : Number.MAX_SAFE_INTEGER;

}





/* =========================================================
   Error
   ========================================================= */


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

    return (
      "この操作を実行する権限がありません。"
    );

  }


  if(
    /[ぁ-んァ-ヶ一-龯]/.test(
      message
    )
  ){

    return message;

  }


  return fallback;

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



function nullableString(
  value:unknown
){

  return typeof value ===
    "string"
    ? value
    : null;

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
