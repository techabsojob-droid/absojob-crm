import { redirect } from "next/navigation";

// Attendance is managed in HRMIS
export default function AdminAttendanceRedirect() {
    redirect("/hr/attendance");
}
