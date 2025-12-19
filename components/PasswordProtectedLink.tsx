'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, X } from 'lucide-react';

interface PasswordProtectedLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  storageKey?: string;
}

const CORRECT_PASSWORD = 'ZestFulcrum';

export default function PasswordProtectedLink({
  href,
  children,
  className = '',
  storageKey = 'admin_authenticated'
}: PasswordProtectedLinkProps) {
  const [showModal, setShowModal] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Check if already authenticated in session storage
    const authenticated = sessionStorage.getItem(storageKey) === 'true';
    setIsAuthenticated(authenticated);
  }, [storageKey]);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();

    // If already authenticated, navigate directly
    if (isAuthenticated) {
      router.push(href);
      return;
    }

    // Show password modal
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (password === CORRECT_PASSWORD) {
      sessionStorage.setItem(storageKey, 'true');
      setIsAuthenticated(true);
      setShowModal(false);
      setError('');
      setPassword('');
      router.push(href);
    } else {
      setError('Incorrect password');
      setPassword('');
    }
  };

  const handleClose = () => {
    setShowModal(false);
    setPassword('');
    setError('');
  };

  return (
    <>
      <a href={href} onClick={handleClick} className={className}>
        {children}
      </a>

      {/* Password Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 relative">
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center">
                <Lock className="w-8 h-8 text-primary-600" />
              </div>
            </div>

            <h2 className="text-2xl font-bold text-center mb-2">Password Required</h2>
            <p className="text-gray-600 text-center mb-6">
              This content is password protected. Please enter the password to access.
            </p>

            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <input
                  type="password"
                  className={`input w-full ${error ? 'border-red-500' : ''}`}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  placeholder="Enter password"
                  autoFocus
                />
                {error && (
                  <p className="text-red-600 text-sm mt-1">{error}</p>
                )}
              </div>
              <button type="submit" className="btn btn-primary w-full">
                Unlock
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
