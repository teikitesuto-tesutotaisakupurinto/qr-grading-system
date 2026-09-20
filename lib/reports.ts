import {
  collection,
  doc,
  getDocs,
  query,
  setDoc,
  where,
} from "firebase/firestore";

import { db } from "./firebase";

export type ReportTemplate = {
  id: string;
  name: string;
  pageOrientation: "portrait" | "landscape";
  showStudentNumber: boolean;
  showPercentage: boolean;
  showDeviationScore: boolean;
  showSections: boolean;
  showRubrics: boolean;
  showOverallRank: boolean;
  showSchoolRank: boolean;
  showGradeRank: boolean;
  showClassRank: boolean;
  showSubjectRank: boolean;
  logoUrl?: string;
};

export async function saveReportTemplate(
  template: ReportTemplate
) {
  await setDoc(
    doc(
      db,
      "gradeReportTemplates",
      template.id
    ),
    template,
    { merge: true }
  );
}

export async function getReportTemplates() {
  const snapshot = await getDocs(
    collection(
      db,
      "gradeReportTemplates"
    )
  );

  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  })) as ReportTemplate[];
}

export async function getReportTemplate(
  id: string
) {
  const snapshot = await getDocs(
    query(
      collection(db, "gradeReportTemplates"),
      where("id", "==", id)
    )
  );

  if (snapshot.empty) {
    return null;
  }

  return {
    id: snapshot.docs[0].id,
    ...snapshot.docs[0].data(),
  } as ReportTemplate;
}
