import { COMMON_WORDS } from '../words/common'
import { WORDS_EN } from '../words/en'

// The curated list plus about 5,500 common dictionary words, so races rarely repeat a word.
const ALL = [...new Set([...WORDS_EN, ...COMMON_WORDS])]
import type { Tiers } from './sentences'

/** English words by difficulty. Easy: up to 4 letters. Medium: 5 to 7. Hard: long and tricky words. Plain ASCII. */
const HARD = [
  'adventure', 'afternoon', 'beautiful', 'beginning', 'brilliant', 'celebrate', 'challenge', 'character', 'community', 'concentrate',
  'confidence', 'connection', 'consider', 'difference', 'direction', 'discovery', 'education', 'encourage', 'environment', 'excellent',
  'experience', 'explanation', 'fantastic', 'friendship', 'generation', 'government', 'happiness', 'imagination', 'important', 'information',
  'interesting', 'invitation', 'knowledge', 'landscape', 'literature', 'marvelous', 'mysterious', 'necessary', 'neighborhood', 'opportunity',
  'organization', 'particular', 'performance', 'photograph', 'possibility', 'practical', 'preparation', 'protection', 'punctuation', 'question',
  'recognize', 'refrigerator', 'relationship', 'responsible', 'restaurant', 'revolution', 'scientific', 'something', 'strength', 'structure',
  'successful', 'technology', 'temperature', 'thoughtful', 'throughout', 'tomorrow', 'tournament', 'transportation', 'understand', 'university',
  'vocabulary', 'wonderful', 'yesterday', 'accomplish', 'appreciate', 'catastrophe', 'curiosity', 'determination', 'enthusiasm', 'extraordinary',
  'imaginative', 'independent', 'magnificent', 'misunderstanding', 'perseverance', 'psychology', 'rhythm', 'stubborn', 'unforgettable', 'vegetable',
]

export const RACE_WORDS: Tiers = {
  easy: ALL.filter((w) => w.length >= 2 && w.length <= 4 && /^[a-z]+$/.test(w)),
  medium: ALL.filter((w) => w.length >= 5 && w.length <= 7 && /^[a-z]+$/.test(w)),
  hard: [...new Set([...HARD, ...ALL.filter((w) => w.length >= 8 && /^[a-z]+$/.test(w))])],
}
