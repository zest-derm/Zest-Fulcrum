'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  TrendingUp,
  TrendingDown,
  Users,
  Activity,
  DollarSign,
  Filter,
  Search,
  Download,
  ChevronDown,
  ChevronUp,
  BarChart3,
} from 'lucide-react';

interface ProviderStats {
  name: string;
  totalAssessments: number;
  totalRecommendations: number;
  acceptedCount: number;
  declinedCount: number;
  acceptanceRate: number;
  byDiagnosis: Record<string, { accepted: number; total: number }>;
  byRemission: {
    remission: { accepted: number; total: number };
    active: { accepted: number; total: number };
  };
}

interface DiagnosisStats {
  diagnosis: string;
  totalAssessments: number;
  totalRecommendations: number;
  acceptedCount: number;
  declinedCount: number;
  acceptanceRate: number;
  byRemission: {
    remission: { accepted: number; total: number };
    active: { accepted: number; total: number };
  };
}

interface AssessmentDetail {
  id: string;
  mrn: string;
  providerName: string;
  providerId: string | null;
  diagnosis: string;
  hasPsoriaticArthritis: boolean;
  dlqiScore: number | null;
  monthsStable: number | null;
  isRemission: boolean;
  assessedAt: string;
  assessmentStartedAt: string | null;
  currentBiologic: {
    name: string | null;
    dose: string | null;
    frequency: string | null;
  } | null;
  currentBiologicTier: number | null;
  patientName: string | null;
  recommendations: Array<{
    id: string;
    rank: number;
    type: string;
    drugName: string;
    tier: number | null;
    status: string;
    annualSavings: number | null;
    currentAnnualCost: number | null;
    recommendedAnnualCost: number | null;
    savingsPercent: number | null;
    contraindicated: boolean;
    decidedAt: string | null;
  }>;
  feedback: Array<{
    id: string;
    selectedRank: number | null;
    selectedTier: number | null;
    assessmentTimeMinutes: number | null;
    formularyAccurate: boolean | null;
    additionalFeedback: string | null;
    yearlyRecommendationCost: number | null;
    reasonForChoice: string | null;
    reasonAgainstFirst: string | null;
    reasonForDeclineAll: string | null;
    alternativePlan: string | null;
  }>;
}

interface AnalyticsData {
  summary: {
    totalAssessments: number;
    totalRecommendations: number;
    acceptedCount: number;
    declinedCount: number;
    overallAcceptanceRate: number;
    totalPotentialSavings: number;
  };
  byProvider: ProviderStats[];
  byDiagnosis: DiagnosisStats[];
  assessmentDetails: AssessmentDetail[];
}

type SortKey =
  | 'name'
  | 'totalAssessments'
  | 'acceptanceRate'
  | 'diagnosis'
  | 'mrn'
  | 'assessedAt';
type SortOrder = 'asc' | 'desc';
type ViewMode = 'summary' | 'provider' | 'diagnosis' | 'individual';

export default function DataRoom() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('summary');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterProvider, setFilterProvider] = useState<string>('all');
  const [filterDiagnosis, setFilterDiagnosis] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [sortKey, setSortKey] = useState<SortKey>('assessedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [expandedRows, setExpandedRows] = useState<string[]>([]);

  // Check authentication on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/data-room/analytics');
      if (response.ok) {
        const analyticsData = await response.json();
        setData(analyticsData);
        setIsAuthenticated(true);
      } else if (response.status === 401) {
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    try {
      const response = await fetch('/api/data-room/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const result = await response.json();

      if (result.success) {
        setIsAuthenticated(true);
        await checkAuth(); // Load data
      } else {
        setAuthError('Invalid password');
      }
    } catch (error) {
      console.error('Login error:', error);
      setAuthError('Authentication failed');
    }
  };

  const handleLogout = async () => {
    await fetch('/api/data-room/auth', { method: 'DELETE' });
    setIsAuthenticated(false);
    setPassword('');
    setData(null);
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('desc');
    }
  };

  const exportToCSV = () => {
    if (!data) return;

    let csvContent = '';
    let filename = '';

    if (viewMode === 'provider') {
      csvContent = 'Provider,Total Assessments,Total Recommendations,Accepted,Declined,Acceptance Rate\n';
      filteredProviders.forEach((p) => {
        csvContent += `"${p.name}",${p.totalAssessments},${p.totalRecommendations},${p.acceptedCount},${p.declinedCount},${p.acceptanceRate.toFixed(1)}%\n`;
      });
      filename = 'provider-analytics.csv';
    } else if (viewMode === 'diagnosis') {
      csvContent = 'Diagnosis,Total Assessments,Total Recommendations,Accepted,Declined,Acceptance Rate\n';
      filteredDiagnoses.forEach((d) => {
        csvContent += `"${formatDiagnosis(d.diagnosis)}",${d.totalAssessments},${d.totalRecommendations},${d.acceptedCount},${d.declinedCount},${d.acceptanceRate.toFixed(1)}%\n`;
      });
      filename = 'diagnosis-analytics.csv';
    } else if (viewMode === 'individual') {
      csvContent =
        'MRN,Provider,Diagnosis,Remission Status,Date,Current Biologic,Recommendations,Accepted,Declined,Total Savings,Selected Tier,Assessment Time (min),Formulary Accurate,Yearly Recommendation Cost,Additional Feedback,Reason for Choice,Reason Against First,Reason for Decline All,Alternative Plan\n';
      filteredAssessments.forEach((a) => {
        const totalSavings = a.recommendations
          .filter((r) => r.status === 'ACCEPTED')
          .reduce((sum, r) => sum + (r.annualSavings || 0), 0);

        // Format current biologic
        const currentBiologic = a.currentBiologic
          ? `${a.currentBiologic.name || ''}${a.currentBiologic.dose ? ' ' + a.currentBiologic.dose : ''}${a.currentBiologic.frequency ? ' ' + a.currentBiologic.frequency : ''}`
          : 'None';

        // Get feedback data (use first feedback entry if exists)
        const fb = a.feedback[0];
        const selectedTier = fb?.selectedTier || '';
        const assessmentTime = fb?.assessmentTimeMinutes || '';
        const formularyAccurate = fb?.formularyAccurate !== null && fb?.formularyAccurate !== undefined ? (fb.formularyAccurate ? 'Yes' : 'No') : '';
        const yearlyCost = fb?.yearlyRecommendationCost ? `$${fb.yearlyRecommendationCost}` : '';
        const additionalFeedback = (fb?.additionalFeedback || '').replace(/"/g, '""'); // Escape quotes
        const reasonForChoice = (fb?.reasonForChoice || '').replace(/"/g, '""');
        const reasonAgainstFirst = (fb?.reasonAgainstFirst || '').replace(/"/g, '""');
        const reasonForDeclineAll = (fb?.reasonForDeclineAll || '').replace(/"/g, '""');
        const alternativePlan = (fb?.alternativePlan || '').replace(/"/g, '""');

        csvContent += `"${a.mrn}","${a.providerName}","${formatDiagnosis(a.diagnosis)}","${a.isRemission ? 'Remission' : 'Active'}","${new Date(a.assessedAt).toLocaleDateString()}","${currentBiologic}",${a.recommendations.length},${a.recommendations.filter((r) => r.status === 'ACCEPTED').length},${a.recommendations.filter((r) => r.status === 'REJECTED').length},$${totalSavings.toLocaleString()},"${selectedTier}","${assessmentTime}","${formularyAccurate}","${yearlyCost}","${additionalFeedback}","${reasonForChoice}","${reasonAgainstFirst}","${reasonForDeclineAll}","${alternativePlan}"\n`;
      });
      filename = 'individual-assessments.csv';
    }

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const formatDiagnosis = (diagnosis: string) => {
    const map: Record<string, string> = {
      PSORIASIS: 'Psoriasis',
      ATOPIC_DERMATITIS: 'Atopic Dermatitis',
      HIDRADENITIS_SUPPURATIVA: 'Hidradenitis Suppurativa',
      OTHER: 'Other',
      UNKNOWN: 'Unknown',
    };
    return map[diagnosis] || diagnosis;
  };

  // Filter and sort data
  const filteredProviders = data
    ? data.byProvider
        .filter((p) =>
          p.name.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => {
          const aVal = a[sortKey as keyof ProviderStats];
          const bVal = b[sortKey as keyof ProviderStats];
          const multiplier = sortOrder === 'asc' ? 1 : -1;
          return (aVal > bVal ? 1 : -1) * multiplier;
        })
    : [];

  const filteredDiagnoses = data
    ? data.byDiagnosis
        .filter((d) =>
          formatDiagnosis(d.diagnosis)
            .toLowerCase()
            .includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => {
          const aVal = a[sortKey as keyof DiagnosisStats];
          const bVal = b[sortKey as keyof DiagnosisStats];
          const multiplier = sortOrder === 'asc' ? 1 : -1;
          return (aVal > bVal ? 1 : -1) * multiplier;
        })
    : [];

  const filteredAssessments = data
    ? data.assessmentDetails
        .filter((a) => {
          const matchesSearch =
            (a.mrn && a.mrn.toLowerCase().includes(searchTerm.toLowerCase())) ||
            a.providerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (a.patientName &&
              a.patientName.toLowerCase().includes(searchTerm.toLowerCase()));

          const matchesProvider =
            filterProvider === 'all' || a.providerName === filterProvider;

          const matchesDiagnosis =
            filterDiagnosis === 'all' || a.diagnosis === filterDiagnosis;

          // Date range filtering
          const assessmentDate = new Date(a.assessedAt);
          const matchesStartDate = !startDate || assessmentDate >= new Date(startDate);
          const matchesEndDate = !endDate || assessmentDate <= new Date(endDate + 'T23:59:59');

          return (
            matchesSearch &&
            matchesProvider &&
            matchesDiagnosis &&
            matchesStartDate &&
            matchesEndDate
          );
        })
        .sort((a, b) => {
          let aVal: any;
          let bVal: any;

          if (sortKey === 'mrn') {
            aVal = a.mrn;
            bVal = b.mrn;
          } else if (sortKey === 'name') {
            aVal = a.providerName;
            bVal = b.providerName;
          } else if (sortKey === 'assessedAt') {
            aVal = new Date(a.assessedAt).getTime();
            bVal = new Date(b.assessedAt).getTime();
          } else if (sortKey === 'acceptanceRate') {
            const aAccepted = a.recommendations.filter(
              (r) => r.status === 'ACCEPTED'
            ).length;
            const bAccepted = b.recommendations.filter(
              (r) => r.status === 'ACCEPTED'
            ).length;
            aVal =
              a.recommendations.length > 0
                ? (aAccepted / a.recommendations.length) * 100
                : 0;
            bVal =
              b.recommendations.length > 0
                ? (bAccepted / b.recommendations.length) * 100
                : 0;
          }

          const multiplier = sortOrder === 'asc' ? 1 : -1;
          return (aVal > bVal ? 1 : -1) * multiplier;
        })
    : [];

  // Login screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-white flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
          <div className="flex items-center justify-center mb-6">
            <BarChart3 className="h-12 w-12 text-primary-600" />
          </div>
          <h1 className="text-3xl font-bold text-center mb-2">Data Room</h1>
          <p className="text-gray-600 text-center mb-6">
            Enter password to access analytics dashboard
          </p>

          <form onSubmit={handleLogin}>
            <div className="mb-4">
              <label htmlFor="password" className="label">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="Enter data room password"
                autoFocus
              />
            </div>

            {authError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                {authError}
              </div>
            )}

            <button type="submit" className="btn btn-primary w-full">
              Access Data Room
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading analytics data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BarChart3 className="h-8 w-8 text-primary-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Data Room</h1>
                <p className="text-sm text-gray-600">
                  Provider Decision Analytics & Insights
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Logout
            </button>
          </div>

          {/* View Mode Tabs */}
          <div className="mt-4 flex gap-2 overflow-x-auto">
            {[
              { key: 'summary' as ViewMode, label: 'Summary', icon: Activity },
              { key: 'provider' as ViewMode, label: 'By Provider', icon: Users },
              {
                key: 'diagnosis' as ViewMode,
                label: 'By Diagnosis',
                icon: BarChart3,
              },
              {
                key: 'individual' as ViewMode,
                label: 'Individual Assessments',
                icon: Search,
              },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setViewMode(key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                  viewMode === key
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary View */}
        {viewMode === 'summary' && (
          <div className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Assessments</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">
                      {data.summary.totalAssessments}
                    </p>
                  </div>
                  <Activity className="h-12 w-12 text-primary-600" />
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">
                      AI Acceptance Rate
                    </p>
                    <p className="text-3xl font-bold text-green-600 mt-1">
                      {data.summary.overallAcceptanceRate.toFixed(1)}%
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {data.summary.assessmentsWithAcceptance} of{' '}
                      {data.summary.assessmentsWithFeedback} completed assessments
                    </p>
                  </div>
                  <TrendingUp className="h-12 w-12 text-green-600" />
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">
                      Total Potential Savings
                    </p>
                    <p className="text-3xl font-bold text-blue-600 mt-1">
                      ${data.summary.totalPotentialSavings.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      From accepted recommendations
                    </p>
                  </div>
                  <DollarSign className="h-12 w-12 text-blue-600" />
                </div>
              </div>
            </div>

            {/* Quick Stats by Provider */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  Provider Performance Overview
                </h2>
              </div>
              <div className="p-6">
                <div className="space-y-6">
                  {data.byProvider.slice(0, 5).map((provider) => (
                    <div
                      key={provider.name}
                      className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900 text-lg">
                            {provider.name}
                          </p>
                          <p className="text-sm text-gray-600">
                            {provider.totalAssessments} assessments
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-green-600">
                            {provider.acceptanceRate.toFixed(1)}%
                          </p>
                          <p className="text-xs text-gray-500">acceptance rate</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-gray-100">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Avg Time</p>
                          <p className={`text-sm font-semibold ${
                            provider.avgAssessmentTime && provider.avgAssessmentTime < 4
                              ? 'text-green-600'
                              : 'text-gray-900'
                          }`}>
                            {provider.avgAssessmentTime
                              ? `${provider.avgAssessmentTime.toFixed(1)} min`
                              : 'N/A'
                            }
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Most Selected</p>
                          <p className="text-sm font-semibold text-gray-900">
                            {provider.mostCommonOption
                              ? `Option ${provider.mostCommonOption}`
                              : 'N/A'
                            }
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Accepted</p>
                          <p className="text-sm font-semibold text-gray-900">
                            {provider.assessmentsWithAcceptance} / {provider.assessmentsWithFeedback}
                          </p>
                        </div>
                      </div>

                      {/* Option distribution bar */}
                      {(provider.optionSelections.option1 > 0 ||
                        provider.optionSelections.option2 > 0 ||
                        provider.optionSelections.option3 > 0) && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <p className="text-xs text-gray-500 mb-2">Option Distribution</p>
                          <div className="flex gap-1 h-2">
                            {provider.optionSelections.option1 > 0 && (
                              <div
                                className="bg-green-500 rounded"
                                style={{
                                  flex: provider.optionSelections.option1
                                }}
                                title={`Option 1: ${provider.optionSelections.option1}`}
                              />
                            )}
                            {provider.optionSelections.option2 > 0 && (
                              <div
                                className="bg-blue-500 rounded"
                                style={{
                                  flex: provider.optionSelections.option2
                                }}
                                title={`Option 2: ${provider.optionSelections.option2}`}
                              />
                            )}
                            {provider.optionSelections.option3 > 0 && (
                              <div
                                className="bg-purple-500 rounded"
                                style={{
                                  flex: provider.optionSelections.option3
                                }}
                                title={`Option 3: ${provider.optionSelections.option3}`}
                              />
                            )}
                          </div>
                          <div className="flex gap-3 mt-1 text-xs">
                            <span className="text-gray-600">
                              <span className="inline-block w-2 h-2 bg-green-500 rounded mr-1"></span>
                              Opt 1: {provider.optionSelections.option1}
                            </span>
                            <span className="text-gray-600">
                              <span className="inline-block w-2 h-2 bg-blue-500 rounded mr-1"></span>
                              Opt 2: {provider.optionSelections.option2}
                            </span>
                            <span className="text-gray-600">
                              <span className="inline-block w-2 h-2 bg-purple-500 rounded mr-1"></span>
                              Opt 3: {provider.optionSelections.option3}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Stats by Diagnosis */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  Diagnosis Overview
                </h2>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {data.byDiagnosis.map((diagnosis) => (
                    <div
                      key={diagnosis.diagnosis}
                      className="flex items-center justify-between"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">
                          {formatDiagnosis(diagnosis.diagnosis)}
                        </p>
                        <p className="text-sm text-gray-600">
                          {diagnosis.totalAssessments} assessments
                        </p>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-lg font-semibold text-gray-900">
                          {diagnosis.acceptanceRate.toFixed(1)}%
                        </p>
                        <p className="text-sm text-gray-600">
                          {diagnosis.acceptedCount} accepted
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Provider View */}
        {viewMode === 'provider' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex-1 max-w-md">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search providers..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="input pl-10"
                  />
                </div>
              </div>
              <button
                onClick={exportToCSV}
                className="btn btn-secondary flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </button>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center gap-2">
                        Provider
                        {sortKey === 'name' &&
                          (sortOrder === 'asc' ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          ))}
                      </div>
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('totalAssessments')}
                    >
                      <div className="flex items-center gap-2">
                        Assessments
                        {sortKey === 'totalAssessments' &&
                          (sortOrder === 'asc' ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          ))}
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Completed
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Accepted
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Declined All
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('acceptanceRate')}
                    >
                      <div className="flex items-center gap-2">
                        Acceptance Rate
                        {sortKey === 'acceptanceRate' &&
                          (sortOrder === 'asc' ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          ))}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredProviders.map((provider) => (
                    <tr key={provider.name} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">
                          {provider.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {provider.totalAssessments}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {provider.assessmentsWithFeedback}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                          {provider.assessmentsWithAcceptance}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                          {provider.assessmentsWithFeedback - provider.assessmentsWithAcceptance}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                            <div
                              className="bg-primary-600 h-2 rounded-full"
                              style={{
                                width: `${provider.acceptanceRate}%`,
                              }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium text-gray-900">
                            {provider.acceptanceRate.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        )}

        {/* Diagnosis View */}
        {viewMode === 'diagnosis' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex-1 max-w-md">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search diagnoses..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="input pl-10"
                  />
                </div>
              </div>
              <button
                onClick={exportToCSV}
                className="btn btn-secondary flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </button>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('diagnosis')}
                    >
                      <div className="flex items-center gap-2">
                        Diagnosis
                        {sortKey === 'diagnosis' &&
                          (sortOrder === 'asc' ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          ))}
                      </div>
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('totalAssessments')}
                    >
                      <div className="flex items-center gap-2">
                        Assessments
                        {sortKey === 'totalAssessments' &&
                          (sortOrder === 'asc' ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          ))}
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Completed
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Accepted
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Declined All
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('acceptanceRate')}
                    >
                      <div className="flex items-center gap-2">
                        Acceptance Rate
                        {sortKey === 'acceptanceRate' &&
                          (sortOrder === 'asc' ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          ))}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredDiagnoses.map((diagnosis) => (
                    <tr key={diagnosis.diagnosis} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">
                          {formatDiagnosis(diagnosis.diagnosis)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {diagnosis.totalAssessments}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {diagnosis.assessmentsWithFeedback}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                          {diagnosis.assessmentsWithAcceptance}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                          {diagnosis.assessmentsWithFeedback - diagnosis.assessmentsWithAcceptance}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                            <div
                              className="bg-primary-600 h-2 rounded-full"
                              style={{
                                width: `${diagnosis.acceptanceRate}%`,
                              }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium text-gray-900">
                            {diagnosis.acceptanceRate.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Detailed Diagnosis Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredDiagnoses.map((diagnosis) => (
                <div
                  key={diagnosis.diagnosis}
                  className="bg-white rounded-lg shadow"
                >
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {formatDiagnosis(diagnosis.diagnosis)}
                    </h3>
                  </div>
                  <div className="p-6">
                    <div className="text-sm text-gray-600">
                      <p className="font-medium text-gray-900 text-lg mb-2">
                        {diagnosis.acceptanceRate.toFixed(1)}% Acceptance Rate
                      </p>
                      <p>
                        {diagnosis.assessmentsWithAcceptance} accepted out of {diagnosis.assessmentsWithFeedback} completed assessments
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Individual Assessments View */}
        {viewMode === 'individual' && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="bg-white rounded-lg shadow p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search MRN or provider..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="input pl-10"
                  />
                </div>

                <select
                  value={filterProvider}
                  onChange={(e) => setFilterProvider(e.target.value)}
                  className="input"
                >
                  <option value="all">All Providers</option>
                  {data.byProvider.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>

                <select
                  value={filterDiagnosis}
                  onChange={(e) => setFilterDiagnosis(e.target.value)}
                  className="input"
                >
                  <option value="all">All Diagnoses</option>
                  {data.byDiagnosis.map((d) => (
                    <option key={d.diagnosis} value={d.diagnosis}>
                      {formatDiagnosis(d.diagnosis)}
                    </option>
                  ))}
                </select>

                <div>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="input"
                    placeholder="Start Date"
                  />
                </div>

                <div>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="input"
                    placeholder="End Date"
                  />
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  Showing {filteredAssessments.length} assessments
                </p>
                <button
                  onClick={exportToCSV}
                  className="btn btn-secondary flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Export CSV
                </button>
              </div>
            </div>

            {/* Assessments List */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('mrn')}
                    >
                      <div className="flex items-center gap-2">
                        MRN
                        {sortKey === 'mrn' &&
                          (sortOrder === 'asc' ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          ))}
                      </div>
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center gap-2">
                        Provider
                        {sortKey === 'name' &&
                          (sortOrder === 'asc' ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          ))}
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Diagnosis
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('assessedAt')}
                    >
                      <div className="flex items-center gap-2">
                        Assessment Date
                        {sortKey === 'assessedAt' &&
                          (sortOrder === 'asc' ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          ))}
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Decision Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Option Selected
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tier
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Time (min)
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('acceptanceRate')}
                    >
                      <div className="flex items-center gap-2">
                        Decision
                        {sortKey === 'acceptanceRate' &&
                          (sortOrder === 'asc' ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          ))}
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredAssessments.map((assessment) => {
                    const acceptedRec = assessment.recommendations.find(
                      (r) => r.status === 'ACCEPTED'
                    );
                    const acceptedCount = assessment.recommendations.filter(
                      (r) => r.status === 'ACCEPTED'
                    ).length;
                    const totalRecs = assessment.recommendations.length;
                    const feedback = assessment.feedback[0]; // Get most recent feedback

                    return (
                      <>
                        <tr key={assessment.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {assessment.mrn}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {assessment.providerName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatDiagnosis(assessment.diagnosis)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {new Date(assessment.assessedAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {acceptedRec?.decidedAt || feedback?.createdAt ? (
                              new Date(acceptedRec?.decidedAt || feedback?.createdAt).toLocaleDateString()
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {acceptedRec ? (
                              <span className="font-semibold text-green-700">
                                Option {acceptedRec.rank}
                              </span>
                            ) : feedback ? (
                              <span className="text-gray-500">None</span>
                            ) : (
                              <span className="text-gray-400">Pending</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {feedback?.selectedTier ? (
                              <span className="font-medium">Tier {feedback.selectedTier}</span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {feedback?.assessmentTimeMinutes ? (
                              <span className={feedback.assessmentTimeMinutes < 4 ? 'text-green-600 font-semibold' : ''}>
                                {Number(feedback.assessmentTimeMinutes).toFixed(1)}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                acceptedCount > 0
                                  ? 'bg-green-100 text-green-800'
                                  : feedback
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {acceptedCount > 0 ? 'Accepted' : feedback ? 'Declined All' : 'Pending'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {feedback && (
                              <button
                                onClick={() => {
                                  const expanded = expandedRows.includes(assessment.id);
                                  setExpandedRows(
                                    expanded
                                      ? expandedRows.filter((id) => id !== assessment.id)
                                      : [...expandedRows, assessment.id]
                                  );
                                }}
                                className="text-primary-600 hover:text-primary-800 font-medium"
                              >
                                {expandedRows.includes(assessment.id) ? 'Hide' : 'View'}
                              </button>
                            )}
                          </td>
                        </tr>
                        {/* Expanded Row with Detailed Feedback */}
                        {expandedRows.includes(assessment.id) && feedback && (
                          <tr key={`${assessment.id}-details`} className="bg-gray-50">
                            <td colSpan={11} className="px-6 py-4">
                              <div className="space-y-3 text-sm">
                                <h4 className="font-semibold text-gray-900">Provider Feedback Details</h4>

                                {/* Current Biologic Information */}
                                {assessment.currentBiologic && (
                                  <div className="pb-3 border-b border-gray-300">
                                    <span className="font-medium text-gray-700">Current Biologic:</span>{' '}
                                    {assessment.currentBiologic.name}
                                    {assessment.currentBiologic.dose && `, ${assessment.currentBiologic.dose}`}
                                    {assessment.currentBiologic.frequency && `, ${assessment.currentBiologic.frequency}`}
                                    {assessment.currentBiologicTier && (
                                      <> • <span className="font-medium">Tier {assessment.currentBiologicTier}</span></>
                                    )}
                                  </div>
                                )}

                                <div className="grid grid-cols-2 gap-4">
                                  {feedback.formularyAccurate !== null && (
                                    <div>
                                      <span className="font-medium text-gray-700">Formulary Accurate:</span>{' '}
                                      <span className={feedback.formularyAccurate ? 'text-green-600' : 'text-red-600'}>
                                        {feedback.formularyAccurate ? 'Yes' : 'No'}
                                      </span>
                                    </div>
                                  )}
                                  {feedback.yearlyRecommendationCost && (
                                    <div>
                                      <span className="font-medium text-gray-700">Yearly Cost:</span>{' '}
                                      ${Number(feedback.yearlyRecommendationCost).toLocaleString()}
                                    </div>
                                  )}
                                </div>
                                {feedback.reasonForChoice && (
                                  <div>
                                    <span className="font-medium text-gray-700">Reason for Choice:</span>
                                    <p className="mt-1 text-gray-600">{feedback.reasonForChoice}</p>
                                  </div>
                                )}
                                {feedback.reasonAgainstFirst && (
                                  <div>
                                    <span className="font-medium text-gray-700">Why Not First Option:</span>
                                    <p className="mt-1 text-gray-600">{feedback.reasonAgainstFirst}</p>
                                  </div>
                                )}
                                {feedback.reasonForDeclineAll && (
                                  <div>
                                    <span className="font-medium text-gray-700">Reason for Declining All:</span>
                                    <p className="mt-1 text-gray-600">{feedback.reasonForDeclineAll}</p>
                                  </div>
                                )}
                                {feedback.alternativePlan && (
                                  <div>
                                    <span className="font-medium text-gray-700">Alternative Plan:</span>
                                    <p className="mt-1 text-gray-600">{feedback.alternativePlan}</p>
                                  </div>
                                )}
                                {feedback.additionalFeedback && (
                                  <div>
                                    <span className="font-medium text-gray-700">Additional Feedback:</span>
                                    <p className="mt-1 text-gray-600">{feedback.additionalFeedback}</p>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
