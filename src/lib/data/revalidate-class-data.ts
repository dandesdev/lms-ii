import { revalidatePath, revalidateTag } from "next/cache";
import { tags } from "@/lib/data/classes";

/** Immediate expire — mutations need read-your-own-writes after router.refresh(). */
const expireNow = { expire: 0 } as const;

/** Invalidate cached class-list / counts / class rows after a mutation. */
export function revalidateClassData(options: {
  studentId?: string | null;
  classId?: string | null;
}) {
  const { studentId, classId } = options;

  revalidateTag(tags.studentClassesAll, expireNow);
  revalidateTag(tags.classCounts, expireNow);

  if (studentId) {
    revalidateTag(tags.studentClasses(studentId), expireNow);
    revalidateTag(tags.student(studentId), expireNow);
    revalidatePath(`/dashboard/students/${studentId}`);
  }

  if (classId) {
    revalidateTag(tags.classRecord(classId), expireNow);
    revalidatePath(`/class/${classId}`);
  }

  revalidatePath("/dashboard");
  revalidatePath("/student");
}
