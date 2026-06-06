export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import Navbar from '@/components/Navbar'
import { FlashcardSet } from '@/lib/types'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  // Fetch sets with card count
  const { data: sets } = await supabase
    .from('flashcard_sets')
    .select('*, flashcards(count)')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  const setsWithCount = (sets ?? []).map((s: FlashcardSet & { flashcards: { count: number }[] }) => ({
    ...s,
    card_count: s.flashcards?.[0]?.count ?? 0,
  }))

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar email={user.email ?? ''} />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">My Sets</h1>
          <Link
            href="/import"
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            + New Set
          </Link>
        </div>

        {setsWithCount.length === 0 ? (
          <div className="text-center py-24 text-gray-400">
            <div className="text-5xl mb-4">🃏</div>
            <p className="text-lg font-medium">No sets yet</p>
            <p className="text-sm mt-1">Import a CSV or paste text to create your first set.</p>
            <Link
              href="/import"
              className="inline-block mt-6 px-5 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Create First Set
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {setsWithCount.map((set) => (
              <Link
                key={set.id}
                href={`/sets/${set.id}`}
                className="block bg-white border border-gray-200 rounded-xl p-5 hover:border-indigo-300 hover:shadow-sm transition-all group"
              >
                <h2 className="font-semibold text-gray-900 group-hover:text-indigo-700 truncate">
                  {set.name}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {set.card_count} {set.card_count === 1 ? 'card' : 'cards'}
                </p>
                <p className="text-xs text-gray-400 mt-3">
                  {new Date(set.updated_at).toLocaleDateString()}
                </p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
