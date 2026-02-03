import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  sectionName?: string;
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
    console.error(`[${this.props.sectionName || 'Component'}] failed to load:`, error);
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="rounded-xl border-2 p-6 text-center" style={{ borderColor: '#e0dbd0', backgroundColor: 'rgba(255,255,255,0.85)' }}>
          <p className="text-sm font-medium mb-2" style={{ color: '#5a6a5a' }}>
            {this.props.sectionName ? `${this.props.sectionName} couldn't load.` : 'This section couldn\'t load.'}
          </p>
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={this.handleRetry}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg text-gray-500 hover:text-gray-700 transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
