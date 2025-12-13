import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

// Debug logging to verify script execution
console.log('🚀 [INDEX.TSX] Script starting...');
console.log('🔧 [INDEX.TSX] Environment:', import.meta.env.MODE);

// Error Boundary Component to catch and display errors
class ErrorBoundary extends React.Component<
    { children: React.ReactNode },
    { hasError: boolean; error: Error | null }
> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('❌ [ERROR BOUNDARY] React Error:', error);
        console.error('❌ [ERROR BOUNDARY] Error Info:', errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    minHeight: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#050510',
                    color: '#00f0ff',
                    fontFamily: 'monospace',
                    padding: '20px',
                    textAlign: 'center'
                }}>
                    <h1 style={{ color: '#ff4444', marginBottom: '20px' }}>⚠️ APPLICATION ERROR</h1>
                    <p style={{ color: '#ffffff', marginBottom: '10px' }}>Something went wrong loading the app.</p>
                    <pre style={{
                        backgroundColor: '#1a1a2e',
                        padding: '15px',
                        borderRadius: '8px',
                        maxWidth: '600px',
                        overflow: 'auto',
                        fontSize: '12px',
                        color: '#ff6b6b'
                    }}>
                        {this.state.error?.message || 'Unknown error'}
                    </pre>
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            marginTop: '20px',
                            padding: '10px 20px',
                            backgroundColor: '#00f0ff',
                            color: '#000',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                    >
                        RELOAD PAGE
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

// Lazy load App component to catch import errors
const App = React.lazy(() => {
    console.log('📦 [INDEX.TSX] Lazy loading App component...');
    return import('./App').then(module => {
        console.log('✅ [INDEX.TSX] App component loaded successfully');
        return module;
    }).catch(err => {
        console.error('❌ [INDEX.TSX] Failed to load App:', err);
        throw err;
    });
});

// Loading fallback
const LoadingFallback = () => (
    <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#050510',
        color: '#00f0ff',
        fontFamily: 'monospace'
    }}>
        <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', marginBottom: '10px' }}>⏳</div>
            <div>INITIALIZING HUNTER PROTOCOL...</div>
        </div>
    </div>
);

console.log('🔍 [INDEX.TSX] Looking for root element...');
const rootElement = document.getElementById('root');

if (!rootElement) {
    console.error('❌ [INDEX.TSX] Root element not found!');
    throw new Error("Could not find root element to mount to");
}

console.log('✅ [INDEX.TSX] Root element found, creating React root...');

try {
    const root = ReactDOM.createRoot(rootElement);
    console.log('✅ [INDEX.TSX] React root created, rendering app...');

    root.render(
        <React.StrictMode>
            <ErrorBoundary>
                <React.Suspense fallback={<LoadingFallback />}>
                    <App />
                </React.Suspense>
            </ErrorBoundary>
        </React.StrictMode>
    );

    console.log('✅ [INDEX.TSX] React render called successfully');
} catch (error) {
    console.error('❌ [INDEX.TSX] Failed to render React app:', error);

    // Fallback: show error in DOM directly
    rootElement.innerHTML = `
    <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #050510; color: #ff4444; font-family: monospace; padding: 20px; text-align: center;">
      <div>
        <h1>⚠️ CRITICAL ERROR</h1>
        <p style="color: #fff;">React failed to initialize.</p>
        <pre style="background: #1a1a2e; padding: 15px; border-radius: 8px; text-align: left; overflow: auto; max-width: 600px; margin: 20px auto;">${error}</pre>
      </div>
    </div>
  `;
}