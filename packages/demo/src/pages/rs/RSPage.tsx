import React, { useState } from 'react';
import { RS1_QUESTIONS } from '../../../../../poc/rs/questions';
import { scoreDiagnostic, SkillProfile, Answer, SkillDimension } from '../../../../../poc/rs/score';
import { recommendForDimension } from '../../../../../poc/rs/recommend';

export default function RSPage() {
  const [answers, setAnswers] = useState<Record<string, string | null>>({});
  const [profile, setProfile] = useState<SkillProfile | null>(null);

  const handleOptionSelect = (questionId: string, option: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: option }));
  };

  const handleSubmit = () => {
    // Convert to Answer[] format
    const answerList: Answer[] = RS1_QUESTIONS.map((q) => ({
      questionId: q.id,
      option: answers[q.id] || null,
    }));
    
    const result = scoreDiagnostic(answerList);
    setProfile(result);
  };

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-12 text-[var(--color-fg)]">
      <h1 className="text-3xl font-[500] tracking-tight mb-4 text-[var(--color-fg-heading)]">Diagnostic Assessment</h1>
      <p className="mb-8 text-[var(--color-fg-muted)]">
        Answer the following questions to receive a personalized learning recommendation.
      </p>

      <div className="space-y-8 mb-8">
        {RS1_QUESTIONS.map((q, idx) => (
          <div key={q.id} className="border border-[var(--color-border)] rounded-md p-6 bg-[var(--color-canvas-subtle)]">
            <h2 className="text-lg font-[500] mb-4">
              <span className="text-[var(--color-fg-muted)] mr-2">{idx + 1}.</span>
              {q.text}
            </h2>
            <div className="space-y-3">
              {(Object.entries(q.options) as [string, string][]).map(([optKey, optText]) => (
                <label
                  key={optKey}
                  className={`flex items-start p-3 border rounded-md cursor-pointer hover:bg-[var(--color-canvas)] transition-colors ${
                    answers[q.id] === optKey ? 'border-[var(--color-accent-fg)] bg-[var(--color-accent-subtle)]' : 'border-[var(--color-border)]'
                  }`}
                >
                  <input
                    type="radio"
                    name={q.id}
                    value={optKey}
                    checked={answers[q.id] === optKey}
                    onChange={() => handleOptionSelect(q.id, optKey)}
                    className="mt-1 mr-3 text-[var(--color-accent-fg)] focus:ring-[var(--color-accent-fg)]"
                  />
                  <div>
                    <strong className="mr-2">{optKey})</strong>
                    {optText}
                  </div>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mb-12">
        <button
          onClick={handleSubmit}
          className="px-6 py-2 bg-[var(--color-accent-fg)] text-[var(--color-canvas)] rounded-md font-[500] hover:opacity-90 transition-opacity"
        >
          Submit Answers
        </button>
      </div>

      {profile && (
        <div className="border border-[var(--color-border)] rounded-md p-6 bg-[var(--color-canvas)]">
          <h2 className="text-2xl font-[500] mb-6 text-[var(--color-fg-heading)]">Your Skill Profile</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            {(Object.entries(profile.scores) as [SkillDimension, number][]).map(([dim, score]) => (
              <div key={dim} className="border border-[var(--color-border)] rounded-md p-4 text-center bg-[var(--color-canvas-subtle)]">
                <div className="text-sm text-[var(--color-fg-muted)] uppercase tracking-wider mb-1">{dim}</div>
                <div className="text-2xl font-[500] text-[var(--color-accent-fg)]">{score} / 4</div>
              </div>
            ))}
          </div>

          <div className="border-t border-[var(--color-border)] pt-6">
            <h3 className="text-lg font-[500] mb-2 text-[var(--color-fg-heading)]">Recommended Focus Area</h3>
            <p className="text-[var(--color-fg-muted)] mb-4">
              Based on your results, your weakest dimension is <strong className="text-[var(--color-fg)] capitalize">{profile.weakestRanking[0]}</strong>.
            </p>
            
            {(() => {
              const rec = recommendForDimension(profile.weakestRanking[0]);
              if (!rec) return null;
              
              return (
                <div className="inline-block border border-[var(--color-accent-fg)] rounded-md p-4 bg-[var(--color-accent-subtle)]">
                  <div className="text-sm font-[500] text-[var(--color-accent-fg)] uppercase mb-1">Recommended Example</div>
                  <div className="text-lg mb-3">{rec.topic}</div>
                  <a
                    href={`#/playground?example=${rec.exampleId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center text-[var(--color-canvas)] bg-[var(--color-accent-fg)] px-4 py-2 rounded text-sm font-[500] hover:opacity-90 transition-opacity"
                  >
                    Open in Playground →
                  </a>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
