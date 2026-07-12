/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { type Prettify } from "@/assets/library/scanner/types"

/**
 * Type-safe version of Object.entries()
 * Returns an array of tuples containing key-value pairs with proper typing
 * Includes all properties that exist in the object, even if undefined
 */
export function entries<
  const T extends Record<string, unknown>,
  const KeepUndefined extends boolean = false,
>(
  obj: T,
  keepUndefined?: KeepUndefined,
): T extends T ? Entries<T, KeepUndefined> : never {
  const newObj = Object.entries(obj)

  if (keepUndefined) {
    return newObj as any
  }

  return newObj.filter(([_, v]) => v !== undefined) as any
}

export type Entries<
  T extends Record<string, unknown>,
  KeepUndefined extends boolean = false,
  ValueFilter = undefined,
  AcceptedKeys extends keyof T = ValueFilter extends undefined
    ? keyof T
    : keyof T extends infer Keys extends keyof T
      ? Keys extends Keys
        ? ValueFilter extends T[Keys]
          ? keyof T
          : never
        : never
      : never,
> = {
  [K in AcceptedKeys]-?: [
    ValueFilter extends undefined
      ? KeepUndefined extends true
        ? T[K]
        : NonNullable<T[K]>
      : T[K] extends ValueFilter
        ? T[K]
        : never,
  ]
}[AcceptedKeys][]

export type AcceptedKeys<
  T,
  ValueFilter = undefined,
> = ValueFilter extends undefined
  ? keyof T
  : keyof T extends infer Keys extends keyof T
    ? Keys extends Keys
      ? T[Keys] extends ValueFilter
        ? keyof T
        : never
      : never
    : never

/**
 * Type-safe version of Object.fromEntries()
 * Creates an object from an array of key-value pairs with proper typing
 */
export function fromEntries<const T extends [PropertyKey, any][]>(
  entries: T,
): { [K in T[number][0]]: Extract<T[number], [K, any]>[1] } {
  return Object.fromEntries(entries) as any
}

type MapToEntries<
  T extends readonly unknown[],
  M extends readonly string[],
  C extends any[] = [],
  Buffer extends Record<string, any> = {},
> = C["length"] extends T["length"]
  ? Buffer
  : MapToEntries<
      T,
      M,
      [...C, C["length"]],
      Prettify<
        Buffer & {
          [NewKey in M[C["length"]]]: T[C["length"]]
        }
      >
    >

export function mapToEntries<
  const T extends readonly unknown[],
  const M extends readonly string[],
  C extends any[] = [],
  Buffer extends Record<string, any> = {},
>(obj: T, mapping: M): T extends T ? MapToEntries<T, M, C, Buffer> : never {
  const result: Record<string, any> = {}
  for (let i = 0; i < Math.min(obj.length, mapping.length); i++) {
    result[mapping[i]] = obj[i]
  }
  return result as any
}

export function keys<const T extends Record<string, any>>(
  obj: T,
): T extends T ? (keyof T)[] : never {
  return Object.keys(obj) as any
}
