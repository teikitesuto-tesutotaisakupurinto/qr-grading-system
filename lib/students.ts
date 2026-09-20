import {
  collection,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
} from "firebase/firestore";

import { db } from "./firebase";

export type StudentStatus = "在籍" | "卒業" | "退塾";

export type Student = {
  id: string;
  name: string;
  schoolId: string;
  schoolName: string;
  grade: string;
  className: string;
  status: StudentStatus;
  createdAt?: number;
  updatedAt?: number;
};

function generateSixDigitNumber(
  usedNumbers: Set<string>
): string {
  let number = "";

  do {
    number = String(
      Math.floor(100000 + Math.random() * 900000)
    );
  } while (usedNumbers.has(number));

  return number;
}

export async function getStudents(
  schoolId?: string,
  grade?: string,
  className?: string
): Promise<Student[]> {
  const constraints = [];

  if (schoolId) {
    constraints.push(where("schoolId", "==", schoolId));
  }

  if (grade) {
    constraints.push(where("grade", "==", grade));
  }

  if (className) {
    constraints.push(where("className", "==", className));
  }

  const snapshot = await getDocs(
    query(collection(db, "students"), ...constraints)
  );

  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  })) as Student[];
}

export async function createStudent(
  input: Omit<Student, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const snapshot = await getDocs(
    collection(db, "students")
  );

  const usedNumbers = new Set(
    snapshot.docs.map((item) => item.id)
  );

  const studentNumber =
    generateSixDigitNumber(usedNumbers);

  await writeBatch(db)
    .set(doc(db, "students", studentNumber), {
      ...input,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    .commit();

  return studentNumber;
}

export async function updateStudent(
  studentNumber: string,
  data: Partial<Student>
) {
  const batch = writeBatch(db);

  batch.update(doc(db, "students", studentNumber), {
    ...data,
    updatedAt: Date.now(),
  });

  await batch.commit();
}

export async function updateStudentsFromCsv(
  students: Array<
    Omit<Student, "createdAt" | "updatedAt">
  >
) {
  const snapshot = await getDocs(
    collection(db, "students")
  );

  const usedNumbers = new Set(
    snapshot.docs.map((item) => item.id)
  );

  const prepared = students.map((student) => {
    const id =
      student.id ||
      generateSixDigitNumber(usedNumbers);

    usedNumbers.add(id);

    return {
      ...student,
      id,
      updatedAt: Date.now(),
    };
  });

  // Firestore WriteBatch は最大500書き込みなので分割
  const chunkSize = 450;

  for (
    let start = 0;
    start < prepared.length;
    start += chunkSize
  ) {
    const chunk = prepared.slice(
      start,
      start + chunkSize
    );

    const batch = writeBatch(db);

    for (const student of chunk) {
      batch.set(
        doc(db, "students", student.id),
        student,
        { merge: true }
      );
    }

    await batch.commit();
  }

  return prepared.map((student) => student.id);
}
