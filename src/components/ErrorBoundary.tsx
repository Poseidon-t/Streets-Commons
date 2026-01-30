import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('Component failed to load:', error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="rounded-xl border-2 p-6 text-center" style={{ borderColor: '#e0dbd0', backgroundColor: 'rgba(255,255,255,0.85)' }}>
          <p className="text-sm" style={{ color: '#5a6a5a' }}>
            Failed to load this section. Please refresh the page.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
