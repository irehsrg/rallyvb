import { useState, useEffect } from 'react';
import { SetScore } from '../types';

interface SetScoreInputProps {
  setNumber: number;
  initialScoreA?: number;
  initialScoreB?: number;
  pointsToWin: number;
  minPointDifference: number;
  onScoreChange: (scoreA: number, scoreB: number) => void;
  disabled?: boolean;
}

export default function SetScoreInput({
  setNumber,
  initialScoreA = 0,
  initialScoreB = 0,
  pointsToWin,
  minPointDifference,
  onScoreChange,
  disabled = false,
}: SetScoreInputProps) {
  const [scoreA, setScoreA] = useState(initialScoreA);
  const [scoreB, setScoreB] = useState(initialScoreB);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    setScoreA(initialScoreA);
    setScoreB(initialScoreB);
  }, [initialScoreA, initialScoreB]);

  useEffect(() => {
    validateScore(scoreA, scoreB);
    onScoreChange(scoreA, scoreB);
  }, [scoreA, scoreB]);

  const validateScore = (a: number, b: number) => {
    setError('');

    // Check for negative scores
    if (a < 0 || b < 0) {
      setError('Scores cannot be negative');
      return false;
    }

    // Check for tied scores at completion
    if (a === b && (a >= pointsToWin || b >= pointsToWin)) {
      setError('Scores cannot be tied');
      return false;
    }

    // If one team reached the winning threshold
    if (a >= pointsToWin || b >= pointsToWin) {
      const winner = a > b ? a : b;
      const loser = a > b ? b : a;
      const diff = winner - loser;

      // Check if they both reached threshold (shouldn't happen in volleyball)
      if (a >= pointsToWin && b >= pointsToWin) {
        // This is okay in deuce situations
        if (diff < minPointDifference) {
          setError(`Must win by ${minPointDifference} points`);
          return false;
        }
      } else {
        // Normal win: winning team must be at threshold and have minimum difference
        if (diff < minPointDifference) {
          setError(`Must win by ${minPointDifference} points`);
          return false;
        }
      }
    }

    return true;
  };

  const handleScoreAChange = (value: string) => {
    const num = value === '' ? 0 : parseInt(value);
    if (!isNaN(num)) {
      setScoreA(Math.max(0, num));
    }
  };

  const handleScoreBChange = (value: string) => {
    const num = value === '' ? 0 : parseInt(value);
    if (!isNaN(num)) {
      setScoreB(Math.max(0, num));
    }
  };

  const isSetComplete = () => {
    if (scoreA < pointsToWin && scoreB < pointsToWin) return false;
    const diff = Math.abs(scoreA - scoreB);
    return diff >= minPointDifference;
  };

  const getWinner = (): 'A' | 'B' | null => {
    if (!isSetComplete()) return null;
    return scoreA > scoreB ? 'A' : 'B';
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-gray-400 min-w-[60px]">
          <span className="font-semibold">Set {setNumber}</span>
          {getWinner() && (
            <span className={`text-xs font-bold ${
              getWinner() === 'A' ? 'text-blue-400' : 'text-red-400'
            }`}>
              ✓
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-1">
          <input
            type="number"
            value={scoreA}
            onChange={(e) => handleScoreAChange(e.target.value)}
            disabled={disabled}
            className={`input-modern w-20 text-center font-bold ${
              getWinner() === 'A' ? 'border-blue-500/50 bg-blue-500/10' : ''
            }`}
            min={0}
            placeholder="0"
          />
          <span className="text-gray-500 font-bold">-</span>
          <input
            type="number"
            value={scoreB}
            onChange={(e) => handleScoreBChange(e.target.value)}
            disabled={disabled}
            className={`input-modern w-20 text-center font-bold ${
              getWinner() === 'B' ? 'border-red-500/50 bg-red-500/10' : ''
            }`}
            min={0}
            placeholder="0"
          />
        </div>

        {isSetComplete() && (
          <div className="flex items-center gap-1 min-w-[100px]">
            <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-xs text-green-400 font-medium">Complete</span>
          </div>
        )}
      </div>

      {error && (
        <div className="text-xs text-red-400 pl-[75px]">
          {error}
        </div>
      )}
    </div>
  );
}

interface MatchSetScoresProps {
  setScores: SetScore[];
  pointsToWin: number;
  decidingSetPoints: number;
  minPointDifference: number;
  bestOf: 1 | 3 | 5 | 7;
  onSetScoresChange: (scores: SetScore[]) => void;
  disabled?: boolean;
}

export function MatchSetScores({
  setScores,
  pointsToWin,
  decidingSetPoints,
  minPointDifference,
  bestOf,
  onSetScoresChange,
  disabled = false,
}: MatchSetScoresProps) {
  const maxSets = bestOf;
  const setsToWin = Math.ceil(bestOf / 2);

  // Ensure we have the right number of set score objects
  const ensureSetScores = (scores: SetScore[]): SetScore[] => {
    const result = [...scores];
    while (result.length < maxSets) {
      result.push({ team_a: 0, team_b: 0 });
    }
    return result.slice(0, maxSets);
  };

  const currentSetScores = ensureSetScores(setScores);

  const handleSetScoreChange = (setIndex: number, scoreA: number, scoreB: number) => {
    const newScores = [...currentSetScores];
    newScores[setIndex] = { team_a: scoreA, team_b: scoreB };
    onSetScoresChange(newScores);
  };

  const getSetsWon = (): { teamA: number; teamB: number } => {
    let teamA = 0;
    let teamB = 0;

    currentSetScores.forEach((set) => {
      if (set.team_a > set.team_b) teamA++;
      else if (set.team_b > set.team_a) teamB++;
    });

    return { teamA, teamB };
  };

  const getMatchWinner = (): 'A' | 'B' | null => {
    const { teamA, teamB } = getSetsWon();
    if (teamA >= setsToWin) return 'A';
    if (teamB >= setsToWin) return 'B';
    return null;
  };

  const isDecidingSet = (setIndex: number): boolean => {
    // Deciding set is the final set in a best-of series (e.g., set 3 in best of 3, set 5 in best of 5)
    return setIndex === maxSets - 1;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-gray-300">Set Scores</h4>
        <div className="text-sm text-gray-400">
          <span className={getSetsWon().teamA >= setsToWin ? 'text-blue-400 font-bold' : ''}>
            {getSetsWon().teamA}
          </span>
          {' - '}
          <span className={getSetsWon().teamB >= setsToWin ? 'text-red-400 font-bold' : ''}>
            {getSetsWon().teamB}
          </span>
          <span className="ml-2 text-xs text-gray-500">
            (Sets Won)
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {currentSetScores.map((set, index) => (
          <SetScoreInput
            key={index}
            setNumber={index + 1}
            initialScoreA={set.team_a}
            initialScoreB={set.team_b}
            pointsToWin={isDecidingSet(index) ? decidingSetPoints : pointsToWin}
            minPointDifference={minPointDifference}
            onScoreChange={(scoreA, scoreB) => handleSetScoreChange(index, scoreA, scoreB)}
            disabled={disabled}
          />
        ))}
      </div>

      {getMatchWinner() && (
        <div className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-xl text-center">
          <div className="flex items-center justify-center gap-2">
            <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="font-semibold text-green-400">
              Team {getMatchWinner()} wins the match!
            </span>
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {getSetsWon().teamA} - {getSetsWon().teamB} sets
          </div>
        </div>
      )}
    </div>
  );
}
