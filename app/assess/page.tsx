'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import BiologicInput from '@/components/BiologicInput';

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  externalId: string | null;
  costDesignation?: 'HIGH_COST' | 'LOW_COST' | null;
}

interface InsurancePlan {
  id: string;
  planName: string;
  payerName: string;
  formularyVersion: string | null;
}

interface Provider {
  id: string;
  name: string;
}

export default function AssessmentPage() {
  const router = useRouter();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [insurancePlans, setInsurancePlans] = useState<InsurancePlan[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(false);
  const [claimsBiologic, setClaimsBiologic] = useState<any>(null); // Biologic from claims data
  const [showOverrideWarning, setShowOverrideWarning] = useState(false);
  const [pendingBiologicChange, setPendingBiologicChange] = useState<string | null>(null);
  const [showHighCostOnly, setShowHighCostOnly] = useState(false); // Filter for high cost patients
  const [showStabilityHelp, setShowStabilityHelp] = useState(false); // Stability decision support modal
  const [selectedPlanName, setSelectedPlanName] = useState<string>('');
  const [selectedFormularyVersion, setSelectedFormularyVersion] = useState<string>('');

  const [formData, setFormData] = useState({
    mrn: '',
    providerId: '',
    patientId: '',
    planId: '',
    notOnBiologic: false,
    currentBiologic: '',
    dose: '',
    frequency: '',
    diagnosis: 'PSORIASIS',
    hasPsoriaticArthritis: false,
    contraindications: [] as string[],
    failedTherapies: [] as string[],
    isStable: true,
    monthsStable: 3,
    additionalNotes: '',
  });

  useEffect(() => {
    fetch('/api/patients')
      .then(res => res.json())
      .then(data => {
        // Ensure data is an array before setting patients
        if (Array.isArray(data)) {
          setPatients(data);
        } else {
          console.error('Expected array of patients, got:', data);
          setPatients([]);
        }
      })
      .catch(err => {
        console.error('Failed to fetch patients:', err);
        setPatients([]);
      });
  }, []);

  // Fetch insurance plans
  useEffect(() => {
    fetch('/api/insurance-plans')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setInsurancePlans(data);
        } else {
          console.error('Expected array of insurance plans, got:', data);
          setInsurancePlans([]);
        }
      })
      .catch(err => {
        console.error('Failed to fetch insurance plans:', err);
        setInsurancePlans([]);
      });
  }, []);

  // Fetch providers
  useEffect(() => {
    fetch('/api/providers')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setProviders(data);
        } else {
          console.error('Expected array of providers, got:', data);
          setProviders([]);
        }
      })
      .catch(err => {
        console.error('Failed to fetch providers:', err);
        setProviders([]);
      });
  }, []);

  // Auto-fill current biologic from claims data (SOURCE OF TRUTH)
  const handlePatientChange = async (patientId: string) => {
    if (!patientId) {
      setFormData(prev => ({ ...prev, patientId: '', planId: '' }));
      setSelectedPlanName('');
      setSelectedFormularyVersion('');
      setClaimsBiologic(null);
      return;
    }

    try {
      // Fetch patient data with claims
      const res = await fetch(`/api/patients/${patientId}`);
      const patientData = await res.json();

      // Get biologic from claims (PRIMARY SOURCE)
      let biologicFromClaims = null;

      if (patientData.claims && patientData.claims.length > 0) {
        // Find most recent claim with NDC code
        const claimWithNdc = patientData.claims.find((claim: any) => claim.ndcCode);

        if (claimWithNdc?.ndcCode) {
          // Fetch drug info from NDC mapping
          const ndcRes = await fetch(`/api/ndc-lookup?ndc=${claimWithNdc.ndcCode}`);
          const drugInfo = await ndcRes.json();

          if (drugInfo && drugInfo.drugName) {
            biologicFromClaims = {
              drugName: drugInfo.drugName,
              dose: drugInfo.strength || 'As prescribed',
              frequency: 'As prescribed', // Can be inferred from claims pattern
              lastFillDate: claimWithNdc.fillDate,
              ndcCode: claimWithNdc.ndcCode,
            };
          }
        }
      }

      // Store claims biologic for override detection
      setClaimsBiologic(biologicFromClaims);

      // Auto-populate two-step plan selection if patient has a plan
      if (patientData.planId) {
        const patientPlan = insurancePlans.find(p => p.id === patientData.planId);
        if (patientPlan) {
          setSelectedPlanName(patientPlan.planName);
          setSelectedFormularyVersion(patientPlan.formularyVersion || '');
        }
      }

      // Auto-populate form with claims data if available
      if (biologicFromClaims) {
        setFormData(prev => ({
          ...prev,
          patientId,
          planId: patientData.planId || '',
          currentBiologic: biologicFromClaims.drugName,
          dose: biologicFromClaims.dose,
          frequency: biologicFromClaims.frequency,
        }));
      } else if (patientData.currentBiologics && patientData.currentBiologics.length > 0) {
        // Fall back to manual entry if no claims data
        const currentBio = patientData.currentBiologics[0];
        setFormData(prev => ({
          ...prev,
          patientId,
          planId: patientData.planId || '',
          currentBiologic: currentBio.drugName,
          dose: currentBio.dose,
          frequency: currentBio.frequency,
        }));
      } else {
        // No biologic data at all
        setFormData(prev => ({
          ...prev,
          patientId,
          planId: patientData.planId || '',
        }));
      }
    } catch (error) {
      console.error('Error fetching patient data:', error);
      setFormData({ ...formData, patientId });
    }
  };

  // Handle biologic change with override warning
  const handleBiologicChange = (newDrugName: string) => {
    // Check if this differs from claims data
    if (claimsBiologic && newDrugName.toLowerCase().trim() !== claimsBiologic.drugName.toLowerCase().trim()) {
      // Show override warning
      setPendingBiologicChange(newDrugName);
      setShowOverrideWarning(true);
    } else {
      // No conflict, just update
      setFormData(prev => ({ ...prev, currentBiologic: newDrugName }));
    }
  };

  // Confirm override
  const confirmOverride = () => {
    if (pendingBiologicChange !== null) {
      setFormData(prev => ({ ...prev, currentBiologic: pendingBiologicChange }));
    }
    setShowOverrideWarning(false);
    setPendingBiologicChange(null);
  };

  // Cancel override, keep claims data
  const cancelOverride = () => {
    setShowOverrideWarning(false);
    setPendingBiologicChange(null);
    // Revert to claims data
    if (claimsBiologic) {
      setFormData(prev => ({
        ...prev,
        currentBiologic: claimsBiologic.drugName,
        dose: claimsBiologic.dose,
        frequency: claimsBiologic.frequency,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate MRN
    if (!formData.mrn) {
      alert('Please enter a Medical Record Number (MRN).');
      return;
    }
    const mrnDigits = formData.mrn.replace(/\D/g, ''); // Remove non-digits
    if (mrnDigits.length < 5 || mrnDigits.length > 9) {
      alert('MRN must be 5-9 digits.');
      return;
    }

    // Validate insurance plan is selected
    if (!formData.planId) {
      alert('Please select an insurance plan.');
      return;
    }

    // Validate dosing info is provided when on biologic
    if (!formData.notOnBiologic) {
      if (!formData.currentBiologic) {
        alert('Please select a biologic medication.');
        return;
      }
      if (!formData.dose) {
        alert('Please select a dose for the biologic.');
        return;
      }
      if (!formData.frequency) {
        alert('Please select a dosing frequency.');
        return;
      }
    }

    setLoading(true);

    try {
      // Only update patient-specific data if a patient is selected
      if (formData.patientId) {
        // First, create/update current biologic (skip if not on biologic)
        if (!formData.notOnBiologic && formData.currentBiologic) {
          // Determine if this is an override
          const isOverride = claimsBiologic &&
            formData.currentBiologic.toLowerCase().trim() !== claimsBiologic.drugName.toLowerCase().trim();

          await fetch('/api/patients/' + formData.patientId + '/biologic', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              drugName: formData.currentBiologic,
              dose: formData.dose,
              frequency: formData.frequency,
              // Pass override tracking data
              isManualOverride: isOverride,
              claimsDrugName: claimsBiologic?.drugName || null,
              claimsDose: claimsBiologic?.dose || null,
              claimsFrequency: claimsBiologic?.frequency || null,
            }),
          });
        }

        // Create/update contraindications
        await fetch('/api/patients/' + formData.patientId + '/contraindications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contraindications: formData.contraindications,
          }),
        });
      }

      // Create assessment and generate recommendations
      const res = await fetch('/api/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mrn: mrnDigits, // Send only digits
          providerId: formData.providerId || null,
          patientId: formData.patientId || null,
          planId: formData.planId,
          currentBiologic: formData.notOnBiologic ? null : {
            drugName: formData.currentBiologic,
            dose: formData.dose,
            frequency: formData.frequency,
          },
          diagnosis: formData.diagnosis,
          hasPsoriaticArthritis: formData.hasPsoriaticArthritis,
          contraindications: formData.contraindications,
          failedTherapies: formData.failedTherapies,
          isStable: formData.isStable,
          monthsStable: formData.monthsStable,
          additionalNotes: formData.additionalNotes,
        }),
      });

      const data = await res.json();

      if (data.assessmentId) {
        router.push(`/recommendations/${data.assessmentId}`);
      }
    } catch (error) {
      console.error('Error creating assessment:', error);
      alert('Failed to create assessment');
    } finally {
      setLoading(false);
    }
  };

  const toggleContraindication = (type: string) => {
    setFormData(prev => ({
      ...prev,
      contraindications: prev.contraindications.includes(type)
        ? prev.contraindications.filter(c => c !== type)
        : [...prev.contraindications, type],
    }));
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="mb-2">New Assessment</h1>
      <p className="text-gray-600 mb-8">
        Complete this form to generate cost-saving recommendations. Select a patient to auto-populate data, or enter information manually.
      </p>

      <form onSubmit={handleSubmit} className="card space-y-6">
        {/* MRN Input */}
        <div>
          <label className="label">Medical Record Number (MRN) *</label>
          <input
            type="text"
            className="input w-full"
            value={formData.mrn}
            onChange={(e) => {
              // Only allow digits
              const value = e.target.value.replace(/\D/g, '');
              if (value.length <= 9) {
                setFormData(prev => ({ ...prev, mrn: value }));
              }
            }}
            placeholder="Enter 5-9 digit MRN"
            required
            maxLength={9}
          />
          <p className="text-xs text-gray-500 mt-1">
            Required: 5-9 digits
          </p>
        </div>

        {/* Provider Selection */}
        <div>
          <label className="label">Provider (optional)</label>
          <select
            className="input w-full"
            value={formData.providerId}
            onChange={(e) => setFormData(prev => ({ ...prev, providerId: e.target.value }))}
          >
            <option value="">Select a provider</option>
            {providers.map(provider => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Select the provider performing this assessment
          </p>
        </div>

        {/* Patient Selection */}
        <div>
          <label className="label">Patient (optional)</label>

          {/* High Cost Filter Checkbox */}
          <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-md">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showHighCostOnly}
                onChange={(e) => setShowHighCostOnly(e.target.checked)}
                className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-amber-900">
                Show High Cost Patients Only
              </span>
            </label>
            <p className="text-xs text-amber-700 mt-1 ml-6">
              Only high cost patients are eligible for this optimization service
            </p>
          </div>

          <select
            className="input w-full"
            value={formData.patientId}
            onChange={(e) => handlePatientChange(e.target.value)}
          >
            <option value="">Select a patient (or leave blank for manual entry)</option>
            {Array.isArray(patients) &&
              patients
                .filter(p => !showHighCostOnly || p.costDesignation === 'HIGH_COST')
                .map(p => (
                  <option key={p.id} value={p.id}>
                    {p.firstName} {p.lastName} {p.externalId ? `(${p.externalId})` : ''}
                    {p.costDesignation === 'HIGH_COST' ? ' [HIGH COST]' : ''}
                  </option>
                ))
            }
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Auto-fills claims data, health plan, and formulary information
          </p>
        </div>

        {/* Insurance Plan Selection - Two Step */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Step 1: Select Plan Name */}
          <div>
            <label className="label">Insurance Plan Name *</label>
            <select
              className="input w-full"
              value={selectedPlanName}
              onChange={(e) => {
                setSelectedPlanName(e.target.value);
                setSelectedFormularyVersion(''); // Reset formulary version when plan changes
                setFormData(prev => ({ ...prev, planId: '' })); // Reset planId
              }}
              required
            >
              <option value="">Select plan name</option>
              {Array.from(new Set(insurancePlans.map(p => p.planName))).map(name => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {/* Step 2: Select Formulary Version */}
          <div>
            <label className="label">
              Formulary Version *
              {!selectedPlanName && <span className="ml-1 text-xs text-gray-400">(select plan first)</span>}
            </label>
            <select
              className={`input w-full ${!selectedPlanName ? 'bg-gray-200 text-gray-500 cursor-not-allowed opacity-60' : ''}`}
              value={selectedFormularyVersion}
              onChange={(e) => {
                setSelectedFormularyVersion(e.target.value);
                // Find matching plan and set planId
                const matchingPlan = insurancePlans.find(
                  p => p.planName === selectedPlanName && p.formularyVersion === e.target.value
                );
                if (matchingPlan) {
                  setFormData(prev => ({ ...prev, planId: matchingPlan.id }));
                }
              }}
              disabled={!selectedPlanName}
              required
              style={!selectedPlanName ? { pointerEvents: 'none' } : {}}
            >
              <option value="">
                {!selectedPlanName ? '-- Disabled --' : 'Select formulary version'}
              </option>
              {selectedPlanName && insurancePlans
                .filter(p => p.planName === selectedPlanName)
                .map(plan => (
                  <option key={plan.id} value={plan.formularyVersion || ''}>
                    {plan.formularyVersion || 'Default'}
                  </option>
                ))}
            </select>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {formData.patientId ? 'Auto-populated from patient record' : 'Required to determine formulary and coverage'}
        </p>

        {/* Current Biologic */}
        <div>
          <label className="flex items-center mb-3">
            <input
              type="checkbox"
              checked={formData.notOnBiologic}
              onChange={(e) => setFormData({ ...formData, notOnBiologic: e.target.checked, currentBiologic: '', dose: '', frequency: '' })}
              className="mr-2"
            />
            Patient not currently on biologic
          </label>

          {!formData.notOnBiologic && (
            <>
              {claimsBiologic && (
                <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-sm text-blue-800">
                    <strong>Claims data:</strong> {claimsBiologic.drugName} {claimsBiologic.dose} {claimsBiologic.frequency}
                    <br />
                    <span className="text-xs text-blue-600">
                      Last fill: {new Date(claimsBiologic.lastFillDate).toLocaleDateString()}
                    </span>
                  </p>
                </div>
              )}
              <BiologicInput
                value={{
                  drugName: formData.currentBiologic,
                  dose: formData.dose,
                  frequency: formData.frequency,
                }}
                onChange={(value) => {
                  // Check if drug name changed (trigger override warning)
                  if (value.drugName !== formData.currentBiologic) {
                    handleBiologicChange(value.drugName);
                  }
                  // Update dose and frequency without warning
                  setFormData(prev => ({
                    ...prev,
                    dose: value.dose,
                    frequency: value.frequency,
                  }));
                }}
                required={!formData.notOnBiologic}
              />
            </>
          )}
        </div>

        {/* Failed Therapies */}
        <div>
          <label className="label">Failed Therapies (optional)</label>
          <p className="text-xs text-gray-500 mb-2">
            Select biologics that have previously failed for this patient. These will be excluded from recommendations.
          </p>
          <BiologicInput
            value={{
              drugName: '',
              dose: '',
              frequency: '',
            }}
            onChange={(value) => {
              if (value.drugName && !formData.failedTherapies.includes(value.drugName)) {
                setFormData(prev => ({
                  ...prev,
                  failedTherapies: [...prev.failedTherapies, value.drugName],
                }));
              }
            }}
            required={false}
            placeholder="Select a failed therapy to add"
          />
          {formData.failedTherapies.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {formData.failedTherapies.map((therapy) => (
                <div
                  key={therapy}
                  className="inline-flex items-center gap-2 px-3 py-1 bg-red-50 border border-red-200 rounded-md text-sm"
                >
                  <span className="text-red-900">{therapy}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        failedTherapies: prev.failedTherapies.filter(t => t !== therapy),
                      }));
                    }}
                    className="text-red-600 hover:text-red-800"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Indication */}
        <div>
          <label className="label">Indication *</label>
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                name="diagnosis"
                value="PSORIASIS"
                checked={formData.diagnosis === 'PSORIASIS'}
                onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value as any })}
                className="mr-2"
              />
              Psoriasis
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="diagnosis"
                value="ATOPIC_DERMATITIS"
                checked={formData.diagnosis === 'ATOPIC_DERMATITIS'}
                onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value as any })}
                className="mr-2"
              />
              Atopic Dermatitis (Eczema)
            </label>
          </div>
        </div>

        {/* Psoriatic Arthritis */}
        <div>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.hasPsoriaticArthritis}
              onChange={(e) => setFormData({ ...formData, hasPsoriaticArthritis: e.target.checked })}
              className="mr-2"
            />
            Psoriatic Arthritis present
          </label>
        </div>

        {/* Contraindications */}
        <div>
          <label className="label">Contraindications (select all that apply)</label>
          <div className="space-y-2">
            {[
              { value: 'DRUG_ALLERGY', label: 'Drug allergies' },
              { value: 'HEART_FAILURE', label: 'Heart failure' },
              { value: 'MULTIPLE_SCLEROSIS', label: 'Multiple sclerosis' },
              { value: 'INFLAMMATORY_BOWEL_DISEASE', label: 'Inflammatory bowel disease' },
              { value: 'ACTIVE_INFECTION', label: 'Active infection' },
              { value: 'PREGNANCY', label: 'Pregnancy/planning pregnancy' },
            ].map(({ value, label }) => (
              <label key={value} className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.contraindications.includes(value)}
                  onChange={() => toggleContraindication(value)}
                  className="mr-2"
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        {/* Remission Status */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="label mb-0">Remission Status *</label>
            <button
              type="button"
              onClick={() => setShowStabilityHelp(true)}
              className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              How do I define remission?
            </button>
          </div>
          <div className="space-y-2">
            <label className="flex items-center p-3 border rounded-md cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="stability"
                checked={formData.isStable}
                onChange={() => setFormData(prev => ({ ...prev, isStable: true }))}
                className="mr-3"
              />
              <div>
                <div className="font-medium">Patient is in remission</div>
                <div className="text-xs text-gray-500">Disease is well-controlled with current therapy</div>
              </div>
            </label>
            <label className="flex items-center p-3 border rounded-md cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="stability"
                checked={!formData.isStable}
                onChange={() => setFormData(prev => ({ ...prev, isStable: false }))}
                className="mr-3"
              />
              <div>
                <div className="font-medium">Disease is active</div>
                <div className="text-xs text-gray-500">Disease is not adequately controlled</div>
              </div>
            </label>
          </div>
        </div>

        {/* Time in Remission */}
        <div>
          <label className="label">Time in Current Remission (months) *</label>
          <input
            type="number"
            min="0"
            max="120"
            className="input w-full"
            value={formData.monthsStable}
            onChange={(e) => setFormData({ ...formData, monthsStable: Number(e.target.value) })}
            required
          />
        </div>

        {/* Additional Notes */}
        <div>
          <label className="label">Additional Notes (optional)</label>
          <textarea
            className="input w-full"
            rows={4}
            value={formData.additionalNotes}
            onChange={(e) => setFormData({ ...formData, additionalNotes: e.target.value })}
            placeholder="Any additional clinical context..."
          />
        </div>

        {/* Submit */}
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => router.push('/')}
            className="btn btn-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary flex items-center justify-center"
          >
            {loading ? (
              <>
                <svg className="spinner w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Generating Recommendations...
              </>
            ) : (
              <>
                Generate Recommendations
                <ChevronRight className="w-4 h-4 ml-2" />
              </>
            )}
          </button>
        </div>
      </form>

      {/* Override Warning Dialog */}
      {showOverrideWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Override Claims Data?
            </h3>
            <div className="space-y-3 mb-6">
              <p className="text-sm text-gray-700">
                You're trying to change the biologic to <strong>{pendingBiologicChange}</strong>,
                but claims data shows the patient is currently on <strong>{claimsBiologic?.drugName}</strong>.
              </p>
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                <p className="text-xs text-yellow-800">
                  <strong>Claims data (last fill {claimsBiologic && new Date(claimsBiologic.lastFillDate).toLocaleDateString()}):</strong>
                  <br />
                  {claimsBiologic?.drugName} {claimsBiologic?.dose} {claimsBiologic?.frequency}
                </p>
              </div>
              <p className="text-sm text-gray-600">
                Do you want to override the claims data for this patient?
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={cancelOverride}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                No, Keep Claims Data
              </button>
              <button
                onClick={confirmOverride}
                className="flex-1 px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
              >
                Yes, Override
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remission Decision Support Modal */}
      {showStabilityHelp && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                How to Define Remission in Psoriasis
              </h3>
              <button
                onClick={() => setShowStabilityHelp(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4 text-sm text-gray-700">
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Clinical Definition of Remission</h4>
                <p>
                  A patient is considered <strong>in remission</strong> when their psoriasis is well-controlled on current therapy,
                  with minimal disease activity and impact on quality of life. Consider the patient in remission if they meet most of the following criteria:
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <h4 className="font-semibold text-blue-900 mb-2">DLQI (Dermatology Life Quality Index)</h4>
                <p className="mb-2">Score range: 0-30 (lower is better)</p>
                <ul className="list-disc list-inside space-y-1 text-blue-900">
                  <li><strong>0-1:</strong> No impact on life - Patient is in remission</li>
                  <li><strong>2-5:</strong> Small impact on life - Patient is in remission</li>
                  <li><strong>6-10:</strong> Moderate impact - Consider disease is active</li>
                  <li><strong>11-20:</strong> Large impact - Disease is active</li>
                  <li><strong>21-30:</strong> Extremely large impact - Disease is active</li>
                </ul>
                <p className="mt-2 text-xs text-blue-800">
                  <strong>Rule of thumb:</strong> DLQI ≤ 5 typically indicates remission
                </p>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-md p-4">
                <h4 className="font-semibold text-green-900 mb-2">PASI (Psoriasis Area and Severity Index)</h4>
                <p className="mb-2">Score range: 0-72 (lower is better)</p>
                <ul className="list-disc list-inside space-y-1 text-green-900">
                  <li><strong>0-5:</strong> Mild psoriasis - Patient is in remission</li>
                  <li><strong>5-10:</strong> Moderate psoriasis - May be in remission depending on patient goals</li>
                  <li><strong>10+:</strong> Severe psoriasis - Disease is active</li>
                </ul>
                <p className="mt-2 text-xs text-green-800">
                  <strong>Clinical trials standard:</strong> PASI 75 (75% improvement from baseline) or better indicates good response
                </p>
              </div>

              <div className="bg-purple-50 border border-purple-200 rounded-md p-4">
                <h4 className="font-semibold text-purple-900 mb-2">BSA (Body Surface Area)</h4>
                <p className="mb-2">Percentage of body covered by psoriasis</p>
                <ul className="list-disc list-inside space-y-1 text-purple-900">
                  <li><strong>&lt;3%:</strong> Mild psoriasis - Patient is likely in remission</li>
                  <li><strong>3-10%:</strong> Moderate psoriasis - Evaluate if in remission based on location and impact</li>
                  <li><strong>&gt;10%:</strong> Severe psoriasis - Disease is active</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Additional Considerations</h4>
                <ul className="list-disc list-inside space-y-1">
                  <li>Duration of remission: Patient should maintain control for at least 3 months</li>
                  <li>Special areas: Psoriasis on palms, soles, scalp, or genitals has greater impact even with lower BSA</li>
                  <li>Patient satisfaction: Patient reports being satisfied with current level of control</li>
                  <li>No recent flares: No significant disease worsening in past 3-6 months</li>
                </ul>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
                <p className="text-xs text-amber-900">
                  <strong>Note:</strong> Use your clinical judgment. These are guidelines, not absolute rules.
                  Consider the whole patient picture including comorbidities, treatment goals, and patient preferences.
                </p>
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={() => setShowStabilityHelp(false)}
                className="w-full px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
