// shared dom ids for keyboard navigation between the book collection (grid/list)
// and the detail panel, so focus can move from one to the other by id without
// threading refs across the layout.

export const BOOK_COLLECTION_ID = "book-collection"
export const BOOK_DETAIL_PANEL_ID = "book-detail-panel"

// stable id for a card/row, targeted by aria-activedescendant on the container
export function bookItemDomId(uuid: string): string {
  return `book-item-${uuid}`
}

export type BookNavModel = "commit" | "preview"
