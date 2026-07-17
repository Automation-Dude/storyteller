/**
 * A Kobo asks its store, on every startup, where everything lives.
 *
 * The answer includes where to fetch cover images, and the store's answer is
 * Kobo's own CDN, which has never heard of our books. So her device would ask
 * Kobo for a cover keyed by our uuid, get nothing, and draw a blank rectangle
 * next to every book in her library.
 *
 * We hand back the store's own reply with the image fields pointed at us, and
 * change nothing else in it: her Kobo account, her purchases and her store
 * still work, because everything else in that reply is still Kobo's.
 */

/** What a Kobo substitutes into the image templates. */
type Resources = Record<string, unknown>

export function rewriteImageResources(
  body: unknown,
  imagesBaseUrl: string,
): { rewritten: boolean; body: unknown } {
  if (
    !body ||
    typeof body !== "object" ||
    !("Resources" in body) ||
    typeof (body as { Resources: unknown }).Resources !== "object" ||
    !(body as { Resources: unknown }).Resources
  ) {
    // Not a shape we understand. Pass the store's reply through untouched
    // rather than hand the device a resource list we invented.
    return { rewritten: false, body }
  }

  const base = imagesBaseUrl.replace(/\/+$/, "")
  const resources = (body as { Resources: Resources }).Resources

  // The device fills in {ImageId} and the sizes itself. Our cover route
  // ignores the size, quality and greyscale segments, so the literals left in
  // the plain template are harmless and both templates can share one route.
  return {
    rewritten: true,
    body: {
      ...body,
      Resources: {
        ...resources,
        image_host: base,
        image_url_template: `${base}/{ImageId}/{width}/{height}/100/false/image.jpg`,
        image_url_quality_template: `${base}/{ImageId}/{width}/{height}/{Quality}/{isGreyscale}/image.jpg`,
      },
    },
  }
}
