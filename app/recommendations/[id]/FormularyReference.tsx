'use client';

import { useState } from 'react';
import { Lock, ChevronDown, ChevronUp } from 'lucide-react';

interface FormularyDrug {
  drugName: string;
  genericName?: string | null;
  drugClass?: string | null;
  formulation?: string | null;
  strength?: string | null;
  ndcCode?: string | null;
  tier?: number | null;
  requiresPA?: string | null;
  restrictions?: string | null;
  quantityLimit?: string | null;
}

interface FormularyReferenceProps {
  formularyDrugs: FormularyDrug[];
  diagnosis: string;
}

export default function FormularyReference({
  formularyDrugs,
  diagnosis,
}: FormularyReferenceProps) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [error, setError] = useState('');

  const handleUnlock = () => {
    if (password === 'ZestFulcrum') {
      setIsUnlocked(true);
      setShowPasswordPrompt(false);
      setError('');
      setPassword('');
    } else {
      setError('Incorrect password');
      setPassword('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleUnlock();
    }
  };

  if (formularyDrugs.length === 0) {
    return null;
  }

  return (
    <div className="mt-8">
      {!isUnlocked ? (
        <div className="card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Lock className="h-5 w-5 text-gray-400" />
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Complete Formulary Reference
                </h2>
                <p className="text-sm text-gray-600">
                  Password required to view full formulary
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowPasswordPrompt(!showPasswordPrompt)}
              className="btn btn-secondary flex items-center gap-2"
            >
              {showPasswordPrompt ? (
                <>
                  <ChevronUp className="h-4 w-4" />
                  Hide
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  Unlock
                </>
              )}
            </button>
          </div>

          {showPasswordPrompt && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="max-w-md">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Enter Password
                </label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError('');
                    }}
                    onKeyPress={handleKeyPress}
                    className="input flex-1"
                    placeholder="Enter password"
                    autoFocus
                  />
                  <button onClick={handleUnlock} className="btn btn-primary">
                    Unlock
                  </button>
                </div>
                {error && (
                  <p className="mt-2 text-sm text-red-600">{error}</p>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Complete Formulary Reference
              </h2>
              <p className="text-sm text-gray-600">
                All appropriate biologic options for{' '}
                {diagnosis.replace(/_/g, ' ').toLowerCase()} (excluding
                contraindicated drugs)
              </p>
            </div>
            <button
              onClick={() => {
                setIsUnlocked(false);
                setPassword('');
              }}
              className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
            >
              <Lock className="h-4 w-4" />
              Lock
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Drug Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Formulation
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Strength
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    NDC
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tier
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Prior Auth
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Restrictions
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantity Limit
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {formularyDrugs.map((drug, idx) => (
                  <tr
                    key={idx}
                    className={
                      drug.tier === 1
                        ? 'bg-green-50'
                        : drug.tier === 2
                        ? 'bg-yellow-50'
                        : drug.tier === 5
                        ? 'bg-red-100'
                        : ''
                    }
                  >
                    <td className="px-4 py-3 text-sm">
                      <div className="font-medium text-gray-900">
                        {drug.drugName}
                      </div>
                      <div className="text-xs text-gray-500">
                        {drug.genericName}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {drug.drugClass}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {drug.formulation || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {drug.strength || '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs font-mono text-gray-600">
                      {drug.ndcCode || '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          drug.tier === 1
                            ? 'bg-green-100 text-green-800'
                            : drug.tier === 2
                            ? 'bg-yellow-100 text-yellow-800'
                            : drug.tier === 3
                            ? 'bg-orange-100 text-orange-800'
                            : drug.tier === 4
                            ? 'bg-red-100 text-red-800'
                            : drug.tier === 5
                            ? 'bg-gray-100 text-gray-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        Tier {drug.tier}
                        {drug.tier === 5 ? ' (Not Covered)' : ''}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      {drug.requiresPA === 'Yes' ? (
                        <span className="px-2 py-1 rounded bg-amber-100 text-amber-800 text-xs font-medium">
                          Yes
                        </span>
                      ) : drug.requiresPA === 'No' ? (
                        <span className="text-gray-500 text-xs">No</span>
                      ) : (
                        <span className="text-gray-400 text-xs">
                          {drug.requiresPA || '-'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {drug.restrictions || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {drug.quantityLimit || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
