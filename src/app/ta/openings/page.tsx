import { redirect } from "next/navigation";

// All Openings and Job Listing were merged into one page at /ta/requisitions
export default function OpeningsRedirect() {
    redirect("/ta/requisitions");
}
