"use client";

import {
  ChangeEvent,
  useMemo,
  useState,
} from "react";

import SchoolHeader from "@/components/SchoolHeader";
import StepBar from "@/components/StepBar";
import AnswerViewer from "@/components/AnswerViewer";
import RegionEditor, {
  Region,
} from "@/components/RegionEditor";

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

type UploadedFile = {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
};

type Subject = {
  id: string;
  name: string;
};

const subjects: Subject[] = [
  {
    id: "japanese",
    name: "国語",
  },
  {
    id: "math",
    name: "数学",
  },
  {
    id: "english",
    name: "英語",
  },
];

export default function AnswersPage() {
  const [step, setStep] =
    useState<Step>(1);

  const [testName, setTestName] =
    useState("第1回確認テスト");

  const [subjectId, setSubjectId] =
    useState("math");

  const [answerFile, setAnswerFile] =
    useState<UploadedFile | null>(null);

  const [studentFiles, setStudentFiles] =
    useState<UploadedFile[]>([]);

  const [regions, setRegions] =
    useState<Region[]>([]);

  const [isProcessing, setIsProcessing] =
    useState(false);

  const [progress, setProgress] =
    useState(0);

  const [published, setPublished] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const selectedSubject = useMemo(
    () =>
      subjects.find(
        (subject) =>
          subject.id === subjectId
      ),
    [subjectId]
  );

  function createLocalFile(
    file: File
  ): UploadedFile {
    return {
      id:
        typeof crypto !==
        "undefined" &&
        "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${file.name}`,
      name: file.name,
      size: file.size,
      type: file.type,
      url: URL.createObjectURL(file),
    };
  }

  function handleAnswerFile(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    if (!file) return;

    setAnswerFile(
      createLocalFile(file)
    );

    setMessage("");

    event.target.value = "";
  }

  function handleStudentFiles(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const files = Array.from(
      event.target.files ?? []
    );

    if (files.length === 0) return;

    const uploaded =
      files.map(createLocalFile);

    setStudentFiles(
      (current) => [
        ...current,
        ...uploaded,
      ]
    );

    setMessage(
      `${files.length}枚の答案を追加しました。`
    );

    event.target.value = "";
  }

  function goNext() {
    setMessage("");

    setStep((current) =>
      Math.min(
        current + 1,
        8
      ) as Step
    );
  }

  function goBack() {
    setMessage("");

    setStep((current) =>
      Math.max(
        current - 1,
        1
      ) as Step
    );
  }

  function finishRegionSetting() {
    if (regions.length === 0) {
      setMessage(
        "少なくとも1つの枠を設定してください。"
      );
      return;
    }

    setMessage(
      `${regions.length}個の枠を登録しました。`
    );

    goNext();
  }

  async function startAutoGrading() {
    setIsProcessing(true);
    setProgress(0);
    setMessage("");

    for (
      let value = 0;
      value <= 100;
      value += 10
    ) {
      await new Promise(
        (resolve) =>
          setTimeout(resolve, 120)
      );

      setProgress(value);
    }

    setIsProcessing(false);

    setMessage(
      "自動採点が完了しました。"
    );

    goNext();
  }

  function completeFirstReview() {
    setMessage(
      "一次チェックが完了しました。"
    );

    goNext();
  }

  function completeSecondReview() {
    setMessage(
      "二次チェックが完了しました。"
    );

    goNext();
  }

  function confirmGrading() {
    setMessage(
      "採点を確定しました。"
    );

    goNext();
  }

  function publishTest() {
    setPublished(true);

    setMessage(
      "テスト全体を公開しました。"
    );
  }

  function renderStep() {
    switch (step) {
      case 1:
        return (
          <section className="stepCard">
            <h1>STEP 1</h1>

            <h2>
              解答登録
            </h2>

            <p>
              正解となる解答画像またはPDFを登録してください。
            </p>

            <label>
              テスト名

              <input
                value={testName}
                onChange={(event) =>
                  setTestName(
                    event.target.value
                  )
                }
              />
            </label>

            <label>
              教科

              <select
                value={subjectId}
                onChange={(event) =>
                  setSubjectId(
                    event.target.value
                  )
                }
              >
                {subjects.map(
                  (subject) => (
                    <option
                      key={subject.id}
                      value={subject.id}
                    >
                      {subject.name}
                    </option>
                  )
                )}
              </select>
            </label>

            <label>
              解答ファイル

              <input
                type="file"
                accept=".pdf,image/*"
                onChange={
                  handleAnswerFile
                }
              />
            </label>

            {answerFile && (
              <div className="listCard">
                <div className="listRow">
                  <strong>
                    {answerFile.name}
                  </strong>

                  <span>
                    {Math.ceil(
                      answerFile.size /
                        1024
                    )}
                    KB
                  </span>

                  <span>
                    登録済み
                  </span>
                </div>
              </div>
            )}

            <div className="actionBar">
              <button
                className="primaryButton"
                disabled={
                  !answerFile
                }
                onClick={goNext}
              >
                次へ：採点設定
              </button>
            </div>
          </section>
        );

      case 2:
        return (
          <section className="stepCard">
            <h1>STEP 2</h1>

            <h2>
              採点設定
            </h2>

            <p>
              解答画像を見ながら、大問・小問・解答枠・得点枠・採点結果枠などを設定します。
            </p>

            {answerFile ? (
              <RegionEditor
                imageUrl={
                  answerFile.url
                }
                regions={regions}
                onChange={
                  setRegions
                }
              />
            ) : (
              <p>
                解答ファイルがありません。
              </p>
            )}

            <div className="actionBar">
              <button
                className="secondaryButton"
                onClick={goBack}
              >
                戻る
              </button>

              <button
                className="primaryButton"
                onClick={
                  finishRegionSetting
                }
              >
                採点設定を確定
              </button>
            </div>
          </section>
        );

      case 3:
        return (
          <section className="stepCard">
            <h1>STEP 3</h1>

            <h2>
              生徒答案
            </h2>

            <p>
              生徒答案をまとめてアップロードします。
              QRコードから生徒を自動識別します。
            </p>

            <input
              type="file"
              multiple
              accept=".pdf,image/*"
              onChange={
                handleStudentFiles
              }
            />

            <div className="listCard">
              {studentFiles.length ===
              0 ? (
                <div className="emptyState">
                  まだ答案がありません。
                </div>
              ) : (
                studentFiles.map(
                  (file) => (
                    <div
                      className="listRow"
                      key={file.id}
                    >
                      <strong>
                        {file.name}
                      </strong>

                      <span>
                        {Math.ceil(
                          file.size /
                            1024
                        )}
                        KB
                      </span>

                      <span>
                        アップロード済み
                      </span>
                    </div>
                  )
                )
              )}
            </div>

            <div className="actionBar">
              <button
                className="secondaryButton"
                onClick={goBack}
              >
                戻る
              </button>

              <button
                className="primaryButton"
                disabled={
                  studentFiles.length ===
                  0
                }
                onClick={goNext}
              >
                次へ：自動採点
              </button>
            </div>
          </section>
        );

      case 4:
        return (
          <section className="stepCard">
            <h1>STEP 4</h1>

            <h2>
              自動採点
            </h2>

            <p>
              QR認識・画像補正・枠位置合わせ・OCR・自動採点を実行します。
            </p>

            {isProcessing && (
              <>
                <div
                  style={{
                    height: 12,
                    background:
                      "#eee",
                    borderRadius: 6,
                    overflow:
                      "hidden",
                    margin:
                      "24px 0",
                  }}
                >
                  <div
                    style={{
                      width: `${progress}%`,
                      height: "100%",
                      background:
                        "#222",
                      transition:
                        "width .15s",
                    }}
                  />
                </div>

                <p>
                  処理中：
                  {progress}%
                </p>
              </>
            )}

            {!isProcessing && (
              <button
                className="primaryButton"
                onClick={
                  startAutoGrading
                }
              >
                自動採点を開始
              </button>
            )}
          </section>
        );

      case 5:
        return (
          <section className="stepCard">
            <h1>STEP 5</h1>

            <h2>
              一次確認
            </h2>

            <p>
              自動採点結果を講師が確認します。
            </p>

            <div className="selectionPanel">
              <strong>
                ○・△・×を確認
              </strong>

              <p>
                △の場合は部分点を入力します。
              </p>
            </div>

            <button
              className="primaryButton"
              onClick={
                completeFirstReview
              }
            >
              一次チェック完了
            </button>
          </section>
        );

      case 6:
        return (
          <section className="stepCard">
            <h1>STEP 6</h1>

            <h2>
              二次確認
            </h2>

            <p>
              一次チェック担当者とは別の確認者が再確認します。
            </p>

            <div className="selectionPanel">
              <strong>
                二次確認待ち
              </strong>
            </div>

            <button
              className="primaryButton"
              onClick={
                completeSecondReview
              }
            >
              二次チェック完了
            </button>
          </section>
        );

      case 7:
        return (
          <section className="stepCard">
            <h1>STEP 7</h1>

            <h2>
              採点確定
            </h2>

            <p>
              未確認答案、部分点、採点エラーを確認してから確定します。
            </p>

            <div className="selectionPanel">
              <strong>
                採点確定前チェック
              </strong>

              <p>
                一次・二次チェックが完了していることを確認してください。
              </p>
            </div>

            <button
              className="primaryButton"
              onClick={
                confirmGrading
              }
            >
              採点を確定する
            </button>
          </section>
        );

      case 8:
        return (
          <section className="stepCard">
            <h1>STEP 8</h1>

            <h2>
              テスト公開
            </h2>

            <p>
              全教科の採点確定後、テスト全体を一括公開します。
            </p>

            {published ? (
              <div className="selectionPanel">
                <strong>
                  公開済み
                </strong>

                <p>
                  生徒側にテスト全体が公開されています。
                </p>
              </div>
            ) : (
              <button
                className="primaryButton"
                onClick={
                  publishTest
                }
              >
                テスト全体を公開
              </button>
            )}
          </section>
        );

      default:
        return null;
    }
  }

  return (
    <main className="page">
      <SchoolHeader
        title={
          selectedSubject
            ? `${testName} / ${selectedSubject.name}`
            : "答案アップロード"
        }
      />

      <section className="content">
        <StepBar
          currentStep={step}
        />

        {message && (
          <div className="selectionPanel">
            {message}
          </div>
        )}

        {renderStep()}
      </section>
    </main>
  );
}
