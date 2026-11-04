import type { AssetLibrary } from '../types'

export const assetLibrary: AssetLibrary = {
  characters: [
    // ── Bouncy ──
    { asset_id: 'bouncy_happy',    character: 'bouncy', pose: 'happy',    emotion: 'happy',    file: '/assets/characters/bouncy/happy.png',    tags: ['happy', 'cheerful'] },
    { asset_id: 'bouncy_pointing', character: 'bouncy', pose: 'pointing', emotion: 'neutral',  file: '/assets/characters/bouncy/pointing.png', tags: ['pointing', 'showing'] },
    { asset_id: 'bouncy_thinking', character: 'bouncy', pose: 'thinking', emotion: 'thoughtful', file: '/assets/characters/bouncy/thinking.png', tags: ['thinking', 'pondering'] },
    { asset_id: 'bouncy_wow',      character: 'bouncy', pose: 'wow',      emotion: 'amazed',   file: '/assets/characters/bouncy/wow.png',      tags: ['wow', 'amazed', 'surprised'] },
    { asset_id: 'bouncy_shocked',  character: 'bouncy', pose: 'shocked',  emotion: 'shocked',  file: '/assets/characters/bouncy/shocked.png',  tags: ['shocked', 'surprised'] },
    { asset_id: 'bouncy_angry',    character: 'bouncy', pose: 'angry',    emotion: 'angry',    file: '/assets/characters/bouncy/angry.png',    tags: ['angry', 'frustrated'] },
    { asset_id: 'bouncy_confused', character: 'bouncy', pose: 'confused', emotion: 'confused', file: '/assets/characters/bouncy/confused.png', tags: ['confused', 'question'] },
    { asset_id: 'bouncy_excited',  character: 'bouncy', pose: 'excited',  emotion: 'excited',  file: '/assets/characters/bouncy/excited.png',  tags: ['excited', 'energetic'] },
    { asset_id: 'bouncy_worried',  character: 'bouncy', pose: 'worried',  emotion: 'worried',  file: '/assets/characters/bouncy/worried.png',  tags: ['worried', 'concerned'] },
    // ── Merry ──
    { asset_id: 'merry_happy',    character: 'merry', pose: 'happy',    emotion: 'happy',    file: '/assets/characters/merry/happy.png',    tags: ['happy', 'cheerful'] },
    { asset_id: 'merry_pointing', character: 'merry', pose: 'pointing', emotion: 'neutral',  file: '/assets/characters/merry/pointing.png', tags: ['pointing', 'showing'] },
    { asset_id: 'merry_thinking', character: 'merry', pose: 'thinking', emotion: 'thoughtful', file: '/assets/characters/merry/thinking.png', tags: ['thinking', 'pondering'] },
    { asset_id: 'merry_wow',      character: 'merry', pose: 'wow',      emotion: 'amazed',   file: '/assets/characters/merry/wow.png',      tags: ['wow', 'amazed'] },
    { asset_id: 'merry_shocked',  character: 'merry', pose: 'shocked',  emotion: 'shocked',  file: '/assets/characters/merry/shocked.png',  tags: ['shocked', 'surprised'] },
    { asset_id: 'merry_angry',    character: 'merry', pose: 'angry',    emotion: 'angry',    file: '/assets/characters/merry/angry.png',    tags: ['angry', 'frustrated'] },
    { asset_id: 'merry_confused', character: 'merry', pose: 'confused', emotion: 'confused', file: '/assets/characters/merry/confused.png', tags: ['confused', 'question'] },
    { asset_id: 'merry_excited',  character: 'merry', pose: 'excited',  emotion: 'excited',  file: '/assets/characters/merry/excited.png',  tags: ['excited', 'energetic'] },
    { asset_id: 'merry_worried',  character: 'merry', pose: 'worried',  emotion: 'worried',  file: '/assets/characters/merry/worried.png',  tags: ['worried', 'concerned'] },
    // ── Pokpok ──
    { asset_id: 'pokpok_happy',        character: 'pokpok', pose: 'happy',        emotion: 'happy',      file: '/assets/characters/pokpok/happy.png',        tags: ['happy', 'cheerful'] },
    { asset_id: 'pokpok_pointing',     character: 'pokpok', pose: 'pointing',     emotion: 'neutral',    file: '/assets/characters/pokpok/pointing.png',     tags: ['pointing', 'showing'] },
    { asset_id: 'pokpok_thinking',     character: 'pokpok', pose: 'thinking',     emotion: 'thoughtful', file: '/assets/characters/pokpok/thinking.png',     tags: ['thinking', 'pondering'] },
    { asset_id: 'pokpok_wow',          character: 'pokpok', pose: 'wow',          emotion: 'amazed',     file: '/assets/characters/pokpok/wow.png',          tags: ['wow', 'amazed'] },
    { asset_id: 'pokpok_shocked',      character: 'pokpok', pose: 'shocked',      emotion: 'shocked',    file: '/assets/characters/pokpok/shocked.png',      tags: ['shocked', 'surprised'] },
    { asset_id: 'pokpok_angry',        character: 'pokpok', pose: 'angry',        emotion: 'angry',      file: '/assets/characters/pokpok/angry.png',        tags: ['angry', 'frustrated'] },
    { asset_id: 'pokpok_explaining',   character: 'pokpok', pose: 'explaining',   emotion: 'confident',  file: '/assets/characters/pokpok/explaining.png',   tags: ['explaining', 'teaching'] },
    { asset_id: 'pokpok_holding_book', character: 'pokpok', pose: 'holding_book', emotion: 'studious',   file: '/assets/characters/pokpok/holding_book.png', tags: ['reading', 'studying', 'book'] },
  ],
  backgrounds: [
    { asset_id: 'classroom',    name: 'Classroom',    file: '/assets/backgrounds/classroom.png',    tags: ['school', 'learning', 'indoor'] },
    { asset_id: 'school_canteen', name: 'School Canteen', file: '/assets/backgrounds/school_canteen.png', tags: ['school', 'food', 'Singapore'] },
    { asset_id: 'hdb_void_deck', name: 'HDB Void Deck', file: '/assets/backgrounds/hdb_void_deck.png', tags: ['HDB', 'Singapore', 'neighbourhood'] },
    { asset_id: 'park',         name: 'Park',         file: '/assets/backgrounds/park.png',         tags: ['nature', 'outdoor', 'Singapore'] },
    { asset_id: 'reservoir',    name: 'Reservoir',    file: '/assets/backgrounds/reservoir.png',    tags: ['water', 'nature', 'Singapore'] },
    { asset_id: 'home_kitchen', name: 'Home Kitchen', file: '/assets/backgrounds/home_kitchen.png', tags: ['home', 'kitchen', 'indoor'] },
    { asset_id: 'science_lab',  name: 'Science Lab',  file: '/assets/backgrounds/science_lab.png',  tags: ['science', 'school', 'experiment'] },
    { asset_id: 'mrt_station',  name: 'MRT Station',  file: '/assets/backgrounds/mrt_station.png',  tags: ['MRT', 'transport', 'Singapore'] },
    { asset_id: 'beach',        name: 'Beach',        file: '/assets/backgrounds/beach.png',        tags: ['beach', 'outdoor', 'Singapore'] },
  ],
  objects: [
    { asset_id: 'tap',           name: 'Tap',           file: '/assets/objects/tap.png',           tags: ['water', 'plumbing', 'home'] },
    { asset_id: 'recycling_bin', name: 'Recycling Bin', file: '/assets/objects/recycling_bin.png', tags: ['recycling', 'environment', 'school'] },
    { asset_id: 'water_drop',    name: 'Water Drop',    file: '/assets/objects/water_drop.png',    tags: ['water', 'conservation'] },
    { asset_id: 'flower_pot',    name: 'Flower Pot',    file: '/assets/objects/flower_pot.png',    tags: ['plant', 'garden', 'nature'] },
    { asset_id: 'tablet',        name: 'Tablet',        file: '/assets/objects/tablet.png',        tags: ['technology', 'device', 'school'] },
    { asset_id: 'school_bag',    name: 'School Bag',    file: '/assets/objects/school_bag.png',    tags: ['school', 'bag', 'student'] },
    { asset_id: 'mosquito',      name: 'Mosquito',      file: '/assets/objects/mosquito.png',      tags: ['insect', 'dengue', 'health', 'Singapore'] },
  ],
}

export function getCharacterAsset(assetId: string) {
  return assetLibrary.characters.find(a => a.asset_id === assetId)
}

export function getBackgroundAsset(assetId: string) {
  return assetLibrary.backgrounds.find(a => a.asset_id === assetId)
}

export function getObjectAsset(assetId: string) {
  return assetLibrary.objects.find(a => a.asset_id === assetId)
}

export function getCharacterPoses(character: string) {
  return assetLibrary.characters.filter(a => a.character === character)
}
