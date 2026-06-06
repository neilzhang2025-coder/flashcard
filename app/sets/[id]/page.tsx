'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import { useUser } from '@/lib/hooks/useUser'
import type { CardWithProgress, CardStatus } from '@/lib/types'

type SetMeta = { id: string; name: string }

export default function StudyPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user, email } = useUser()
  const supabase = createClient()

  const [setMeta, setSetMeta] = useState<SetMeta | null>(null)
  const [cards, setCards] = useState<CardWithProgress[]>([])
  const [studyOrder, setStudyOrder] = useState<number[]>([])
  const [cursor, setCursor] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [shuffle, setShuffle] = useState(false)
  const [wrongOnly, setWrongOnly] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    if (!user) return
    const [{ data: setData }, { data: cardData }, { data: progressData }] = await Promise.all([
      supabase.from('flashcard_sets').select('id, name').eq('id', id).single(),
      supabase.from('flashcards').select('*').eq('set_id', id).order('position'),
      supabase.from('study_progress').select('card_id, status').eq('user_id', user.id),
    ])
    if (!setData) { router.push('/dashboard'); return }

    const progressMap = new Map(
      (progressData ?? []).map((p: { card_id: string; status: CardStatus }) => [p.card_id, p.status])
    )
    const withProgress: CardWithProgress[] = (cardData ?? []).map((c) => ({
      ...c,
      status: (progressMap.get(c.id) as CardStatus) ?? 'unseen',
    }))

    setSetMeta(setData)
    setCards(withProgress)
    buildOrder(withProgress, false, false)
    setLoading(false)
  }, [user, id])

  useEffect(() => { loadData() }, [loadData])

  function buildOrder(source: CardWithProgress[], wrongOnlyFlag: boolean, shuffleFlag: boolean) {
    let pool = wrongOnlyFlag ? source.filter((c) => c.status === 'wrong') : source
    let indices = pool.map((_, i) => source.indexOf(pool[i]))
    if (shuffleFlag) indices = [...indices].sort(() => Math.random() - 0.5)
    setStudyOrder(indices)
    setCursor(0)
    setFlipped(false)
  }

  async function markCard(status: CardStatus) {
    if (!user || studyOrder.length === 0) return
    const card = cards[studyOrder[cursor]]
    if (!card) return

    // Optimistic update
    setCards((prev) =>
      prev.map((c) => (c.id === card.id ? { ...c, status } : c))
    )

    await supabase.from('study_progress').upsert(
      { user_id: user.id, card_id: card.id, status },
      { onConflict: 'user_id,card_id' }
    )

    setCursor((c) => c + 1)
    setFlipped(false)
  }

  function toggleShuffle() {
    const next = !shuffle
    setShuffle(next)
    buildOrder(cards, wrongOnly, next)
  }

  function resetProgress() {
    setCards((prev) => prev.map((c) => ({ ...c, status: 'unseen' as CardStatus })))
    supabase
      .from('study_progress')
      .delete()
      .eq('user_id', user?.id)
      .in('card_id', cards.map((c) => c.id))

    buildOrder(cards.map((c) => ({ ...c, status: 'unseen' as CardStatus })), false, shuffle)
    setWrongOnly(false)
  }

  function studyWrongOnly() {
    setWrongOnly(true)
    buildOrder(cards, true, shuffle)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar email={email} />
        <div className="flex-1 flex items-center justify-center text-gray-400">Loading…</div>
      </div>
    )
  }

  const currentCard = studyOrder.length > 0 && cursor < studyOrder.length
    ? cards[studyOrder[cursor]]
    : null

  const n_correct = cards.filter((c) => c.status === 'correct').length
  const n_wrong   = cards.filter((c) => c.status === 'wrong').length
  const n_unseen  = cards.filter((c) => c.status === 'unseen').length
  const reviewed  = n_correct + n_wrong
  const accuracy  = reviewed > 0 ? Math.round((n_correct / reviewed) * 100) : 0
  const progress  = cards.length > 0 ? reviewed / cards.length : 0

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar email={email} />

      <div className="flex-1 flex flex-col lg:flex-row max-w-6xl mx-auto w-full px-4 py-6 gap-6">
        {/* Sidebar */}
        <aside className="lg:w-64 shrink-0 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <h2 className="font-semibold text-gray-800 truncate">{setMeta?.name}</h2>

            {/* Progress bar */}
            <div>
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Progress</span>
                <span>{reviewed}/{cards.length}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 text-center text-xs divide-x divide-gray-100 border border-gray-100 rounded-lg overflow-hidden">
              <div className="py-2">
                <div className="font-semibold text-green-600">{n_correct}</div>
                <div className="text-gray-400">Correct</div>
              </div>
              <div className="py-2">
                <div className="font-semibold text-red-500">{n_wrong}</div>
                <div className="text-gray-400">Wrong</div>
              </div>
              <div className="py-2">
                <div className="font-semibold text-gray-500">{n_unseen}</div>
                <div className="text-gray-400">Unseen</div>
              </div>
            </div>
            {reviewed > 0 && (
              <p className="text-xs text-center text-gray-500">Accuracy: <strong>{accuracy}%</strong></p>
            )}
          </div>

          {/* Controls */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm text-gray-700">Shuffle</span>
              <button
                onClick={toggleShuffle}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  shuffle ? 'bg-indigo-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    shuffle ? 'translate-x-4.5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </label>

            <button
              onClick={resetProgress}
              className="w-full text-sm text-gray-600 border border-gray-200 rounded-lg py-2 hover:bg-gray-50 transition-colors"
            >
              🔄 Reset Progress
            </button>

            {n_wrong > 0 && (
              <button
                onClick={studyWrongOnly}
                className="w-full text-sm text-red-600 border border-red-200 rounded-lg py-2 hover:bg-red-50 transition-colors"
              >
                Study {n_wrong} Wrong Cards
              </button>
            )}

            <Link
              href={`/sets/${id}/edit`}
              className="block w-full text-center text-sm text-indigo-600 border border-indigo-200 rounded-lg py-2 hover:bg-indigo-50 transition-colors"
            >
              ✏️ Edit Set
            </Link>
          </div>
        </aside>

        {/* Main study area */}
        <div className="flex-1 flex flex-col">
          {cursor >= studyOrder.length && studyOrder.length > 0 ? (
            /* End of deck */
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="text-5xl mb-4">🎉</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Deck Complete!</h2>
              <p className="text-gray-500 mb-6">
                {n_correct} correct · {n_wrong} wrong · {accuracy}% accuracy
              </p>
              <div className="flex gap-3 flex-wrap justify-center">
                <button
                  onClick={() => buildOrder(cards, false, shuffle)}
                  className="px-5 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Start Over
                </button>
                {n_wrong > 0 && (
                  <button
                    onClick={studyWrongOnly}
                    className="px-5 py-2.5 border border-red-300 text-red-600 font-medium rounded-lg hover:bg-red-50 transition-colors"
                  >
                    Retry {n_wrong} Wrong
                  </button>
                )}
              </div>
            </div>
          ) : studyOrder.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              No cards in queue.{' '}
              <button onClick={resetProgress} className="ml-1 text-indigo-600 hover:underline">
                Reset progress
              </button>
            </div>
          ) : (
            <>
              {/* Card counter */}
              <div className="flex justify-between items-center mb-3 text-sm text-gray-500">
                <span>
                  Card{' '}
                  <span className="font-semibold text-gray-800">{cursor + 1}</span>{' '}
                  of <span className="font-semibold text-gray-800">{studyOrder.length}</span>
                  {wrongOnly && <span className="ml-2 text-xs text-red-500">(wrong cards only)</span>}
                </span>
                {currentCard && (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    currentCard.status === 'correct' ? 'bg-green-100 text-green-700' :
                    currentCard.status === 'wrong'   ? 'bg-red-100 text-red-600' :
                                                       'bg-gray-100 text-gray-500'
                  }`}>
                    {currentCard.status === 'correct' ? '✅ Correct' :
                     currentCard.status === 'wrong'   ? '❌ Wrong' : '○ Not reviewed'}
                  </span>
                )}
              </div>

              {/* Flashcard */}
              {currentCard && (
                <div
                  className="flex-1 flex flex-col cursor-pointer select-none"
                  onClick={() => setFlipped((f) => !f)}
                  style={{ perspective: '1000px' }}
                >
                  <div
                    className={`card-inner flex-1 relative min-h-[240px]`}
                    style={{ transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)', transition: 'transform 0.45s', transformStyle: 'preserve-3d', position: 'relative' }}
                  >
                    {/* Front — Question */}
                    <div
                      className="card-face absolute inset-0 bg-white rounded-2xl border-2 flex flex-col items-center justify-center p-8 text-center"
                      style={{
                        backfaceVisibility: 'hidden',
                        WebkitBackfaceVisibility: 'hidden',
                        borderColor: currentCard.status === 'correct' ? '#22c55e' :
                                     currentCard.status === 'wrong'   ? '#ef4444' : '#e5e7eb',
                      }}
                    >
                      <p className="text-xs uppercase tracking-widest text-gray-400 mb-4">Question</p>
                      <p className="text-xl font-semibold text-gray-900 leading-relaxed">
                        {currentCard.question}
                      </p>
                      <p className="text-xs text-gray-400 mt-6">Click to flip</p>
                    </div>

                    {/* Back — Answer */}
                    <div
                      className="card-face absolute inset-0 bg-indigo-50 rounded-2xl border-2 border-indigo-200 flex flex-col items-center justify-center p-8 text-center"
                      style={{
                        backfaceVisibility: 'hidden',
                        WebkitBackfaceVisibility: 'hidden',
                        transform: 'rotateY(180deg)',
                      }}
                    >
                      <p className="text-xs uppercase tracking-widest text-indigo-400 mb-4">Answer</p>
                      <p className="text-xl font-semibold text-indigo-900 leading-relaxed">
                        {currentCard.answer}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation + mark buttons */}
              <div className="mt-4 space-y-3">
                <div className="flex gap-2">
                  <button
                    onClick={() => { setCursor((c) => Math.max(0, c - 1)); setFlipped(false) }}
                    disabled={cursor === 0}
                    className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-30 transition-colors"
                  >
                    ← Prev
                  </button>
                  <button
                    onClick={() => setFlipped((f) => !f)}
                    className="flex-2 px-8 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors"
                  >
                    {flipped ? 'Show Question' : 'Flip 🔄'}
                  </button>
                  <button
                    onClick={() => { setCursor((c) => c + 1); setFlipped(false) }}
                    className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Next →
                  </button>
                </div>

                {flipped && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => markCard('correct')}
                      className="flex-1 py-3 bg-green-500 text-white font-semibold rounded-xl hover:bg-green-600 transition-colors"
                    >
                      ✓ Got it
                    </button>
                    <button
                      onClick={() => markCard('wrong')}
                      className="flex-1 py-3 bg-red-500 text-white font-semibold rounded-xl hover:bg-red-600 transition-colors"
                    >
                      ✗ Missed it
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
