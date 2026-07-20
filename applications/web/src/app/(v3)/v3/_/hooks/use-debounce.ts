import debounce from "debounce"
import { useEffect, useMemo, useRef, useState } from "react"

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)
    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

type ControlFunctions = {
  cancel: () => void
  flush: () => void
  isPending: () => boolean
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DebouncedState<T extends (...args: any) => ReturnType<T>> = ((
  ...args: Parameters<T>
) => ReturnType<T> | undefined) &
  ControlFunctions

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useDebounceCallback<T extends (...args: any) => ReturnType<T>>(
  func: T,
  delay = 500,
  options?: Parameters<typeof debounce>[2],
): DebouncedState<T> {
  const debouncedFunc = useRef<ReturnType<typeof debounce>>(
    debounce(func, delay, options),
  )

  useEffect(() => {
    return () => {
      debouncedFunc.current.clear()
    }
  }, [])

  const debounced = useMemo(() => {
    const debouncedFuncInstance = debounce(func, delay, options)

    const wrappedFunc: DebouncedState<T> = (...args: Parameters<T>) => {
      return debouncedFuncInstance(...args)
    }

    wrappedFunc.cancel = () => {
      debouncedFunc.current.clear()
    }

    wrappedFunc.isPending = () => {
      return debouncedFunc.current.isPending
    }

    wrappedFunc.flush = () => {
      debouncedFuncInstance.flush()
    }

    return wrappedFunc
  }, [func, delay, options])

  // Update the debounced function ref whenever func, wait, or options change
  useEffect(() => {
    debouncedFunc.current = debounce(func, delay, options)
  }, [func, delay, options])

  return debounced
}
