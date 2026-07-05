/**
 * migrates direct @tabler/icons-react imports to `import * as icon from "@/icons"`
 * usage: node scripts/migrate-icons.mjs [--dry-run]
 */

import { readFileSync, writeFileSync } from "fs"
import { execSync } from "child_process"

const ICON_MAP = {
  IconAdjustmentsHorizontal: "AdjustmentsHorizontal",
  IconAlertCircle: "AlertCircle",
  IconAlertOctagon: "AlertOctagon",
  IconAlertTriangle: "AlertTriangle",
  IconAlignLeft: "AlignLeft",
  IconArrowBack: "ArrowBack",
  IconArrowDown: "ArrowDown",
  IconArrowLeft: "ArrowLeft",
  IconArrowMerge: "Merge",
  IconArrowNarrowLeft: "ArrowNarrowLeft",
  IconArrowsMaximize: "ArrowsMaximize",
  IconArrowsSort: "ArrowsSort",
  IconArrowUp: "ArrowUp",
  IconArrowUpRight: "ArrowUpRight",
  IconBook: "BookAlt",
  IconBook2: "Book",
  IconBookFilled: "BookFilled",
  IconBookmark: "Bookmark",
  IconBookmarkPlus: "BookmarkPlus",
  IconBookOff: "BookOff",
  IconBooks: "Books",
  IconBooksOff: "BooksOff",
  IconBriefcase: "Briefcase",
  IconBug: "Bug",
  IconCalendar: "Calendar",
  IconCalendarCheck: "CalendarCheck",
  IconCalendarPlus: "CalendarPlus",
  IconCertificate: "Certificate",
  IconChartBar: "ChartBar",
  IconChartRadar: "ChartRadar",
  IconCheck: "Check",
  IconCheckbox: "Checkbox",
  IconChevronDown: "ChevronDown",
  IconChevronLeft: "ChevronLeft",
  IconChevronRight: "ChevronRight",
  IconChevronUp: "ChevronUp",
  IconCircleCheck: "CircleCheck",
  IconClick: "Click",
  IconClock: "Clock",
  IconColumns: "Columns",
  IconColumns3: "Columns3",
  IconCopy: "Copy",
  IconDatabase: "Database",
  IconDots: "Dots",
  IconDotsCircleHorizontal: "DotsCircle",
  IconDotsVertical: "DotsVertical",
  IconDownload: "Download",
  IconEdit: "Edit",
  IconEditOff: "EditOff",
  IconExternalLink: "ExternalLink",
  IconEye: "Eye",
  IconEyeOff: "EyeOff",
  IconFile: "File",
  IconFileArrowRight: "FileArrowRight",
  IconFileImport: "FileImport",
  IconFileText: "FileText",
  IconFileUpload: "FileUpload",
  IconFilter: "Filter",
  IconFolder: "Folder",
  IconFolders: "Folders",
  IconGitMerge: "GitMerge",
  IconGripVertical: "GripVertical",
  IconH2: "H2",
  IconHeading: "Heading",
  IconHeadphones: "Headphones",
  IconHeadphonesFilled: "HeadphonesFilled",
  IconHeadphonesOff: "HeadphonesOff",
  IconHeart: "Heart",
  IconHelpCircle: "HelpCircle",
  IconHighlight: "Highlight",
  IconHistory: "History",
  IconHome: "Home",
  IconInfoCircle: "InfoCircle",
  IconKey: "Key",
  IconLanguage: "Language",
  IconLayoutGrid: "LayoutGrid",
  IconLayoutList: "LayoutList",
  IconLayoutSidebar: "LayoutSidebar",
  IconLibrary: "Library",
  IconLink: "Link",
  IconLinkOff: "LinkOff",
  IconList: "List",
  IconListNumbers: "ListNumbers",
  IconLoader: "Loader",
  IconLoader2: "Loader2",
  IconLock: "Lock",
  IconLogout: "Logout",
  IconMail: "Mail",
  IconMaximize: "Maximize",
  IconMicrophone: "Microphone",
  IconMicrophone2: "Microphone2",
  IconMinimize: "Minimize",
  IconMinus: "Minus",
  IconMoon: "Moon",
  IconPalette: "Palette",
  IconPencil: "Pencil",
  IconPin: "Pin",
  IconPinFilled: "PinFilled",
  IconPlayerPause: "PlayerPause",
  IconPlayerPlay: "PlayerPlay",
  IconPlus: "Plus",
  IconPointer: "Pointer",
  IconProgress: "Progress",
  IconProgressX: "ProgressX",
  IconRefresh: "Refresh",
  IconReload: "Reload",
  IconReplace: "Replace",
  IconReportAnalytics: "ReportAnalytics",
  IconRotate2: "Rotate2",
  IconRss: "Rss",
  IconScan: "Scan",
  IconSearch: "Search",
  IconSelector: "Selector",
  IconServer: "Server",
  IconSettings: "Settings",
  IconSettings2: "Settings2",
  IconShield: "Shield",
  IconSortAscending: "SortAscending",
  IconSortDescending: "SortDescending",
  IconSquare: "Square",
  IconSquareCheck: "SquareCheck",
  IconStack2: "Stack",
  IconStar: "Star",
  IconSun: "Sun",
  IconTag: "Tag",
  IconTagFilled: "TagFilled",
  IconTagMinus: "TagRemove",
  IconTagPlus: "TagAdd",
  IconTags: "Tags",
  IconTagsOff: "TagsOff",
  IconTextCaption: "TextCaption",
  IconTextWrap: "TextWrap",
  IconTrash: "Trash",
  IconTrashX: "TrashX",
  IconUpload: "Upload",
  IconUser: "User",
  IconUsers: "Users",
  IconVolume: "Volume",
  IconVolume3: "Volume3",
  IconVolumeOff: "VolumeOff",
  IconX: "Close",
}

const dryRun = process.argv.includes("--dry-run")

const files = execSync(
  `rg -l 'from "@tabler/icons-react"' src/app/\\(v3\\)/`,
  { cwd: process.cwd(), encoding: "utf-8" },
)
  .trim()
  .split("\n")
  .filter(Boolean)

// skip the source file itself
const SKIP = ["src/icons/source.tsx"]

let migrated = 0
let skipped = 0

for (const file of files) {
  if (SKIP.some((s) => file.endsWith(s))) {
    skipped++
    continue
  }

  let content = readFileSync(file, "utf-8")

  // match the tabler import statement (might span multiple lines)
  const importRegex =
    /import\s*\{([^}]+)\}\s*from\s*["']@tabler\/icons-react["'];?\n?/s

  const match = content.match(importRegex)
  if (!match) {
    skipped++
    continue
  }

  const importBlock = match[0]
  const importedNames = match[1]
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)

  // separate type imports from value imports
  const typeImports = []
  const valueImports = []

  for (const name of importedNames) {
    const typeMatch = name.match(/^type\s+(.+)$/)

    if (typeMatch) {
      typeImports.push(typeMatch[1].trim())
    } else {
      valueImports.push(name.trim())
    }
  }

  // check if we have TablerIcon type import (needs special handling)
  const hasTablerIconType = typeImports.includes("TablerIcon")
  const hasIconProps = typeImports.includes("IconProps")

  // check for unmapped icons
  const unmapped = valueImports.filter((name) => !ICON_MAP[name])
  if (unmapped.length > 0) {
    console.log(`SKIP ${file}: unmapped icons: ${unmapped.join(", ")}`)
    skipped++
    continue
  }

  // check if the file already has an icon import
  const hasExistingIconImport = content.includes('from "@/icons"')

  // build replacement import
  let newImport = ""
  if (!hasExistingIconImport && valueImports.length > 0) {
    newImport = 'import * as icon from "@/icons"\n'
  }

  if (hasTablerIconType) {
    newImport += 'import { type StyledIcon } from "@/icons"\n'
  }

  if (hasIconProps) {
    newImport += 'import { type StyledIconProps } from "@/icons"\n'
  }

  // replace import statement
  content = content.replace(importBlock, newImport)

  // replace all icon usages in the file
  for (const iconName of valueImports) {
    const mapped = ICON_MAP[iconName]
    if (!mapped) continue

    // replace as JSX element: <IconX ... /> -> <icon.X ... />
    const jsxRegex = new RegExp(`<${iconName}(\\s|\\/)`, "g")
    content = content.replace(jsxRegex, `<icon.${mapped}$1`)

    // replace closing tags: </IconX> -> </icon.X>
    const closingRegex = new RegExp(`</${iconName}>`, "g")
    content = content.replace(closingRegex, `</icon.${mapped}>`)

    // replace as value reference (e.g. icon={IconX})
    // but not inside import statements or type annotations
    const refRegex = new RegExp(`(?<!["'/\\.])\\b${iconName}\\b`, "g")
    content = content.replace(refRegex, `icon.${mapped}`)
  }

  // replace TablerIcon type usage
  if (hasTablerIconType) {
    content = content.replace(/\bTablerIcon\b/g, "StyledIcon")
  }

  if (hasIconProps) {
    content = content.replace(/\bIconProps\b/g, "StyledIconProps")
  }

  if (dryRun) {
    console.log(`WOULD migrate: ${file}`)
  } else {
    writeFileSync(file, content)
    console.log(`MIGRATED: ${file}`)
  }

  migrated++
}

console.log(`\nDone. Migrated: ${migrated}, Skipped: ${skipped}`)
