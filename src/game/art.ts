// Every emoji in the game comes from this file, so real art can replace them in one place.
import type { Tile } from './map'

export const TILE_EMOJI: Record<Tile, string> = {
  road: '',
  grass: '',
  tree: '🌳',
  water: '🌊',
  building: '',
  door: '🚪',
}

export const PLAYER_EMOJI = '🧑'

export const PLACE_ART: Record<string, { sign: string; host: string; greeting_vi: string }> = {
  cafe: { sign: '☕', host: '🧑‍🍳', greeting_vi: 'Chào bạn! Hôm nay bạn muốn học từ nào ở quán cà phê?' },
  supermarket: { sign: '🛒', host: '🧑‍💼', greeting_vi: 'Xin chào! Bạn muốn học từ nào khi đi siêu thị?' },
  taxi: { sign: '🚕', host: '🧑‍✈️', greeting_vi: 'Chào bạn, lên xe nào! Hôm nay mình học từ gì?' },
  clinic: { sign: '🏥', host: '🧑‍⚕️', greeting_vi: 'Chào bạn! Bạn muốn học từ nào khi đi khám bệnh?' },
}
