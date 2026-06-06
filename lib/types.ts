export interface FlashcardSet {
  id: string
  user_id: string
  name: string
  created_at: string
  updated_at: string
  card_count?: number
}

export interface Flashcard {
  id: string
  set_id: string
  question: string
  answer: string
  position: number
  created_at: string
}

export interface StudyProgress {
  user_id: string
  card_id: string
  status: 'unseen' | 'correct' | 'wrong'
  updated_at: string
}

export type CardStatus = 'unseen' | 'correct' | 'wrong'

export interface CardWithProgress extends Flashcard {
  status: CardStatus
}
