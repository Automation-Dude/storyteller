import { withHasPermission } from "@/auth/auth"
import { getAlignmentReportForJob } from "@/database/alignmentReports"
import type { UUID } from "@/uuid"

export const dynamic = "force-dynamic"

type Params = Promise<{ jobId: string }>

/**
 * @summary Get a job's alignment report
 * @desc Returns the stored alignment report json for the job, or 404 if none.
 */
export const GET = withHasPermission<Params>("bookProcess")(async (
  _request,
  context,
) => {
  const { jobId } = await context.params
  const report = await getAlignmentReportForJob(jobId as UUID)
  if (!report) {
    return Response.json(
      { message: `No alignment report for job ${jobId}` },
      { status: 404 },
    )
  }
  return Response.json(report)
})
