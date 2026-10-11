import { redirect } from "next/navigation";

// The Complete logbook section was merged into Edit PDF ("Saved logbook").
export default function LogbookRedirect() {
  redirect("/dashboard/edit-pdf?source=saved");
}
