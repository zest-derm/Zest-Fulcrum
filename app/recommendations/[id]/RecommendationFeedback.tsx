'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X } from 'lucide-react';

interface Recommendation {
  id: string;
  rank: number;
  drugName: string;
}

interface RecommendationFeedbackProps {
  assessmentId: string;
  mrn: string;
  providerId: string | null;
  recommendations: Recommendation[];
}

export default function RecommendationFeedback({
  assessmentId,
  mrn,
  providerId,
  recommendations,
}: RecommendationFeedbackProps) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [selectedRank, setSelectedRank] = useState<number | null>(null);
  const [selectedRecommendationId, setSelectedRecommendationId] = useState<string | null>(null);
  const [isDeclineAll, setIsDeclineAll] = useState(false);
  const [loading, setLoading] = useState(false);

  const [feedbackForm, setFeedbackForm] = useState({
    reasonForChoice: '',
    reasonAgainstFirst: '',
    reasonForDeclineAll: '',
    alternativePlan: '',
  });

  const handleAccept = (rank: number, recommendationId: string) => {
    setSelectedRank(rank);
    setSelectedRecommendationId(recommendationId);
    setIsDeclineAll(false);
    setShowModal(true);
    // Reset form
    setFeedbackForm({
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
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {isDeclineAll ? 'Decline All Recommendations' : `Accept Option ${selectedRank}`}
            </h3>

            <div className="space-y-4">
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
