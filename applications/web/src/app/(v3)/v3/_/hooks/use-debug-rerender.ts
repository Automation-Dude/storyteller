import { useRef } from "react"

/**
 * debug whether a certain value/function/component is rerendering
 * handy when trying to optimize specific hot paths
 * eg in the bookgrid
 */
export function useDebugRerender<T>(value: T, name: string) {
  const valueRef = useRef(value)
  const renderRef = useRef(0)

  if (valueRef.current !== value) {
    renderRef.current += 1
    if (typeof valueRef.current === "function") {
      const ogV = valueRef.current.toString()
      // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
      const newV = (value as unknown as Function).toString()
      if (ogV !== newV) {
        console.warn(`(${renderRef.current}) Function ${name} changed`, {
          from: ogV,
          to: newV,
        })
      } else {
        console.error(
          `(${renderRef.current}) Functon ${name} changed but the body is the same`,
          { from: ogV, to: newV },
        )
      }
      valueRef.current = value
      return
    }

    if (typeof valueRef.current === "object") {
      const ogV = JSON.stringify(valueRef.current)
      const newV = JSON.stringify(value)
      if (ogV !== newV) {
        console.warn(`(${renderRef.current}) Object ${name} changed`, {
          from: ogV,
          to: newV,
        })
      } else {
        console.error(
          `(${renderRef.current}) Object ${name} changed but the body is the same`,
          { from: ogV, to: newV },
        )
      }
      valueRef.current = value
      return
    }

    console.warn(`(${renderRef.current}) ${name} changed`, {
      from: valueRef.current,
      to: value,
    })
    valueRef.current = value
  }
  return value
}
