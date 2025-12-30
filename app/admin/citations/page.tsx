'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Upload, FileText, ExternalLink, Edit2, Save, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import PasswordProtection from '@/components/PasswordProtection';
import { BIOLOGICS_DATA } from '@/lib/biologics-data';

// Get all biologic brand names from the master data source
const BIOLOGIC_DRUGS = BIOLOGICS_DATA.map(bio => bio.brand).sort();

const INDICATION_OPTIONS = [
  { value: 'PSORIASIS', label: 'Psoriasis' },
  { value: 'PSORIATIC_ARTHRITIS', label: 'Psoriatic Arthritis' },
  { value: 'ATOPIC_DERMATITIS', label: 'Atopic Dermatitis' },
  { value: 'HIDRADENITIS_SUPPURATIVA', label: 'Hidradenitis Suppurativa' },
  { value: 'CROHNS_DISEASE', label: "Crohn's Disease" },
  { value: 'ULCERATIVE_COLITIS', label: 'Ulcerative Colitis' },
  { value: 'RHEUMATOID_ARTHRITIS', label: 'Rheumatoid Arthritis' },
  { value: 'ANKYLOSING_SPONDYLITIS', label: 'Ankylosing Spondylitis' },
  { value: 'OTHER', label: 'Other' },
];

const STUDY_TYPE_OPTIONS = [
  { value: 'RCT', label: 'Randomized Controlled Trial' },
  { value: 'SYSTEMATIC_REVIEW', label: 'Systematic Review' },
  { value: 'META_ANALYSIS', label: 'Meta-Analysis' },
  { value: 'OBSERVATIONAL', label: 'Observational Study' },
  { value: 'CASE_SERIES', label: 'Case Series' },
  { value: 'REGISTRY', label: 'Registry Data' },
];

const CITATION_TYPE_OPTIONS = [
  { value: 'EFFICACY', label: 'Efficacy' },
  { value: 'SAFETY', label: 'Safety' },
  { value: 'BIOSIMILAR_EQUIVALENCE', label: 'Biosimilar Equivalence' },
  { value: 'HEAD_TO_HEAD', label: 'Head-to-Head Comparison' },
  { value: 'LONG_TERM_OUTCOMES', label: 'Long-term Outcomes' },
  { value: 'PHARMACOKINETICS', label: 'Pharmacokinetics' },
  { value: 'REAL_WORLD_EVIDENCE', label: 'Real-world Evidence' },
];

interface Citation {
  id: string;
  title: string;
  authors: string;
  journal: string;
  year: number;
  pmid: string | null;
  doi: string | null;
  studyType: string;
  citationType: string;
  sampleSize: number | null;
  population: string | null;
  pdfPath: string;
  pdfFileName: string;
  keyFindings: string;
  drugName: string[];
  indications: string[];
  referenceDrugName: string | null;
  reviewed: boolean;
  notes: string | null;
  uploadedAt: string;
}

interface ExtractedData {
  metadata: {
    title: string;
    authors: string;
    journal: string;
    year: number;
    pmid: string | null;
    doi: string | null;
    studyType: string;
    citationType: string;
    sampleSize: number | null;
    population: string | null;
    drugName: string[];
    indications: string[];
    referenceDrugName: string | null;
    keyFindings: string;
  };
  fullText: string;
  pdfFileName: string;
}

export default function CitationsPage() {
  const searchParams = useSearchParams();
  const [citations, setCitations] = useState<Citation[]>([]);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<Citation> | null>(null);
  const [uploadStatus, setUploadStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [notes, setNotes] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDrug, setFilterDrug] = useState('');
  const [filterIndication, setFilterIndication] = useState('');
  const [sortBy, setSortBy] = useState<'year' | 'type' | null>('year');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    loadCitations();
  }, []);

  // Pre-populate form from query parameters (for LLM-generated citations)
  useEffect(() => {
    if (!searchParams) return;

    const title = searchParams.get('title');
    const authors = searchParams.get('authors');
    const year = searchParams.get('year');
    const journal = searchParams.get('journal');
    const pmid = searchParams.get('pmid');
    const doi = searchParams.get('doi');
    const keyFindings = searchParams.get('keyFindings');
    const source = searchParams.get('source');

    if (title && authors && year && journal) {
      // Pre-populate the form with LLM-generated citation data
      setExtractedData({
        metadata: {
          title,
          authors,
          journal,
          year: parseInt(year),
          pmid: pmid || null,
          doi: doi || null,
          studyType: 'RCT', // Default to RCT for LLM-generated citations
          citationType: 'EFFICACY', // Default to EFFICACY
          sampleSize: null,
          population: null,
          drugName: [],
          indications: [],
          referenceDrugName: null,
          keyFindings: keyFindings || '',
        },
        fullText: '',
        pdfFileName: 'llm-generated-citation.pdf',
      });

      if (source === 'llm_generated') {
        setUploadStatus({
          success: true,
          message: 'Citation metadata from AI has been pre-filled. Please review carefully, fill in missing fields (drug names, indications), and upload a PDF of the study to save it to the database.',
        });
      }
    }
  }, [searchParams]);

  const loadCitations = async () => {
    try {
      const res = await fetch('/api/citations');
      if (res.ok) {
        const data = await res.json();
        setCitations(data);
      }
    } catch (error) {
      console.error('Error loading citations:', error);
    } finally {
      setLoading(false);
    }
  };

  // Step 1: Upload PDF and extract metadata
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setExtracting(true);
    setUploadStatus(null);

    try {
      const formData = new FormData();
      formData.append('pdf', file);

      const res = await fetch('/api/citations/extract', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setExtractedData(data);
        setUploadStatus({ success: true, message: 'Metadata extracted! Please review and edit if needed.' });
      } else {
        const error = await res.json();
        setUploadStatus({ success: false, message: error.error || 'Failed to extract metadata' });
      }
    } catch (error: any) {
      setUploadStatus({ success: false, message: error.message || 'Failed to extract metadata' });
    } finally {
      setExtracting(false);
    }
  };

  // Step 2: Save citation after review
  const handleSaveCitation = async () => {
    if (!extractedData || !selectedFile) {
      setUploadStatus({
        success: false,
        message: 'Please upload a PDF of the study before saving.',
      });
      return;
    }

    setUploading(true);
    setUploadStatus(null);

    try {
      const formData = new FormData();
      formData.append('pdf', selectedFile);
      formData.append('drugName', JSON.stringify(extractedData.metadata.drugName));
      formData.append('indications', JSON.stringify(extractedData.metadata.indications));
      formData.append('title', extractedData.metadata.title);
      formData.append('authors', extractedData.metadata.authors);
      formData.append('journal', extractedData.metadata.journal);
      formData.append('year', extractedData.metadata.year.toString());
      formData.append('studyType', extractedData.metadata.studyType);
      formData.append('citationType', extractedData.metadata.citationType);
      formData.append('keyFindings', extractedData.metadata.keyFindings);

      if (extractedData.metadata.pmid) formData.append('pmid', extractedData.metadata.pmid);
      if (extractedData.metadata.doi) formData.append('doi', extractedData.metadata.doi);
      if (extractedData.metadata.sampleSize) formData.append('sampleSize', extractedData.metadata.sampleSize.toString());
      if (extractedData.metadata.population) formData.append('population', extractedData.metadata.population);
      if (extractedData.metadata.referenceDrugName) formData.append('referenceDrugName', extractedData.metadata.referenceDrugName);
      if (notes) formData.append('notes', notes);

      const res = await fetch('/api/citations', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        setUploadStatus({ success: true, message: 'Citation saved successfully!' });
        setExtractedData(null);
        setSelectedFile(null);
        setNotes('');
        loadCitations();
      } else {
        const error = await res.json();
        setUploadStatus({ success: false, message: error.error || 'Failed to save citation' });
      }
    } catch (error: any) {
      setUploadStatus({ success: false, message: error.message || 'Failed to save citation' });
    } finally {
      setUploading(false);
    }
  };

  const handleCancelExtraction = () => {
    setExtractedData(null);
    setSelectedFile(null);
    setNotes('');
    setUploadStatus(null);
  };

  const handleIndicationToggle = (indication: string) => {
    if (!extractedData) return;
    setExtractedData({
      ...extractedData,
      metadata: {
        ...extractedData.metadata,
        indications: extractedData.metadata.indications.includes(indication)
          ? extractedData.metadata.indications.filter(i => i !== indication)
          : [...extractedData.metadata.indications, indication]
      }
    });
  };

  const handleEdit = (citation: Citation) => {
    setEditingId(citation.id);
    setEditFormData(citation);
  };

  const handleSaveEdit = async (citationId: string) => {
    if (!editFormData) return;

    try {
      const res = await fetch(`/api/citations/${citationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editFormData),
      });

      if (res.ok) {
        loadCitations();
        setEditingId(null);
        setEditFormData(null);
      } else {
        alert('Failed to update citation');
      }
    } catch (error) {
      console.error('Error updating citation:', error);
      alert('Failed to update citation');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditFormData(null);
  };

  const openPdf = async (citationId: string) => {
    try {
      const res = await fetch(`/api/citations/${citationId}/pdf`);
      if (res.ok) {
        const data = await res.json();
        window.open(data.url, '_blank');
      } else {
        alert('Failed to load PDF');
      }
    } catch (error) {
      console.error('Error opening PDF:', error);
      alert('Failed to open PDF');
    }
  };

  if (loading) {
    return (
      <PasswordProtection storageKey="manage_data_authenticated">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          </div>
        </div>
      </PasswordProtection>
    );
  }

  return (
    <PasswordProtection storageKey="manage_data_authenticated">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="mb-2">Clinical Citation Management</h1>
            <p className="text-gray-600">
              Upload PDFs and AI will automatically extract all citation metadata
            </p>
          </div>
          <a
            href="/admin/citations/extract-review"
            className="btn btn-secondary inline-flex items-center whitespace-nowrap"
          >
            <FileText className="w-4 h-4 mr-2" />
            Extract Comprehensive Review
          </a>
        </div>

        {/* Upload Form */}
        <div className="card mb-8">
          <h2 className="mb-6">Upload New Citation</h2>

          {uploadStatus && (
            <div className={`mb-4 p-3 rounded-lg ${uploadStatus.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <div className="flex items-center">
                {uploadStatus.success ? (
                  <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
                )}
                <p className={`text-sm ${uploadStatus.success ? 'text-green-900' : 'text-red-900'}`}>
                  {uploadStatus.message}
                </p>
              </div>
            </div>
          )}

          {!extractedData ? (
            // Step 1: Upload PDF
            <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
              <Upload className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Upload PDF to Extract Metadata</h3>
              <p className="text-gray-600 mb-6">
                GPT-5.2 will automatically extract all citation fields from your PDF
              </p>
              <label className="btn btn-primary cursor-pointer inline-flex items-center">
                {extracting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Extracting metadata...
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
                  onChange={handlePdfUpload}
                  disabled={extracting}
                />
              </label>
              {selectedFile && extracting && (
                <p className="text-sm text-gray-500 mt-4">
                  Processing {selectedFile.name}...
                </p>
              )}
            </div>
          ) : (
            // Step 2: Review and Edit Extracted Metadata
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900 font-medium">
                  {selectedFile ? (
                    <>✅ Metadata extracted from {selectedFile.name}</>
                  ) : (
                    <>✅ Citation metadata pre-filled from AI recommendation</>
                  )}
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  Review the fields below and edit if needed, then click "Save Citation"
                </p>
              </div>

              {/* PDF Upload for pre-populated citations */}
              {!selectedFile && (
                <div className="border-2 border-dashed border-blue-300 rounded-lg p-4 bg-blue-50">
                  <p className="text-sm font-medium text-blue-900 mb-3">
                    📄 Upload PDF (Required)
                  </p>
                  <p className="text-xs text-blue-700 mb-3">
                    Please upload the PDF of this study to add it to the database. This ensures we maintain full-text access for future reference.
                  </p>
                  <label className="btn btn-primary cursor-pointer inline-flex items-center">
                    {extracting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Extracting...
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
                      onChange={handlePdfUpload}
                      disabled={extracting}
                    />
                  </label>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="label">Drug Names * (Select all that apply)</label>
                  <div className="border rounded-lg p-4 max-h-60 overflow-y-auto">
                    <div className="grid grid-cols-2 gap-2">
                      {BIOLOGIC_DRUGS.map(drug => (
                        <label key={drug} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                          <input
                            type="checkbox"
                            checked={extractedData.metadata.drugName.includes(drug)}
                            onChange={(e) => {
                              const newDrugs = e.target.checked
                                ? [...extractedData.metadata.drugName, drug]
                                : extractedData.metadata.drugName.filter(d => d !== drug);
                              setExtractedData({
                                ...extractedData,
                                metadata: { ...extractedData.metadata, drugName: newDrugs }
                              });
                            }}
                            className="rounded border-gray-300"
                          />
                          <span className="text-sm">{drug}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  {extractedData.metadata.drugName.length === 0 && (
                    <p className="text-xs text-red-600 mt-1">Please select at least one drug</p>
                  )}
                </div>

                <div>
                  <label className="label">Reference Drug (for biosimilars)</label>
                  <select
                    className="input w-full"
                    value={extractedData.metadata.referenceDrugName || ''}
                    onChange={(e) => setExtractedData({
                      ...extractedData,
                      metadata: { ...extractedData.metadata, referenceDrugName: e.target.value || null }
                    })}
                  >
                    <option value="">None</option>
                    {BIOLOGIC_DRUGS.map(drug => (
                      <option key={drug} value={drug}>{drug}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="label">Indications *</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {INDICATION_OPTIONS.map(({ value, label }) => (
                    <label key={value} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={extractedData.metadata.indications.includes(value)}
                        onChange={() => handleIndicationToggle(value)}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-sm">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="label">Study Title *</label>
                  <input
                    type="text"
                    className="input w-full"
                    value={extractedData.metadata.title}
                    onChange={(e) => setExtractedData({
                      ...extractedData,
                      metadata: { ...extractedData.metadata, title: e.target.value }
                    })}
                  />
                </div>

                <div>
                  <label className="label">Authors *</label>
                  <input
                    type="text"
                    className="input w-full"
                    value={extractedData.metadata.authors}
                    onChange={(e) => setExtractedData({
                      ...extractedData,
                      metadata: { ...extractedData.metadata, authors: e.target.value }
                    })}
                  />
                </div>

                <div>
                  <label className="label">Journal *</label>
                  <input
                    type="text"
                    className="input w-full"
                    value={extractedData.metadata.journal}
                    onChange={(e) => setExtractedData({
                      ...extractedData,
                      metadata: { ...extractedData.metadata, journal: e.target.value }
                    })}
                  />
                </div>

                <div>
                  <label className="label">Year *</label>
                  <input
                    type="number"
                    className="input w-full"
                    value={extractedData.metadata.year}
                    onChange={(e) => setExtractedData({
                      ...extractedData,
                      metadata: { ...extractedData.metadata, year: parseInt(e.target.value) }
                    })}
                  />
                </div>

                <div>
                  <label className="label">PMID</label>
                  <input
                    type="text"
                    className="input w-full"
                    value={extractedData.metadata.pmid || ''}
                    onChange={(e) => setExtractedData({
                      ...extractedData,
                      metadata: { ...extractedData.metadata, pmid: e.target.value || null }
                    })}
                  />
                </div>

                <div>
                  <label className="label">DOI</label>
                  <input
                    type="text"
                    className="input w-full"
                    value={extractedData.metadata.doi || ''}
                    onChange={(e) => setExtractedData({
                      ...extractedData,
                      metadata: { ...extractedData.metadata, doi: e.target.value || null }
                    })}
                  />
                </div>

                <div>
                  <label className="label">Study Type *</label>
                  <select
                    className="input w-full"
                    value={extractedData.metadata.studyType}
                    onChange={(e) => setExtractedData({
                      ...extractedData,
                      metadata: { ...extractedData.metadata, studyType: e.target.value }
                    })}
                  >
                    {STUDY_TYPE_OPTIONS.map(({ value, label }) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">Citation Type *</label>
                  <select
                    className="input w-full"
                    value={extractedData.metadata.citationType}
                    onChange={(e) => setExtractedData({
                      ...extractedData,
                      metadata: { ...extractedData.metadata, citationType: e.target.value }
                    })}
                  >
                    {CITATION_TYPE_OPTIONS.map(({ value, label }) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">Sample Size</label>
                  <input
                    type="number"
                    className="input w-full"
                    value={extractedData.metadata.sampleSize || ''}
                    onChange={(e) => setExtractedData({
                      ...extractedData,
                      metadata: { ...extractedData.metadata, sampleSize: e.target.value ? parseInt(e.target.value) : null }
                    })}
                  />
                </div>

                <div>
                  <label className="label">Population</label>
                  <input
                    type="text"
                    className="input w-full"
                    value={extractedData.metadata.population || ''}
                    onChange={(e) => setExtractedData({
                      ...extractedData,
                      metadata: { ...extractedData.metadata, population: e.target.value || null }
                    })}
                  />
                </div>
              </div>

              <div>
                <label className="label">Key Findings</label>
                <textarea
                  className="input w-full"
                  rows={4}
                  value={extractedData.metadata.keyFindings}
                  onChange={(e) => setExtractedData({
                    ...extractedData,
                    metadata: { ...extractedData.metadata, keyFindings: e.target.value }
                  })}
                />
              </div>

              <div>
                <label className="label">Notes (optional)</label>
                <textarea
                  className="input w-full"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional notes or context"
                />
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={handleCancelExtraction}
                  disabled={uploading}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveCitation}
                  disabled={uploading}
                  className="btn btn-primary inline-flex items-center"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Citation
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Citations Table */}
        <div className="card">
          <div className="mb-6">
            <h2 className="mb-4">All Citations ({citations.length})</h2>

            {/* Search and Filter */}
            <div className="grid md:grid-cols-4 gap-4 mb-4">
              <div className="md:col-span-2">
                <input
                  type="text"
                  placeholder="Search by title or authors..."
                  className="input w-full"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div>
                <select
                  className="input w-full"
                  value={filterDrug}
                  onChange={(e) => setFilterDrug(e.target.value)}
                >
                  <option value="">All Drugs</option>
                  {Array.from(new Set(citations.flatMap(c => c.drugName))).sort().map(drug => (
                    <option key={drug} value={drug}>{drug}</option>
                  ))}
                </select>
              </div>
              <div>
                <select
                  className="input w-full"
                  value={filterIndication}
                  onChange={(e) => setFilterIndication(e.target.value)}
                >
                  <option value="">All Indications</option>
                  {INDICATION_OPTIONS.map(ind => (
                    <option key={ind.value} value={ind.value}>{ind.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {(() => {
            // Filter and sort citations
            let filtered = citations.filter(citation => {
              // Text search
              if (searchQuery) {
                const query = searchQuery.toLowerCase();
                const matchTitle = citation.title.toLowerCase().includes(query);
                const matchAuthors = citation.authors.toLowerCase().includes(query);
                if (!matchTitle && !matchAuthors) return false;
              }

              // Drug filter
              if (filterDrug && !citation.drugName.includes(filterDrug)) return false;

              // Indication filter
              if (filterIndication && !citation.indications.includes(filterIndication as any)) return false;

              return true;
            });

            // Sort
            if (sortBy === 'year') {
              filtered.sort((a, b) => sortOrder === 'desc' ? b.year - a.year : a.year - b.year);
            } else if (sortBy === 'type') {
              filtered.sort((a, b) => {
                const compare = a.citationType.localeCompare(b.citationType);
                return sortOrder === 'desc' ? -compare : compare;
              });
            }

            if (filtered.length === 0) {
              return (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-gray-600 mb-2">No Citations Found</h3>
                  <p className="text-sm text-gray-500">
                    {citations.length === 0 ? 'Upload your first PDF to get started' : 'Try adjusting your search or filters'}
                  </p>
                </div>
              );
            }

            return (
              <div className="overflow-x-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#CBD5E0 #F7FAFC' }}>
                <style jsx>{`
                  div::-webkit-scrollbar {
                    height: 12px;
                  }
                  div::-webkit-scrollbar-track {
                    background: #F7FAFC;
                    border-radius: 6px;
                  }
                  div::-webkit-scrollbar-thumb {
                    background: #CBD5E0;
                    border-radius: 6px;
                  }
                  div::-webkit-scrollbar-thumb:hover {
                    background: #A0AEC0;
                  }
                `}</style>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Drug
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Indications
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Title
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Authors
                      </th>
                      <th
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => {
                          if (sortBy === 'year') {
                            setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
                          } else {
                            setSortBy('year');
                            setSortOrder('desc');
                          }
                        }}
                      >
                        Year {sortBy === 'year' && (sortOrder === 'desc' ? '↓' : '↑')}
                      </th>
                      <th
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => {
                          if (sortBy === 'type') {
                            setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
                          } else {
                            setSortBy('type');
                            setSortOrder('asc');
                          }
                        }}
                      >
                        Type {sortBy === 'type' && (sortOrder === 'desc' ? '↓' : '↑')}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        PDF
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filtered.map((citation) => (
                    <tr key={citation.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 text-sm font-medium text-gray-900">
                        {editingId === citation.id ? (
                          <div className="border rounded-lg p-2 max-h-40 overflow-y-auto">
                            <div className="grid grid-cols-1 gap-2">
                              {BIOLOGIC_DRUGS.map(drug => (
                                <label key={drug} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                                  <input
                                    type="checkbox"
                                    checked={editFormData?.drugName?.includes(drug)}
                                    onChange={(e) => {
                                      const currentDrugs = editFormData?.drugName || [];
                                      const newDrugs = e.target.checked
                                        ? [...currentDrugs, drug]
                                        : currentDrugs.filter(d => d !== drug);
                                      setEditFormData({ ...editFormData, drugName: newDrugs });
                                    }}
                                    className="rounded border-gray-300"
                                  />
                                  <span className="text-sm">{drug}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {citation.drugName.map(drug => (
                              <span key={drug} className="px-2 py-1 bg-primary-100 text-primary-800 rounded text-xs font-medium">
                                {drug}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-500">
                        <div className="flex flex-wrap gap-1">
                          {citation.indications.map(ind => (
                            <span key={ind} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                              {INDICATION_OPTIONS.find(o => o.value === ind)?.label || ind}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900">
                        {editingId === citation.id ? (
                          <input
                            type="text"
                            className="input w-full text-sm"
                            value={editFormData?.title || ''}
                            onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                          />
                        ) : (
                          <div className="max-w-xs truncate" title={citation.title}>
                            {citation.title}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                        {citation.authors}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                        {citation.year}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm">
                        <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs">
                          {CITATION_TYPE_OPTIONS.find(o => o.value === citation.citationType)?.label || citation.citationType}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => openPdf(citation.id)}
                          className="text-primary-600 hover:text-primary-700 inline-flex items-center"
                        >
                          <ExternalLink className="w-4 h-4 mr-1" />
                          View
                        </button>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm">
                        {editingId === citation.id ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleSaveEdit(citation.id)}
                              className="text-green-600 hover:text-green-700"
                              title="Save"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="text-gray-600 hover:text-gray-700"
                              title="Cancel"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleEdit(citation)}
                            className="text-blue-600 hover:text-blue-700"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
      </div>
    </PasswordProtection>
  );
}
