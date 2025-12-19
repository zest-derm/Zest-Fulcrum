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
  const [selectedPlanName, setSelectedPlanName] = useState<string>('');
  const [selectedFormularyVersion, setSelectedFormularyVersion] = useState<string>('');

  const [formData, setFormData] = useState({
    providerId: '',
    patientId: '',
    planId: '',
    medicationType: 'biologic' as 'biologic' | 'topical',
    notOnBiologic: false,
    currentBiologic: '',
    dose: '',
    frequency: '',
    diagnosis: 'PSORIASIS',
    hasPsoriaticArthritis: false,
    contraindications: [] as string[],
    failedTherapies: [] as string[],
    isStable: true,
    bmi: '' as '' | '<25' | '25-30' | '>30',
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

    // Validate provider is selected
    if (!formData.providerId) {
      alert('Please select a provider.');
      return;
    }

    // Validate partner is selected
    if (!formData.planId) {
      alert('Please select a partner and formulary.');
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
          providerId: formData.providerId,
          patientId: formData.patientId || null,
          planId: formData.planId,
          medicationType: formData.medicationType,
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
          bmi: formData.bmi || null,
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
        Complete this form to generate cost-saving recommendations for your patient.
      </p>

      <form onSubmit={handleSubmit} className="card space-y-6">
        {/* Provider Selection */}
        <div>
          <label className="label">Provider *</label>
          <select
            className="input w-full"
            value={formData.providerId}
            onChange={(e) => setFormData(prev => ({ ...prev, providerId: e.target.value }))}
            required
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

        {/* Partner Selection - Two Step */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Step 1: Select Partner Name */}
          <div>
            <label className="label">Partner Name *</label>
            <select
              className="input w-full"
              value={selectedPlanName}
              onChange={(e) => {
                setSelectedPlanName(e.target.value);
                setSelectedFormularyVersion(''); // Reset formulary version when partner changes
                setFormData(prev => ({ ...prev, planId: '' })); // Reset planId
              }}
              required
            >
              <option value="">Select partner</option>
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
              {!selectedPlanName && <span className="ml-1 text-xs text-gray-400">(select partner first)</span>}
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
          Select the partner and their corresponding formulary version
        </p>

        {/* Medication Type */}
        <div>
          <label className="label">What type of medication would you like recommended? *</label>
          <select
            className="input w-full"
            value={formData.medicationType}
            onChange={(e) => setFormData(prev => ({ ...prev, medicationType: e.target.value as 'biologic' | 'topical' }))}
            required
          >
            <option value="biologic">Biologic</option>
            <option value="topical">Topical</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Recommendations will be filtered to only show this medication type
          </p>
        </div>

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

        {/* Inappropriate Biologics */}
        <div>
          <label className="label">Are there any biologics that are inappropriate for this patient? (optional)</label>
          <p className="text-xs text-gray-500 mb-2">
            Select biologics that should be excluded from recommendations (e.g., previous failures, allergies, contraindications).
          </p>
          <select
            className="input w-full"
            onChange={(e) => {
              const drugName = e.target.value;
              if (drugName && !formData.failedTherapies.includes(drugName)) {
                setFormData(prev => ({
                  ...prev,
                  failedTherapies: [...prev.failedTherapies, drugName],
                }));
                e.target.value = ''; // Reset dropdown
              }
            }}
            defaultValue=""
          >
            <option value="">Select a biologic to exclude</option>
            <option value="Humira (adalimumab)">Humira (adalimumab)</option>
            <option value="Enbrel (etanercept)">Enbrel (etanercept)</option>
            <option value="Stelara (ustekinumab)">Stelara (ustekinumab)</option>
            <option value="Cosentyx (secukinumab)">Cosentyx (secukinumab)</option>
            <option value="Taltz (ixekizumab)">Taltz (ixekizumab)</option>
            <option value="Skyrizi (risankizumab)">Skyrizi (risankizumab)</option>
            <option value="Tremfya (guselkumab)">Tremfya (guselkumab)</option>
            <option value="Otezla (apremilast)">Otezla (apremilast)</option>
            <option value="Dupixent (dupilumab)">Dupixent (dupilumab)</option>
            <option value="Rinvoq (upadacitinib)">Rinvoq (upadacitinib)</option>
            <option value="Cimzia (certolizumab)">Cimzia (certolizumab)</option>
            <option value="Ilumya (tildrakizumab)">Ilumya (tildrakizumab)</option>
            <option value="Siliq (brodalumab)">Siliq (brodalumab)</option>
          </select>
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

        {/* BMI */}
        <div>
          <label className="label">BMI (optional)</label>
          <select
            className="input w-full"
            value={formData.bmi}
            onChange={(e) => setFormData(prev => ({ ...prev, bmi: e.target.value as '' | '<25' | '25-30' | '>30' }))}
          >
            <option value="">Select BMI range</option>
            <option value="<25">&lt;25 (normal)</option>
            <option value="25-30">25-30 (overweight)</option>
            <option value=">30">&gt;30 (obese)</option>
          </select>
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
    </div>
  );
}
