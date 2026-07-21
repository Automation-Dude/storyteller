import { NextResponse } from "next/server"

import { withHasPermission } from "@/auth/auth"
import {
  confirmClusterCanonical,
  findCreatorClusters,
  mergeCluster,
} from "@/metadata/creators"

export const dynamic = "force-dynamic"

/**
 * @summary Find and repair near-duplicate author spellings
 * @desc GET lists clusters of author names within a couple of keystrokes of
 *       each other, with the catalogue's verdict on which spelling is real.
 *       POST merges every cluster that has a confirmed spelling. Admin only.
 */
export const GET = withHasPermission("settingsUpdate")(async () => {
  const clusters = await findCreatorClusters()
  for (const cluster of clusters) {
    cluster.canonical = await confirmClusterCanonical(cluster)
  }
  return NextResponse.json({ clusters })
})

export const POST = withHasPermission("settingsUpdate")(async () => {
  const clusters = await findCreatorClusters()
  const results = []
  for (const cluster of clusters) {
    const canonical = await confirmClusterCanonical(cluster)
    if (!canonical) {
      results.push({ variants: cluster.variants.map((v) => v.name), merged: 0 })
      continue
    }
    const merged = await mergeCluster(cluster, canonical)
    results.push({
      variants: cluster.variants.map((v) => v.name),
      canonical,
      merged,
    })
  }
  return NextResponse.json({ results })
})
