import React from 'react';

/**
 * ErrorBoundary 컴포넌트
 * 런타임 오류가 발생했을 때 전체 앱이 크래시되는 것을 방지하고,
 * 사용자에게 최소한의 오류 UI를 보여줍니다.
 *
 * 사용법:
 *   <ErrorBoundary>
 *     <YourComponent />
 *   </ErrorBoundary>
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // 오류가 발생하면 UI를 대체하도록 state를 업데이트합니다.
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // 로그를 콘솔에 출력하거나 원격 로깅 서비스에 전송할 수 있습니다.
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      // 사용자에게 표시할 간단한 오류 UI
      return (
        <div style={{
          padding: '2rem',
          textAlign: 'center',
          color: 'var(--text-color)',
          backgroundColor: 'var(--bg-color)'
        }}>
          <h2>예기치 않은 오류가 발생했습니다.</h2>
          <p>잠시 후 다시 시도해 주세요.</p>
          {/* 개발 모드에서는 오류 정보를 보여줍니다. */}
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details style={{ whiteSpace: 'pre-wrap', marginTop: '1rem' }}>
              <summary>오류 상세 보기</summary>
              {this.state.error.toString()}
              <br />
              {this.state.errorInfo && this.state.errorInfo.componentStack}
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
