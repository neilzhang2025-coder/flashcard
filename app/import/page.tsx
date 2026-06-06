'use client'

export const dynamic = 'force-dynamic'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Papa from 'papaparse'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import { useUser } from '@/lib/hooks/useUser'

type ParsedCard = { question: string; answer: string }

function parseTextToCards(text: string): ParsedCard[] | null {
  // Try tab, then comma as delimiter
  for (const delim of ['\t', ',', ';']) {
    const result = Papa.parse<string[]>(text.trim(), { delimiter: delim })
    const rows = result.data.filter((r) => r.length === 2 && r[0].trim() && r[1].trim())
    if (rows.length > 0) {
      return rows.map((r) => ({ question: r[0].trim(), answer: r[1].trim() }))
    }
  }
  return null
}

export default function ImportPage() {
  const router = useRouter()
  const { user, email } = useUser()
  const supabase = createClient()

  const [tab, setTab] = useState<'csv' | 'paste'>('csv')
  const [preview, setPreview] = useState<ParsedCard[] | null>(null)
  const [parseError, setParseError] = useState('')
  const [setName, setSetName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setParseError('')
    setPreview(null)

    Papa.parse<string[]>(file, {
      complete(result) {
        const rows = result.data.filter((r) => r.length >= 2 && r[0].trim() && r[1].trim())
        if (rows.length === 0) {
          setParseError('No valid rows found. File must have exactly 2 columns: question and answer.')
          return
        }
        setPreview(rows.map((r) => ({ question: r[0].trim(), answer: r[1].trim() })))
      },
      error(err) {
        setParseError(`Parse error: ${err.message}`)
      },
      skipEmptyLines: true,
    })
  }

  function handlePaste(text: string) {
    setParseError('')
    setPreview(null)
    if (!text.trim()) return
    const cards = parseTextToCards(text)
    if (!cards) {
      setParseError('Could not detect 2 columns. Separate question and answer with a tab or comma.')
    } else {
      setPreview(cards)
    }
  }

  async function handleImport() {
    if (!preview || !setName.trim() || !user) return
    setSaving(true)
    setSaveError('')

    const { data: newSet, error: setErr } = await supabase
      .from('flashcard_sets')
      .insert({ user_id: user.id, name: setName.trim() })
      .select('id')
      .single()

    if (setErr || !newSet) {
      setSaveError(setErr?.message ?? 'Failed to create set.')
      setSaving(false)
      return
    }

    const cards = preview.map((c, i) => ({
      set_id: newSet.id,
      question: c.question,
      answer: c.answer,
      position: i,
    }))

    const { error: cardErr } = await supabase.from('flashcards').insert(cards)
    if (cardErr) {
      setSaveError(cardErr.message)
      setSaving(false)
      return
    }

    router.push(`/sets/${newSet.id}`)
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar email={email} />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Import Flashcards</h1>

        {/* Tab selector */}
        <div className="flex rounded-lg bg-gray-100 p-1 mb-6 w-fit">
          {(['csv', 'paste'] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setPreview(null); setParseError('') }}
              className={`px-5 py-2 text-sm font-medium rounded-md transition-colors ${
                tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'csv' ? '📁 Upload CSV' : '📋 Paste Text'}
            </button>
          ))}
        </div>

        {tab === 'csv' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Upload a <strong>.csv</strong> file with 2 columns: <code className="bg-gray-100 px-1 rounded">question</code> and <code className="bg-gray-100 px-1 rounded">answer</code>. Comma, tab, or semicolon separated.
            </p>
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-10 cursor-pointer hover:border-indigo-400 transition-colors bg-white">
              <span className="text-3xl mb-2">📂</span>
              <span className="text-sm font-medium text-gray-700">Click to upload a CSV file</span>
              <span className="text-xs text-gray-400 mt-1">or drag and drop</span>
              <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFileChange} className="hidden" />
            </label>
            <p className="text-xs text-gray-400">
              Don't have a file?{' '}
              <a href="/sample_cards.csv" download className="text-indigo-600 hover:underline">
                Download sample CSV
              </a>
            </p>
          </div>
        )}

        {tab === 'paste' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Paste rows with question and answer separated by a <strong>tab</strong> or <strong>comma</strong>. One card per line.
            </p>
            <pre className="text-xs bg-gray-100 rounded-lg px-4 py-3 text-gray-600">
{`What is the capital of France?\tParis
Largest planet in solar system?\tJupiter`}
            </pre>
            <textarea
              className="w-full h-48 border border-gray-300 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
              placeholder="question&#9;answer"
              onChange={(e) => handlePaste(e.target.value)}
            />
          </div>
        )}

        {parseError && (
          <div className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            {parseError}
          </div>
        )}

        {preview && (
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-800">
                Preview — {preview.length} card{preview.length !== 1 ? 's' : ''} detected
              </h2>
            </div>

            <div className="overflow-auto rounded-xl border border-gray-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 w-8">#</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Question</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Answer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {preview.slice(0, 10).map((card, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-gray-400">{i + 1}</td>
                      <td className="px-4 py-2.5 text-gray-700">{card.question}</td>
                      <td className="px-4 py-2.5 text-gray-700">{card.answer}</td>
                    </tr>
                  ))}
                  {preview.length > 10 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-2.5 text-center text-gray-400 text-xs">
                        … and {preview.length - 10} more
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Set name</label>
                <input
                  type="text"
                  value={setName}
                  onChange={(e) => setSetName(e.target.value)}
                  placeholder="e.g. Spanish Vocabulary"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <button
                onClick={handleImport}
                disabled={!setName.trim() || saving}
                className="px-5 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors whitespace-nowrap"
              >
                {saving ? 'Saving…' : `Import ${preview.length} Cards`}
              </button>
            </div>

            {saveError && (
              <p className="text-sm text-red-600">{saveError}</p>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
