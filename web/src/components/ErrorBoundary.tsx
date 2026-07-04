import { Component, type ErrorInfo, type ReactNode } from "react"

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
  errorInfo?: ErrorInfo
}

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: (error: Error, errorInfo: ErrorInfo) => ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state to trigger fallback UI
    return {
      hasError: true,
      error,
    }
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error information
    this.setState({ errorInfo })

    // Call optional error reporting callback
    this.props.onError?.(error, errorInfo)
  }

  override render() {
    if (this.state.hasError && this.state.error) {
      // Custom fallback or default error message
      return this.props.fallback ? (
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.props.fallback(this.state.error, this.state.errorInfo!)
      ) : (
        <div>Something went wrong.</div>
      )
    }

    return this.props.children
  }
}

export type ErrorFallbackProps = {
  error: Error
  errorInfo?: ErrorInfo
  resetErrorBoundary?: () => void
}
