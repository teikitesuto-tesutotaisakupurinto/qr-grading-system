import {
  collection,
  getDocs,
  query,
  where,
  writeBatch,
  doc,
} from "firebase/firestore";

import { db } from "./firebase";

export type StudentStatus =
  | "在籍"
  | "卒業"
  | "退塾";

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
      Math.floor(
        100000 +
          Math.random() * 900000
      )
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
    constraints.push(
      where("schoolId", "==", schoolId)
    );
  }

  if (grade) {
    constraints.push(
      where("grade", "==", grade)
    );
  }

  if (className) {
    constraints.push(
      where(
        "className",
        "==",
        className
      )
    );
  }

  const studentsRef = collection(
    db,
    "students"
  );

  const snapshot = await getDocs(
    query(
      studentsRef,
      ...constraints
    )
  );

  return snapshot.docs.map(
    (item) =>
      ({
        id: item.id,
        ...item.data(),
      }) as Student
  );
}

export async function createStudent(
  input: Omit<
    Student,
    "id" | "createdAt" | "updatedAt"
  >
): Promise<string> {
  const snapshot = await getDocs(
    collection(db, "students")
  );

  const usedNumbers = new Set(
    snapshot.docs.map(
      (item) => item.id
    )
  );

  const studentNumber =
    generateSixDigitNumber(
      usedNumbers
    );

  const now = Date.now();

  await writeBatch(db)
    .set(
      doc(
        db,
        "students",
        studentNumber
      ),
      {
        ...input,
        createdAt: now,
        updatedAt: now,
      }
    )
    .commit();

  return studentNumber;
}

export async function updateStudent(
  studentNumber: string,
  data: Partial<Student>
) {
  const reference = doc(
    db,
    "students",
    studentNumber
  );

  const batch = writeBatch(db);

  batch.update(reference, {
    ...data,
    updatedAt: Date.now(),
  });

  await batch.commit();
}

export async function updateStudentsFromCsv(
  students: Array<
    Omit<
      Student,
      "createdAt" | "updatedAt"
    >
  >
) {
  const snapshot = await getDocs(
    collection(db, "students")
  );

  const usedNumbers = new Set(
    snapshot.docs.map(
      (item) => item.id
    )
  );

  const batch = writeBatch(db);

  for (const student of students) {
    const studentNumber =
      student.id ||
      generateSixDigitNumber(
        usedNumbers
      );

    usedNumbers.add(studentNumber);

    batch.set(
      doc(
        db,
        "students",
        studentNumber
      ),
      {
        ...student,
        updatedAt: Date.now(),
      },
      {
        merge: true,
      }
    );
  }

  await batch.commit();
}
