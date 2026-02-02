/**
 * 15-Minute City Score Component
 * Shows whether essential services are within a 15-minute walk
 * Free for all users
 */

import { useState, useEffect } from 'react';
import type { Location } from '../types';
import { calculate15MinuteCityScore, type FifteenMinuteCityScore } from '../services/fifteenMinuteCity';

interface FifteenMinuteCityProps {
  location: Location;
}

export default function FifteenMinuteCity({ location }: FifteenMinuteCityProps) {
  const [score, setScore] = useState<FifteenMinuteCityScore | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(false);

    calculate15MinuteCityScore(location.lat, location.lon)
      .then(result => {
        if (!cancelled) {
          setScore(result);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setIsLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [location.lat, location.lon]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl p-6 border-2 border-gray-100 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-600 font-medium">Analyzing 15-Minute City Score...</span>
        </div>
      </div>
    );
  }

  if (error || !score) {
    return null; // Silently hide on error
  }

  const getScoreColor = (s: number) => {
    if (s >= 80) return 'text-green-600';
    if (s >= 60) return 'text-amber-500';
    if (s >= 40) return 'text-orange-500';
    return 'text-red-500';
  };

  const getBgColor = (s: number) => {
    if (s >= 80) return 'bg-green-500';
    if (s >= 60) return 'bg-amber-500';
    if (s >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getServiceIcon = (key: string) => {
    const icons: Record<string, string> = {
      grocery: '🛒',
      healthcare: '🏥',
      education: '🏫',
      recreation: '🌳',
      transit: '🚌',
      dining: '🍽️',
    };
    return icons[key] || '📍';
  };

  const getServiceLabel = (key: string) => {
    const labels: Record<string, string> = {
      grocery: 'Grocery',
      healthcare: 'Healthcare',
      education: 'Education',
      recreation: 'Parks',
      transit: 'Transit',
      dining: 'Dining',
    };
    return labels[key] || key;
  };

  return (
    <div className="bg-white rounded-2xl p-6 border-2 border-gray-100 shadow-lg">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-xl font-bold text-gray-800 mb-1">15-Minute City Score</h3>
          <p className="text-sm text-gray-500">Essential services within walking distance</p>
        </div>
        <div className={`text-3xl font-bold ${getScoreColor(score.overallScore)}`}>
          {score.overallScore}%
        </div>
      </div>

      {/* Service Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
        {Object.entries(score.serviceScores).map(([key, service]) => (
          <div
            key={key}
            className={`rounded-xl p-3 border ${
              service.available ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{getServiceIcon(key)}</span>
              <span className="text-sm font-semibold text-gray-800">{getServiceLabel(key)}</span>
            </div>
            {service.available ? (
              <div className="text-xs text-green-700">
                {service.count} found · {service.nearestDistance > 0 ? `${service.nearestDistance}m away` : 'nearby'}
              </div>
            ) : (
              <div className="text-xs text-gray-500">Not found within 1.2km</div>
            )}
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
        <div
          className={`h-2 rounded-full transition-all ${getBgColor(score.overallScore)}`}
          style={{ width: `${score.overallScore}%` }}
        />
      </div>

      {/* Summary */}
      <p className="text-sm text-gray-600">{score.summary}</p>

      {/* Missing services */}
      {score.missingServices.length > 0 && (
        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs font-semibold text-amber-800 mb-1">Missing nearby:</p>
          <p className="text-xs text-amber-700">{score.missingServices.join(', ')}</p>
        </div>
      )}

      <p className="text-xs text-gray-400 mt-3">
        Data: OpenStreetMap · 1.2km radius (15-min walk)
      </p>
    </div>
  );
}
