'use client';

import React, { useState } from 'react';
import { useAuthStore } from '@/shared/auth/authStore';
import api from '@/shared/api/api';

export default function AuthDebugPage() {
  const { user, isAuthenticated, isLoading } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<any>(null);

  const testAuthEndpoint = async () => {
    setError(null);
    setTestResult(null);
    
    try {
      // Auth rides on the httpOnly session cookie, which page scripts cannot read
      const response = await api.get('/auth/me');
      setTestResult(response.data);
    } catch (err: any) {
      const status = err?.response?.status;
      setError(status ? `${status}: ${err.response?.data?.message || 'Unknown error'}` : 'Network error: ' + err?.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Authentication Debug Page
        </h1>
        
        {/* Current Auth State */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Current Auth State
          </h2>
          <div className="space-y-2 font-mono text-sm">
            <div>
              <span className="text-gray-600 dark:text-gray-400">isAuthenticated:</span>{' '}
              <span className={isAuthenticated ? 'text-green-600' : 'text-red-600'}>
                {String(isAuthenticated)}
              </span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">isLoading:</span>{' '}
              <span className="text-gray-900 dark:text-white">{String(isLoading)}</span>
            </div>
          </div>
        </div>

        {/* User Data */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            User Data
          </h2>
          {user ? (
            <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm">
              {JSON.stringify(user, null, 2)}
            </pre>
          ) : (
            <p className="text-red-600">No user data available</p>
          )}
        </div>

        {/* Test /auth/me Endpoint */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Test /auth/me Endpoint
          </h2>
          <button
            onClick={testAuthEndpoint}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors mb-4"
          >
            Test Endpoint
          </button>
          
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
              <p className="text-red-800 dark:text-red-200 font-semibold">Error:</p>
              <p className="text-red-700 dark:text-red-300 text-sm mt-1">{error}</p>
            </div>
          )}
          
          {testResult && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <p className="text-green-800 dark:text-green-200 font-semibold mb-2">
                Success! Response:
              </p>
              <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm">
                {JSON.stringify(testResult, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-blue-900 dark:text-blue-100 mb-4">
            Troubleshooting Steps
          </h2>
          <ol className="list-decimal list-inside space-y-2 text-blue-800 dark:text-blue-200 text-sm">
            <li>Check if &quot;isAuthenticated&quot; is true above</li>
            <li>Click &quot;Test Endpoint&quot; to verify backend authentication</li>
            <li>Open browser console (F12) and check for error messages</li>
            <li>Check backend server is running (port 5001)</li>
            <li>Try logging out and logging in again</li>
          </ol>
          
          <div className="mt-4 p-4 bg-blue-100 dark:bg-blue-900/40 rounded-lg">
            <p className="text-blue-900 dark:text-blue-100 font-semibold">Common Issues:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-blue-800 dark:text-blue-200 text-sm">
              <li><strong>401 Error:</strong> Session cookie is missing, expired or revoked - log in again</li>
              <li><strong>Network Error:</strong> Backend server is not running or wrong URL</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
