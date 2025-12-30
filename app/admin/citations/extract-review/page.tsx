'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { Upload, Loader2, CheckCircle, AlertCircle, FileText, ArrowLeft, Download } from 'lucide-react';
import Link from 'next/link';
import PasswordProtection from '@/components/PasswordProtection';

interface ExtractionJob {
  id: string;
  status: string;
  progress: number;
  reviewTitle: string | null;
  reviewAuthors: string | null;
  reviewYear: number | null;
  totalStudies: number;
  studiesExtracted: number;
  studiesApproved: number;
  extractedStudies: ExtractedStudy[];
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
}

interface ExtractedStudy {
  id: string;
  title: string;
  authors: string;
  journal: string;
  year: number;
  drugName: string[];
  indications: string[];
  studyType: string;
  citationType: string;
  sampleSize: number | null;
  keyFindings: string;
  extractionConfidence: string;
  needsReview: boolean;
  approved: boolean;
}

export default function ExtractReviewPage() {
  const [uploading, setUploading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<ExtractionJob | null>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedStudies, setSelectedStudies] = useState<Set<string>>(new Set());
  const [approving, setApproving] = useState(false);

  // Poll for job status
  useEffect(() => {
    if (jobId && job?.status !== 'COMPLETED' && job?.status !== 'APPROVED' && job?.status !== 'FAILED') {
      const interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/citations/extract-review/${jobId}`);
          if (res.ok) {
            const data = await res.json();
            setJob(data);

            // Stop polling if completed or failed
            if (data.status === 'COMPLETED' || data.status === 'FAILED' || data.status === 'APPROVED') {
              if (pollingInterval) {
                clearInterval(pollingInterval);
                setPollingInterval(null);
              }
            }
          }
        } catch (error) {
          console.error('Error polling job status:', error);
        }
      }, 5000); // Poll every 5 seconds

      setPollingInterval(interval);

      return () => {
        clearInterval(interval);
      };
    }
  }, [jobId, job?.status]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('pdf', file);

      const res = await fetch('/api/citations/extract-review', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setJobId(data.jobId);
        // Initial status fetch
        const statusRes = await fetch(`/api/citations/extract-review/${data.jobId}`);
        if (statusRes.ok) {
          setJob(await statusRes.json());
        }
      } else {
        const error = await res.json();
        setUploadError(error.error || 'Failed to start extraction');
      }
    } catch (error: any) {
      setUploadError(error.message || 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const handleSelectAll = () => {
    if (!job) return;
    if (selectedStudies.size === job.extractedStudies.length) {
      setSelectedStudies(new Set());
    } else {
      setSelectedStudies(new Set(job.extractedStudies.map(s => s.id)));
    }
  };

  const handleToggleStudy = (studyId: string) => {
    const newSelected = new Set(selectedStudies);
    if (newSelected.has(studyId)) {
      newSelected.delete(studyId);
    } else {
      newSelected.add(studyId);
    }
    setSelectedStudies(newSelected);
  };

  const handleApprove = async () => {
    if (!jobId || selectedStudies.size === 0) return;

    setApproving(true);

    try {
      const res = await fetch(`/api/citations/extract-review/${jobId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studyIds: Array.from(selectedStudies),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        alert(`Successfully created ${data.createdCount} citations!`);

        // Refresh job status
        const statusRes = await fetch(`/api/citations/extract-review/${jobId}`);
        if (statusRes.ok) {
          setJob(await statusRes.json());
        }

        setSelectedStudies(new Set());
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to approve studies');
      }
    } catch (error: any) {
      alert(error.message || 'Failed to approve studies');
    } finally {
      setApproving(false);
    }
  };

  return (
    <PasswordProtection storageKey="manage_data_authenticated">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/admin/citations"
            className="text-primary-600 hover:text-primary-700 inline-flex items-center mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Citations
          </Link>
          <h1 className="mb-2">Extract Comprehensive Review</h1>
          <p className="text-gray-600">
            Upload a comprehensive review (Cochrane, meta-analysis) and automatically extract all individual studies
          </p>
        </div>

        {/* Upload Section (if no job) */}
        {!jobId && (
          <div className="card">
            <h2 className="mb-6">Upload Comprehensive Review</h2>

            {uploadError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200">
                <div className="flex items-center">
                  <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
                  <p className="text-sm text-red-900">{uploadError}</p>
                </div>
              </div>
            )}

            <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
              <Upload className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Upload Comprehensive Review PDF</h3>
              <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
                Upload a Cochrane review, network meta-analysis, or systematic review.
                The system will automatically extract all individual studies (up to 250+ studies).
                This process takes 1-2 hours.
              </p>
              <label className="btn btn-primary cursor-pointer inline-flex items-center">
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Starting extraction...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Choose PDF File
                  </>
                )}
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf"
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
              </label>
            </div>

            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-2">How it works:</h4>
              <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                <li>Upload your comprehensive review PDF (up to 99 pages)</li>
                <li>AI analyzes the entire document and extracts all study references</li>
                <li>Each individual study is extracted with metadata and key findings</li>
                <li>Review the extracted studies and approve the ones you want</li>
                <li>Approved studies become individual citation entries</li>
              </ol>
            </div>
          </div>
        )}

        {/* Extraction Progress */}
        {jobId && job && (
          <div className="space-y-6">
            {/* Progress Card */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="mb-1">
                    {job.reviewTitle || 'Processing Review...'}
                  </h2>
                  {job.reviewAuthors && (
                    <p className="text-sm text-gray-600">
                      {job.reviewAuthors} ({job.reviewYear})
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                    job.status === 'COMPLETED' || job.status === 'APPROVED'
                      ? 'bg-green-100 text-green-800'
                      : job.status === 'FAILED'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {job.status === 'ANALYZING_DOCUMENT' && 'Analyzing Document'}
                    {job.status === 'EXTRACTING_STUDIES' && 'Extracting Studies'}
                    {job.status === 'COMPLETED' && 'Extraction Complete'}
                    {job.status === 'APPROVED' && 'Approved'}
                    {job.status === 'FAILED' && 'Failed'}
                    {job.status === 'PENDING' && 'Starting...'}
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              {job.status === 'EXTRACTING_STUDIES' && job.totalStudies > 0 && (
                <div className="mb-4">
                  <div className="flex justify-between text-sm text-gray-600 mb-2">
                    <span>Extracting studies...</span>
                    <span>{job.studiesExtracted} / {job.totalStudies} ({job.progress}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${job.progress}%` }}
                    />
                  </div>
                </div>
              )}

              {job.status === 'ANALYZING_DOCUMENT' && (
                <div className="flex items-center text-gray-600">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  <span>Analyzing document structure and extracting references...</span>
                </div>
              )}

              {job.status === 'FAILED' && job.errorMessage && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                  <p className="text-sm text-red-900">{job.errorMessage}</p>
                </div>
              )}

              {(job.status === 'COMPLETED' || job.status === 'APPROVED') && (
                <div className="flex items-center text-green-700">
                  <CheckCircle className="w-5 h-5 mr-2" />
                  <span>
                    Extracted {job.extractedStudies.length} studies from review
                    {job.studiesApproved > 0 && ` (${job.studiesApproved} approved)`}
                  </span>
                </div>
              )}
            </div>

            {/* Extracted Studies Table */}
            {job.extractedStudies.length > 0 && (
              <div className="card">
                <div className="flex items-center justify-between mb-6">
                  <h2>Extracted Studies ({job.extractedStudies.length})</h2>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleSelectAll}
                      className="text-sm text-primary-600 hover:text-primary-700"
                    >
                      {selectedStudies.size === job.extractedStudies.length ? 'Deselect All' : 'Select All'}
                    </button>
                    <button
                      onClick={handleApprove}
                      disabled={selectedStudies.size === 0 || approving}
                      className="btn btn-primary inline-flex items-center disabled:opacity-50"
                    >
                      {approving ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Creating Citations...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Approve Selected ({selectedStudies.size})
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          <input
                            type="checkbox"
                            checked={selectedStudies.size === job.extractedStudies.length}
                            onChange={handleSelectAll}
                            className="rounded border-gray-300"
                          />
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Study</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Drugs</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">N</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Confidence</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {job.extractedStudies.map((study) => (
                        <tr key={study.id} className={`hover:bg-gray-50 ${study.approved ? 'bg-green-50' : ''}`}>
                          <td className="px-4 py-4">
                            <input
                              type="checkbox"
                              checked={selectedStudies.has(study.id) || study.approved}
                              onChange={() => handleToggleStudy(study.id)}
                              disabled={study.approved}
                              className="rounded border-gray-300"
                            />
                          </td>
                          <td className="px-4 py-4">
                            <div className="text-sm font-medium text-gray-900 max-w-md">
                              {study.title}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {study.authors} ({study.year})
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex flex-wrap gap-1">
                              {study.drugName.slice(0, 3).map(drug => (
                                <span key={drug} className="px-2 py-1 bg-primary-100 text-primary-800 rounded text-xs">
                                  {drug}
                                </span>
                              ))}
                              {study.drugName.length > 3 && (
                                <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                                  +{study.drugName.length - 3}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-600">
                            {study.studyType}
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-600">
                            {study.sampleSize || '—'}
                          </td>
                          <td className="px-4 py-4">
                            <span className={`px-2 py-1 rounded text-xs ${
                              study.extractionConfidence === 'high'
                                ? 'bg-green-100 text-green-800'
                                : study.extractionConfidence === 'medium'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {study.extractionConfidence}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </PasswordProtection>
  );
}
