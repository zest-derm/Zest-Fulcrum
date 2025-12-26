'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { Upload, FileText, ExternalLink, Edit2, Save, X, CheckCircle, AlertCircle } from 'lucide-react';
import PasswordProtection from '@/components/PasswordProtection';

// Comprehensive list of biologics for dermatology (originals + biosimilars)
const BIOLOGIC_DRUGS = [
  // TNF Inhibitors - Originals
  'Humira', 'Enbrel', 'Remicade', 'Cimzia', 'Simponi',
  // TNF Inhibitors - Biosimilars
  'Amjevita', 'Cyltezo', 'Hadlima', 'Hyrimoz', 'Yusimry', 'Abrilada', 'Idacio',
  'Erelzi', 'Eticovo',
  'Avsola', 'Inflectra', 'Ixifi', 'Renflexis', 'Zymfentra',
  // IL-23 Inhibitors
  'Skyrizi', 'Tremfya', 'Omvoh', 'Ilumya',
  // IL-17 Inhibitors
  'Cosentyx', 'Taltz', 'Siliq', 'Bimzelx',
  // IL-4/13 Inhibitors
  'Dupixent', 'Adbry',
  // JAK Inhibitors
  'Rinvoq', 'Cibinqo', 'Sotyktu', 'Opzelura',
  // TYK2 Inhibitors
  'Sotyktu',
].sort();

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
  drugName: string;
  indications: string[];
  referenceDrugName: string | null;
  reviewed: boolean;
  notes: string | null;
  uploadedAt: string;
}

interface FormData {
  drugName: string;
  indications: string[];
  referenceDrugName: string;
  title: string;
  authors: string;
  journal: string;
  year: string;
  pmid: string;
  doi: string;
  studyType: string;
  citationType: string;
  sampleSize: string;
  population: string;
  keyFindings: string;
  notes: string;
}

export default function CitationsPage() {
  const [citations, setCitations] = useState<Citation[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<Citation> | null>(null);
  const [uploadStatus, setUploadStatus] = useState<{ success: boolean; message: string } | null>(null);

  const [formData, setFormData] = useState<FormData>({
    drugName: '',
    indications: [],
    referenceDrugName: '',
    title: '',
    authors: '',
    journal: '',
    year: '',
    pmid: '',
    doi: '',
    studyType: 'RCT',
    citationType: 'EFFICACY',
    sampleSize: '',
    population: '',
    keyFindings: '',
    notes: '',
  });

  useEffect(() => {
    loadCitations();
  }, []);

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleIndicationToggle = (indication: string) => {
    setFormData(prev => ({
      ...prev,
      indications: prev.indications.includes(indication)
        ? prev.indications.filter(i => i !== indication)
        : [...prev.indications, indication]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedFile) {
      alert('Please select a PDF file');
      return;
    }

    setUploading(true);
    setUploadStatus(null);

    try {
      const uploadFormData = new FormData();
      uploadFormData.append('pdf', selectedFile);
      uploadFormData.append('drugName', formData.drugName);
      uploadFormData.append('indications', JSON.stringify(formData.indications));
      uploadFormData.append('title', formData.title);
      uploadFormData.append('authors', formData.authors);
      uploadFormData.append('journal', formData.journal);
      uploadFormData.append('year', formData.year);
      uploadFormData.append('studyType', formData.studyType);
      uploadFormData.append('citationType', formData.citationType);

      if (formData.pmid) uploadFormData.append('pmid', formData.pmid);
      if (formData.doi) uploadFormData.append('doi', formData.doi);
      if (formData.sampleSize) uploadFormData.append('sampleSize', formData.sampleSize);
      if (formData.population) uploadFormData.append('population', formData.population);
      if (formData.referenceDrugName) uploadFormData.append('referenceDrugName', formData.referenceDrugName);
      if (formData.keyFindings) uploadFormData.append('keyFindings', formData.keyFindings);
      if (formData.notes) uploadFormData.append('notes', formData.notes);

      const res = await fetch('/api/citations', {
        method: 'POST',
        body: uploadFormData,
      });

      const result = await res.json();

      if (res.ok) {
        setUploadStatus({ success: true, message: 'Citation uploaded successfully!' });
        setSelectedFile(null);
        setFormData({
          drugName: '',
          indications: [],
          referenceDrugName: '',
          title: '',
          authors: '',
          journal: '',
          year: '',
          pmid: '',
          doi: '',
          studyType: 'RCT',
          citationType: 'EFFICACY',
          sampleSize: '',
          population: '',
          keyFindings: '',
          notes: '',
        });
        loadCitations();
      } else {
        setUploadStatus({ success: false, message: result.error || 'Upload failed' });
      }
    } catch (error: any) {
      setUploadStatus({ success: false, message: error.message || 'Upload failed' });
    } finally {
      setUploading(false);
    }
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
          <p>Loading citations...</p>
        </div>
      </PasswordProtection>
    );
  }

  return (
    <PasswordProtection storageKey="manage_data_authenticated">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="mb-2">Clinical Citation Management</h1>
          <p className="text-gray-600">
            Upload and manage peer-reviewed literature citations for biologic recommendations
          </p>
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

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Drug Selection */}
              <div>
                <label className="label">Drug Name *</label>
                <select
                  className="input w-full"
                  value={formData.drugName}
                  onChange={(e) => setFormData({ ...formData, drugName: e.target.value })}
                  required
                >
                  <option value="">Select drug...</option>
                  {BIOLOGIC_DRUGS.map(drug => (
                    <option key={drug} value={drug}>{drug}</option>
                  ))}
                </select>
              </div>

              {/* Reference Drug (for biosimilars) */}
              <div>
                <label className="label">Reference Drug (for biosimilars)</label>
                <select
                  className="input w-full"
                  value={formData.referenceDrugName}
                  onChange={(e) => setFormData({ ...formData, referenceDrugName: e.target.value })}
                >
                  <option value="">None</option>
                  {BIOLOGIC_DRUGS.filter(d => !d.includes('biosimilar')).map(drug => (
                    <option key={drug} value={drug}>{drug}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Select parent drug if this is a biosimilar equivalence study
                </p>
              </div>
            </div>

            {/* Indications */}
            <div>
              <label className="label">Indications *</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {INDICATION_OPTIONS.map(({ value, label }) => (
                  <label key={value} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.indications.includes(value)}
                      onChange={() => handleIndicationToggle(value)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Citation Metadata */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="label">Study Title *</label>
                <input
                  type="text"
                  className="input w-full"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="label">Authors *</label>
                <input
                  type="text"
                  className="input w-full"
                  value={formData.authors}
                  onChange={(e) => setFormData({ ...formData, authors: e.target.value })}
                  placeholder="Smith J, Doe A, et al."
                  required
                />
              </div>

              <div>
                <label className="label">Journal *</label>
                <input
                  type="text"
                  className="input w-full"
                  value={formData.journal}
                  onChange={(e) => setFormData({ ...formData, journal: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="label">Year *</label>
                <input
                  type="number"
                  className="input w-full"
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                  min="1900"
                  max={new Date().getFullYear()}
                  required
                />
              </div>

              <div>
                <label className="label">PMID</label>
                <input
                  type="text"
                  className="input w-full"
                  value={formData.pmid}
                  onChange={(e) => setFormData({ ...formData, pmid: e.target.value })}
                  placeholder="12345678"
                />
              </div>

              <div>
                <label className="label">DOI</label>
                <input
                  type="text"
                  className="input w-full"
                  value={formData.doi}
                  onChange={(e) => setFormData({ ...formData, doi: e.target.value })}
                  placeholder="10.1000/journal.1234"
                />
              </div>

              <div>
                <label className="label">Study Type *</label>
                <select
                  className="input w-full"
                  value={formData.studyType}
                  onChange={(e) => setFormData({ ...formData, studyType: e.target.value })}
                  required
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
                  value={formData.citationType}
                  onChange={(e) => setFormData({ ...formData, citationType: e.target.value })}
                  required
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
                  value={formData.sampleSize}
                  onChange={(e) => setFormData({ ...formData, sampleSize: e.target.value })}
                  placeholder="100"
                />
              </div>

              <div>
                <label className="label">Population</label>
                <input
                  type="text"
                  className="input w-full"
                  value={formData.population}
                  onChange={(e) => setFormData({ ...formData, population: e.target.value })}
                  placeholder="Moderate-to-severe plaque psoriasis"
                />
              </div>
            </div>

            {/* Key Findings */}
            <div>
              <label className="label">Key Findings</label>
              <textarea
                className="input w-full"
                rows={4}
                value={formData.keyFindings}
                onChange={(e) => setFormData({ ...formData, keyFindings: e.target.value })}
                placeholder="Brief summary of key findings (AI will extract from PDF if left blank)"
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave blank to have AI extract key findings from the PDF automatically
              </p>
            </div>

            {/* Notes */}
            <div>
              <label className="label">Notes</label>
              <textarea
                className="input w-full"
                rows={2}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes or context"
              />
            </div>

            {/* PDF Upload */}
            <div>
              <label className="label">PDF File *</label>
              <div className="flex items-center gap-4">
                <label className="btn btn-secondary cursor-pointer inline-flex items-center">
                  <Upload className="w-4 h-4 mr-2" />
                  Choose PDF
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf"
                    onChange={handleFileChange}
                    required
                  />
                </label>
                {selectedFile && (
                  <span className="text-sm text-gray-600 flex items-center">
                    <FileText className="w-4 h-4 mr-1" />
                    {selectedFile.name}
                  </span>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={uploading}
                className="btn btn-primary inline-flex items-center disabled:cursor-wait"
              >
                {uploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Citation
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Citations Table */}
        <div className="card">
          <h2 className="mb-4">All Citations ({citations.length})</h2>

          {citations.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-gray-600 mb-2">No Citations Yet</h3>
              <p className="text-sm text-gray-500">
                Upload your first citation to get started
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Year
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
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
                  {citations.map((citation) => (
                    <tr key={citation.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {editingId === citation.id ? (
                          <input
                            type="text"
                            className="input w-full text-sm"
                            value={editFormData?.drugName || ''}
                            onChange={(e) => setEditFormData({ ...editFormData, drugName: e.target.value })}
                          />
                        ) : (
                          citation.drugName
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
          )}
        </div>
      </div>
    </PasswordProtection>
  );
}
