'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import { useUser } from '@/lib/hooks/useUser'
import type { Flashcard } from '@/lib/types'

type EditableCard = Pick<Flashcard, 'id' | 'question' | 'answer' | 'position'> & { isNew?: boolean }

export default function EditPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user, email } = useUser()
  const supabase = createClient()

  const [setName, setSetName] = useState('')
  const [cards, setCards] = useState<EditableCard[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [newQ, setNewQ] = useState('')
  const [newA, setNewA] = useState('')

  const loadData = useCallback(async () => {
    if (!user) return
    const [{ data: setData }, { data: cardData }] = await Promise.all([
      supabase.from('flashcard_sets').select('name').eq('id', id).single(),
      supabase.from('flashcards').select('id,question,answer,position').eq('set_id', id).order('position'),
    ])
    if (!setData) { router.push('/dashboard'); return }
    setSetName(setData.name)
    setCards(cardData ?? [])
    setLoading(false)
  }, [user, id])

  useEffect(() => { loadData() }, [loadData])

  function updateCard(idx: number, field: 'question' | 'answer', value: string) {
    setCards((prev) => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c))
  }

  function deleteCard(idx: number) {
    setCards((prev) => prev.filter((_, i) => i !== idx))
  }

  function addCard() {
    if (!newQ.trim() || !newA.trim()) return
    setCards((prev) => [
      ...prev,
      { id: `new-${Date.now()}`, question: newQ.trim(), answer: newA.trim(), position: prev.length, isNew: true },
    ])
    setNewQ('')
    setNewA('')
  }

  async function handleSave() {
    if (!user) return
    setSaving(true)
    setError('')

    // Update set name
    await supabase.from('flashcard_sets').update({ name: setName }).eq('id', id)

    // Separate new cards (insert) from existing cards (upsert) so PostgreSQL
    // generates UUIDs for new rows instead of receiving an explicit null id.
    const existingCards = cards
      .filter((c) => !c.isNew)
      .map((c, _i) => ({ id: c.id, set_id: id, question: c.question, answer: c.answer, position: cards.indexOf(c) }))

    const newCards = cards
      .filter((c) => c.isNew)
      .map((c) => ({ set_id: id, question: c.question, answer: c.answer, position: cards.indexOf(c) }))

    // Get original card ids to find deleted ones
    const { data: origCards } = await supabase
      .from('flashcards')
      .select('id')
      .eq('set_id', id)

    const origIds = new Set((origCards ?? []).map((c: { id: string }) => c.id))
    const keptIds = new Set(existingCards.map((c) => c.id))
    const deletedIds = [...origIds].filter((oid) => !keptIds.has(oid))

    if (existingCards.length > 0) {
      const { error: upsertErr } = await supabase.from('flashcards').upsert(existingCards, { onConflict: 'id' })
      if (upsertErr) {
        setError(upsertErr.message)
        setSaving(false)
        return
      }
    }

    if (newCards.length > 0) {
      const { error: insertErr } = await supabase.from('flashcards').insert(newCards)
      if (insertErr) {
        setError(insertErr.message)
        setSaving(false)
        return
      }
    }

    if (deletedIds.length > 0) {
      const { error: deleteErr } = await supabase.from('flashcards').delete().in('id', deletedIds)
      if (deleteErr) {
        setError(deleteErr.message)
        setSaving(false)
        return
      }
    }

    router.push(`/sets/${id}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar email={email} />
        <div className="flex-1 flex items-center justify-center text-gray-400">Loading…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar email={email} />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex-1 mr-4">
            <label className="block text-xs font-medium text-gray-500 mb-1">Set name</label>
            <input
              value={setName}
              onChange={(e) => setSetName(e.target.value)}
              className="w-full text-xl font-bold text-gray-900 border-b-2 border-gray-200 focus:border-indigo-500 focus:outline-none bg-transparent pb-1"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => router.push(`/sets/${id}`)}
              className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : '💾 Save'}
            </button>
          </div>
        </div>

        {error && (
          <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>
        )}

        <div className="space-y-3">
          {cards.map((card, idx) => (
            <div
              key={card.id}
              className="bg-white border border-gray-200 rounded-xl p-4 flex gap-3 items-start"
            >
              <span className="text-xs text-gray-400 mt-2.5 w-5 text-right shrink-0">{idx + 1}</span>
              <div className="flex-1 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Question</label>
                  <textarea
                    value={card.question}
                    onChange={(e) => updateCard(idx, 'question', e.target.value)}
                    rows={2}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Answer</label>
                  <textarea
                    value={card.answer}
                    onChange={(e) => updateCard(idx, 'answer', e.target.value)}
                    rows={2}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>
              </div>
              <button
                onClick={() => deleteCard(idx)}
                className="text-gray-400 hover:text-red-500 transition-colors mt-2 shrink-0"
                title="Delete card"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        {/* Add new card */}
        <div className="mt-4 bg-white border-2 border-dashed border-gray-200 rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium text-gray-500">Add a card</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Question</label>
              <textarea
                value={newQ}
                onChange={(e) => setNewQ(e.target.value)}
                rows={2}
                placeholder="Question…"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Answer</label>
              <textarea
                value={newA}
                onChange={(e) => setNewA(e.target.value)}
                rows={2}
                placeholder="Answer…"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>
          </div>
          <button
            onClick={addCard}
            disabled={!newQ.trim() || !newA.trim()}
            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-40 transition-colors"
          >
            + Add Card
          </button>
        </div>

        <p className="text-xs text-gray-400 mt-3 text-center">
          {cards.length} card{cards.length !== 1 ? 's' : ''} · Click Save when done
        </p>
      </main>
    </div>
  )
}
