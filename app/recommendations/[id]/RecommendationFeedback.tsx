'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X, Clock } from 'lucide-react';

interface Recommendation {
  id: string;
  rank: number;
  drugName: string;
  tier?: number | null;
}

interface RecommendationFeedbackProps {
  assessmentId: string;
  mrn: string | null;
  providerId: string | null;
  assessmentStartedAt: Date | null;
  assessedAt: Date;
  currentBiologic?: {
    name?: string | null;
    dose?: string | null;
    frequency?: string | null;
  };
  recommendations: Recommendation[];
}

export default function RecommendationFeedback({
  assessmentId,
  mrn,
  providerId,
  assessmentStartedAt,
  assessedAt,
  currentBiologic,
  recommendations,
}: RecommendationFeedbackProps) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [selectedRank, setSelectedRank] = useState<number | null>(null);
  const [selectedRecommendationId, setSelectedRecommendationId] = useState<string | null>(null);
  const [isDeclineAll, setIsDeclineAll] = useState(false);
  const [loading, setLoading] = useState(false);
  const [assessmentTimeMinutes, setAssessmentTimeMinutes] = useState<number | null>(null);

  const [feedbackForm, setFeedbackForm] = useState({
    selectedTier: null as number | null,
    formularyAccurate: null as boolean | null,
    literatureAccurate: null as boolean | null,
    additionalFeedback: '',
    reasonForChoice: '',
    reasonAgainstFirst: '',
    reasonForDeclineAll: '',
    alternativePlan: '',
  });

  // Calculate assessment time when recommendations page loads (not when modal opens)
  // This captures the full time from New Assessment page load to Recommendations page load
  useEffect(() => {
    if (assessmentStartedAt) {
      const startTime = new Date(assessmentStartedAt).getTime();
      const endTime = new Date().getTime(); // Use current time (when page loads)
      const minutes = (endTime - startTime) / 60000;
      setAssessmentTimeMinutes(Math.round(minutes * 100) / 100); // Round to 2 decimals
    }
  }, [assessmentStartedAt]); // Run once when component mounts

  const handleAccept = (rank: number, recommendationId: string) => {
    const selectedRec = recommendations.find(r => r.id === recommendationId);
    setSelectedRank(rank);
    setSelectedRecommendationId(recommendationId);
    setIsDeclineAll(false);
    setShowModal(true);
    // Reset form with selected recommendation's tier pre-filled
    setFeedbackForm({
      selectedTier: selectedRec?.tier || null,
      formularyAccurate: null,
      literatureAccurate: null,
      additionalFeedback: '',
      reasonForChoice: '',
      reasonAgainstFirst: '',
      reasonForDeclineAll: '',
      alternativePlan: '',
    });
  };

  const handleDeclineAll = () => {
    setSelectedRank(null);
    setSelectedRecommendationId(null);
    setIsDeclineAll(true);
    setShowModal(true);
    // Reset form
    setFeedbackForm({
      selectedTier: null,
      formularyAccurate: null,
      literatureAccurate: null,
      additionalFeedback: '',
      reasonForChoice: '',
      reasonAgainstFirst: '',
      reasonForDeclineAll: '',
      alternativePlan: '',
    });
  };

  const handleSubmitFeedback = async () => {
    setLoading(true);

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assessmentId,
          recommendationId: selectedRecommendationId,
          mrn,
          providerId,
          selectedRank,
          selectedTier: feedbackForm.selectedTier,
          assessmentTimeMinutes,
          formularyAccurate: feedbackForm.formularyAccurate,
          literatureAccurate: feedbackForm.literatureAccurate,
          additionalFeedback: feedbackForm.additionalFeedback || null,
          reasonForChoice: feedbackForm.reasonForChoice || null,
          reasonAgainstFirst: feedbackForm.reasonAgainstFirst || null,
          reasonForDeclineAll: feedbackForm.reasonForDeclineAll || null,
          alternativePlan: feedbackForm.alternativePlan || null,
        }),
      });

      if (response.ok) {
        setShowModal(false);
        alert('Feedback submitted successfully!');
        router.refresh();
      } else {
        const error = await response.json();
        alert(`Error: ${error.message || 'Failed to submit feedback'}`);
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
      alert('Failed to submit feedback. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Accept/Decline buttons for each recommendation */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex gap-3">
          {recommendations.map((rec) => (
            <button
              key={rec.id}
              onClick={() => handleAccept(rec.rank, rec.id)}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              Accept Option {rec.rank}
            </button>
          ))}
        </div>

        <button
          onClick={handleDeclineAll}
          className="mt-3 w-full px-4 py-2 border border-red-300 text-red-700 rounded-md hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 flex items-center justify-center gap-2"
        >
          <X className="w-4 h-4" />
          Decline All Recommendations
        </button>
      </div>

      {/* Feedback Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-3xl w-full mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {isDeclineAll ? 'Decline All Recommendations' : `Accept Option ${selectedRank}`}
            </h3>

            {/* Display MRN and Current Biologic if available */}
            <div className="mb-4 p-3 bg-gray-50 rounded-md text-sm">
              <div className="grid grid-cols-2 gap-2">
                {mrn && (
                  <div>
                    <span className="font-medium">MRN:</span> {mrn}
                  </div>
                )}
                {currentBiologic?.name && (
                  <div className="col-span-2">
                    <span className="font-medium">Current Biologic:</span> {currentBiologic.name}
                    {currentBiologic.dose && `, ${currentBiologic.dose}`}
                    {currentBiologic.frequency && `, ${currentBiologic.frequency}`}
                  </div>
                )}
              </div>
            </div>

            {/* Assessment Time Display */}
            {assessmentTimeMinutes !== null && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" />
                <div className="text-sm">
                  <span className="font-medium">Assessment Time:</span> {assessmentTimeMinutes} minutes
                  {assessmentTimeMinutes < 4 && <span className="ml-2 text-green-600 font-semibold">✓ Under 4 minutes!</span>}
                </div>
              </div>
            )}

            <div className="space-y-4">
              {/* Formulary Tier Selected */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Formulary Tier Selected {!isDeclineAll && '*'}
                </label>
                {!isDeclineAll && feedbackForm.selectedTier ? (
                  <div className="px-3 py-2 bg-gray-100 rounded-md text-gray-700">
                    Tier {feedbackForm.selectedTier}
                  </div>
                ) : (
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    value={feedbackForm.selectedTier || ''}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, selectedTier: e.target.value ? parseInt(e.target.value) : null })}
                  >
                    <option value="">Select tier</option>
                    <option value="1">Tier 1</option>
                    <option value="2">Tier 2</option>
                    <option value="3">Tier 3</option>
                    <option value="4">Tier 4</option>
                    <option value="5">Tier 5 (Not Covered)</option>
                  </select>
                )}
                {isDeclineAll && (
                  <p className="text-xs text-gray-500 mt-1">
                    If known, select the tier of the alternative therapy you plan to use
                  </p>
                )}
              </div>

              {/* Was formulary accurate? */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Was the formulary accurate?
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="formularyAccurate"
                      checked={feedbackForm.formularyAccurate === true}
                      onChange={() => setFeedbackForm({ ...feedbackForm, formularyAccurate: true })}
                      className="mr-2"
                    />
                    Yes
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="formularyAccurate"
                      checked={feedbackForm.formularyAccurate === false}
                      onChange={() => setFeedbackForm({ ...feedbackForm, formularyAccurate: false })}
                      className="mr-2"
                    />
                    No
                  </label>
                </div>
              </div>

              {/* Was literature accurate? */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Was the literature accurate?
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="literatureAccurate"
                      checked={feedbackForm.literatureAccurate === true}
                      onChange={() => setFeedbackForm({ ...feedbackForm, literatureAccurate: true })}
                      className="mr-2"
                    />
                    Yes
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="literatureAccurate"
                      checked={feedbackForm.literatureAccurate === false}
                      onChange={() => setFeedbackForm({ ...feedbackForm, literatureAccurate: false })}
                      className="mr-2"
                    />
                    No
                  </label>
                </div>
              </div>

              {!isDeclineAll && (
                <>
                  {/* Why did you choose this option? */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Why did you choose this option? (optional)
                    </label>
                    <textarea
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      rows={3}
                      value={feedbackForm.reasonForChoice}
                      onChange={(e) => setFeedbackForm({ ...feedbackForm, reasonForChoice: e.target.value })}
                      placeholder="Enter your reasoning..."
                    />
                  </div>

                  {/* Why not the first option? (only for rank 2 or 3) */}
                  {selectedRank && selectedRank > 1 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Why was the first option not selected? (optional)
                      </label>
                      <textarea
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                        rows={3}
                        value={feedbackForm.reasonAgainstFirst}
                        onChange={(e) => setFeedbackForm({ ...feedbackForm, reasonAgainstFirst: e.target.value })}
                        placeholder="Enter your reasoning..."
                      />
                    </div>
                  )}
                </>
              )}

              {isDeclineAll && (
                <>
                  {/* Why were all recommendations declined? */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Why were all recommendations declined? (optional)
                    </label>
                    <textarea
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      rows={3}
                      value={feedbackForm.reasonForDeclineAll}
                      onChange={(e) => setFeedbackForm({ ...feedbackForm, reasonForDeclineAll: e.target.value })}
                      placeholder="Enter your reasoning..."
                    />
                  </div>

                  {/* What decision do you plan to move forward with? */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      What decision do you plan to move forward with? (optional)
                    </label>
                    <textarea
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      rows={3}
                      value={feedbackForm.alternativePlan}
                      onChange={(e) => setFeedbackForm({ ...feedbackForm, alternativePlan: e.target.value })}
                      placeholder="Describe your alternative plan..."
                    />
                  </div>
                </>
              )}

              {/* Additional Feedback */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Any feedback or questions related to the tool? (optional)
                </label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  rows={3}
                  value={feedbackForm.additionalFeedback}
                  onChange={(e) => setFeedbackForm({ ...feedbackForm, additionalFeedback: e.target.value })}
                  placeholder="Share any feedback, suggestions, or questions..."
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                disabled={loading}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitFeedback}
                disabled={loading}
                className="flex-1 px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
              >
                {loading ? 'Submitting...' : 'Submit Feedback'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
