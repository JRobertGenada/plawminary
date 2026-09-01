import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', margin: '2rem' }}>
          <h2 style={{ color: '#DC2626' }}>Something went wrong.</h2>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.8rem', color: '#B91C1C' }}>
            {this.state.error && this.state.error.toString()}
          </pre>
          <button onClick={() => window.location.reload()} style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: '#DC2626', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
