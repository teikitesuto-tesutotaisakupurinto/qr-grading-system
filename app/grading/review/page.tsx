async function loadGrading(
  answerId: string
) {
  try {
    setError("");

    const [
      grading,
      review,
    ] =
      await Promise.all([
        getGradingResult(
          answerId
        ),

        getFirstReview(
          answerId
        ),
      ]);

    /*
     * getGradingResult() はFirestoreの
     * DocumentDataを返すため、
     * ここで明示的に型を確定する。
     */

    type GradingDocument = {
      id: string;

      results?: GradingResult[];

      totalScore?: number;

      totalMaxScore?: number;

      status?: string;

      reviewRequired?: boolean;
    };

    const gradingData =
      grading as
        | GradingDocument
        | null;

    const gradingResults =
      Array.isArray(
        gradingData?.results
      )
        ? gradingData.results
        : [];

    /*
     * firstReviewsにすでに
     * 修正版が存在する場合は、
     * そちらを優先する。
     */
    const reviewResults =
      Array.isArray(
        review?.results
      )
        ? review.results
        : [];

    const nextResults =
      reviewResults.length >
      0
        ? reviewResults
        : gradingResults;

    setResults(
      nextResults
    );

    setInternalNote(
      review?.internalNote ??
        ""
    );

    setPublicAnnotation(
      review?.publicAnnotation ??
        ""
    );
  } catch (
    error
  ) {
    console.error(
      "loadGrading error:",
      error
    );

    setResults(
      []
    );

    setInternalNote(
      ""
    );

    setPublicAnnotation(
      ""
    );

    setError(
      "採点結果を取得できませんでした。"
    );
  }
}
