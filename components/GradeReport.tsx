"use client";

export type SubjectResult = {
  subject: string;
  score: number;
  maxScore: number;
  percentage: number;
  deviationScore?: number;
  rank?: number;
};

export type SectionResult = {
  name: string;
  score: number;
  maxScore: number;
};

export type GradeReportData = {
  studentName: string;
  studentNumber: string;
  testName: string;
  testDate: string;
  subjects: SubjectResult[];
  sections?: SectionResult[];
  totalScore: number;
  totalMaxScore: number;
  totalPercentage: number;
  totalDeviationScore?: number;
  overallRank?: number;
  schoolRank?: number;
  gradeRank?: number;
  classRank?: number;
  isRetest?: boolean;
};

type GradeReportProps = {
  data: GradeReportData;
};

export default function GradeReport({
  data,
}: GradeReportProps) {
  return (
    <article className="gradeReport">
      <header className="gradeReportHeader">
        <div>
          <h1>成績表</h1>

          {data.isRetest && (
            <span className="retestBadge">
              追試
            </span>
          )}
        </div>

        <div className="gradeReportMeta">
          <div>{data.testName}</div>
          <div>{data.testDate}</div>
        </div>
      </header>

      <section className="studentInfo">
        <div>
          <span>氏名</span>
          <strong>{data.studentName}</strong>
        </div>

        <div>
          <span>生徒番号</span>
          <strong>{data.studentNumber}</strong>
        </div>
      </section>

      <section className="subjectResults">
        <h2>教科別成績</h2>

        <table>
          <thead>
            <tr>
              <th>教科</th>
              <th>得点</th>
              <th>得点率</th>
              <th>偏差値</th>
              <th>順位</th>
            </tr>
          </thead>

          <tbody>
            {data.subjects.map((subject) => (
              <tr key={subject.subject}>
                <td>{subject.subject}</td>

                <td>
                  {subject.score} / {subject.maxScore}
                </td>

                <td>
                  {subject.percentage.toFixed(1)}%
                </td>

                <td>
                  {subject.deviationScore !==
                  undefined
                    ? subject.deviationScore.toFixed(1)
                    : "-"}
                </td>

                <td>
                  {subject.rank !== undefined
                    ? `${subject.rank}位`
                    : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {data.sections &&
        data.sections.length > 0 && (
          <section className="sectionResults">
            <h2>大問別成績</h2>

            <table>
              <thead>
                <tr>
                  <th>大問</th>
                  <th>得点</th>
                  <th>配点</th>
                  <th>得点率</th>
                </tr>
              </thead>

              <tbody>
                {data.sections.map((section) => {
                  const percentage =
                    section.maxScore === 0
                      ? 0
                      : (section.score /
                          section.maxScore) *
                        100;

                  return (
                    <tr key={section.name}>
                      <td>{section.name}</td>

                      <td>
                        {section.score}
                      </td>

                      <td>
                        {section.maxScore}
                      </td>

                      <td>
                        {percentage.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}

      <section className="totalResults">
        <h2>総合成績</h2>

        <div className="totalGrid">
          <div>
            <span>合計</span>
            <strong>
              {data.totalScore} /{" "}
              {data.totalMaxScore}
            </strong>
          </div>

          <div>
            <span>得点率</span>
            <strong>
              {data.totalPercentage.toFixed(1)}%
            </strong>
          </div>

          <div>
            <span>偏差値</span>
            <strong>
              {data.totalDeviationScore !==
              undefined
                ? data.totalDeviationScore.toFixed(1)
                : "-"}
            </strong>
          </div>
        </div>
      </section>

      <section className="rankResults">
        <h2>順位</h2>

        <div className="rankGrid">
          <div>
            <span>全校</span>
            <strong>
              {data.overallRank !== undefined
                ? `${data.overallRank}位`
                : "-"}
            </strong>
          </div>

          <div>
            <span>校舎</span>
            <strong>
              {data.schoolRank !== undefined
                ? `${data.schoolRank}位`
                : "-"}
            </strong>
          </div>

          <div>
            <span>学年</span>
            <strong>
              {data.gradeRank !== undefined
                ? `${data.gradeRank}位`
                : "-"}
            </strong>
          </div>

          <div>
            <span>クラス</span>
            <strong>
              {data.classRank !== undefined
                ? `${data.classRank}位`
                : "-"}
            </strong>
          </div>
        </div>
      </section>
    </article>
  );
}
