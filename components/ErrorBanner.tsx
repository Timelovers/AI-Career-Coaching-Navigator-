import React from 'react';

const ErrorBanner: React.FC<{ message: string | null }> = ({ message }) => {
  if (!message) return null;
  return (
    <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {message}
    </div>
  );
};

export default ErrorBanner;
