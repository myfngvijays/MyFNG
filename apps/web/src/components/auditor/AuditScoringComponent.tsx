'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, Save, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface AuditScoringComponentProps {
  auditId: string;
  auditType: string;
  currentScore: number | null;
  onUpdate: () => void;
}

export default function AuditScoringComponent({
  auditId,
  auditType,
  currentScore,
  onUpdate,
}: AuditScoringComponentProps) {
  const [scores, setScores] = useState({
    job_quality: 0,
    image_compliance: 0,
    cleanliness: 0,
    sop_compliance: 0,
    customer_rating: 0,
  });
  const [overallScore, setOverallScore] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currentScore !== null && currentScore !== undefined) {
      setOverallScore(auditType === 'JOB_CARD' ? currentScore * 20 : currentScore);
    }
  }, [currentScore, auditType]);

  const calculateOverallScore = () => {
    if (auditType === 'JOB_CARD') {
      // Weighted calculation for job card audits
      const weighted = 
        (scores.job_quality * 0.4) +
        (scores.image_compliance * 0.2) +
        (scores.cleanliness * 0.1) +
        (scores.sop_compliance * 0.2) +
        (scores.customer_rating * 0.1);
      setOverallScore(Math.round(weighted));
    } else {
      // Workshop facility audit uses different weights
      const weighted = 
        (scores.cleanliness * 0.15) +
        (scores.sop_compliance * 0.25) +
        (scores.job_quality * 0.3) +
        (scores.image_compliance * 0.3);
      setOverallScore(Math.round(weighted));
    }
  };

  useEffect(() => {
    calculateOverallScore();
  }, [scores, auditType]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/auditor/audits/${auditId}/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          overall_score: auditType === 'JOB_CARD' ? overallScore / 20 : overallScore,
          image_compliance_score: scores.image_compliance,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save scores');
      }

      toast.success('Scores saved successfully');
      onUpdate();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save scores');
    } finally {
      setSaving(false);
    }
  };

  const getGrade = (score: number) => {
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    if (score >= 50) return 'D';
    return 'F';
  };

  const getGradeColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 80) return 'text-blue-600';
    if (score >= 70) return 'text-yellow-600';
    if (score >= 60) return 'text-orange-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      {/* Overall Score Display */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm opacity-90">Overall Audit Score</p>
            <p className="text-4xl font-bold mt-1">{overallScore}%</p>
            <p className={`text-lg font-semibold mt-2 ${getGradeColor(overallScore)}`}>
              Grade: {getGrade(overallScore)}
            </p>
          </div>
          <TrendingUp className="w-16 h-16 opacity-50" />
        </div>
      </div>

      {/* Category Scores */}
      <div className="space-y-4">
        {auditType === 'JOB_CARD' ? (
          <>
            <ScoreSlider
              label="Job Quality"
              value={scores.job_quality}
              onChange={(val) => setScores({ ...scores, job_quality: val })}
              weight={40}
            />
            <ScoreSlider
              label="Image Compliance"
              value={scores.image_compliance}
              onChange={(val) => setScores({ ...scores, image_compliance: val })}
              weight={20}
            />
            <ScoreSlider
              label="Cleanliness"
              value={scores.cleanliness}
              onChange={(val) => setScores({ ...scores, cleanliness: val })}
              weight={10}
            />
            <ScoreSlider
              label="SOP Compliance"
              value={scores.sop_compliance}
              onChange={(val) => setScores({ ...scores, sop_compliance: val })}
              weight={20}
            />
            <ScoreSlider
              label="Customer Rating"
              value={scores.customer_rating}
              onChange={(val) => setScores({ ...scores, customer_rating: val })}
              weight={10}
            />
          </>
        ) : (
          <>
            <ScoreSlider
              label="Infrastructure"
              value={scores.job_quality}
              onChange={(val) => setScores({ ...scores, job_quality: val })}
              weight={15}
            />
            <ScoreSlider
              label="Equipment"
              value={scores.image_compliance}
              onChange={(val) => setScores({ ...scores, image_compliance: val })}
              weight={20}
            />
            <ScoreSlider
              label="Cleanliness"
              value={scores.cleanliness}
              onChange={(val) => setScores({ ...scores, cleanliness: val })}
              weight={15}
            />
            <ScoreSlider
              label="SOP Compliance"
              value={scores.sop_compliance}
              onChange={(val) => setScores({ ...scores, sop_compliance: val })}
              weight={25}
            />
            <ScoreSlider
              label="Safety Compliance"
              value={scores.customer_rating}
              onChange={(val) => setScores({ ...scores, customer_rating: val })}
              weight={25}
            />
          </>
        )}
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn btn-primary flex items-center gap-2"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Save Scores
        </button>
      </div>
    </div>
  );
}

function ScoreSlider({ label, value, onChange, weight }: { label: string; value: number; onChange: (val: number) => void; weight: number }) {
  return (
    <div className="bg-white border rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <label className="font-medium text-gray-900">{label}</label>
          <span className="text-xs text-gray-500">({weight}% weight)</span>
        </div>
        <span className="text-lg font-bold text-indigo-600">{value}%</span>
      </div>
      <input
        type="range"
        min="0"
        max="100"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
      />
      <div className="flex justify-between text-xs text-gray-500 mt-1">
        <span>0</span>
        <span>50</span>
        <span>100</span>
      </div>
    </div>
  );
}

