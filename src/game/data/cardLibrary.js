/*
 * cardLibrary.js — Extended card library with unique IDs and lore connections.
 * Wraps cardCatalog.js and adds: relatedTo, lore, set fields.
 * Used for future story expansions and collection displays.
 */
import { CARD_CATALOG, RARITIES, getCardById, getCardsByType } from './cardCatalog';

// Re-export everything from cardCatalog for convenience
export { RARITIES, getCardById, getCardsByType, CARD_CATALOG };

/*
 * relatedTo map: catalogId → array of related catalogIds.
 * Links minor cards to their legendary "anchor" for future story expansions.
 *
 * Example: Sardeth il Re Nero (K012) is connected to several cards
 * in his storyline.
 */
const RELATIONS = {
  // Sardeth il Re Nero's court
  'K012': ['K014', 'W025', 'S035', 'I046'],  // Sardeth → Mortharion, Spadone di Sangue, Egida del Re Morto, Sottrai
  'K014': ['K012', 'I045'],                    // Mortharion Spettrale → Sardeth, Sacrificio
  'K013': ['W026', 'W024'],                    // Velkan il Distruttore → Spadone di Sangue, Lama Oscura

  // Ragnar's warband
  'K010': ['W022', 'W023', 'I040'],            // Ragnar Lugubre → Flagello di Catene, Falce Animica, Sabbia
  'K008': ['S033', 'I042'],                    // Vornik il Brutale → Egida Oscura, Veleno Berserker

  // Azrael's shadow
  'K006': ['I043', 'T054'],                    // Azrael il Silente → Lacrima di Angelo, Riflesso Oscuro
  'K011': ['I044', 'S034'],                    // Kaelen il Dannato → Sangue al Nemico, Barriera dell'Abisso
};

/**
 * Full card library — each card enriched with relatedTo array.
 * Every card object has:
 *   - All fields from CARD_CATALOG
 *   - relatedTo: string[] — catalogIds of lore-linked cards
 *   - set: string — expansion set name
 */
export const CARD_LIBRARY = CARD_CATALOG.map(card => ({
  ...card,
  relatedTo: RELATIONS[card.catalogId] ?? [],
  set: 'base',
}));

/**
 * Get full library card by catalogId (with relations).
 */
export function getLibraryCard(catalogId) {
  return CARD_LIBRARY.find(c => c.catalogId === catalogId) ?? null;
}

/**
 * Get all cards related to a given card.
 */
export function getRelatedCards(catalogId) {
  const card = getLibraryCard(catalogId);
  if (!card || card.relatedTo.length === 0) return [];
  return card.relatedTo.map(id => getLibraryCard(id)).filter(Boolean);
}

/**
 * Generate a Starter Deck: 45 Common cards + 0.07% chance of Uncommon each.
 * Returns array of { catalogId, quantity: 1 } for addCardsToCollection.
 */
export function generateStarterDeck() {
  const commonCards = CARD_CATALOG.filter(c => c.rarity?.id === 'comune');
  const rareCards = CARD_CATALOG.filter(c => c.rarity?.id === 'rara');
  const cards = [];
  const cardCounts = {};

  for (let i = 0; i < 45; i++) {
    let card;
    // 0.07% chance for a Rare (Uncommon equivalent)
    if (Math.random() < 0.0007 && rareCards.length > 0) {
      card = rareCards[Math.floor(Math.random() * rareCards.length)];
    } else {
      card = commonCards[Math.floor(Math.random() * commonCards.length)];
    }
    cardCounts[card.catalogId] = (cardCounts[card.catalogId] ?? 0) + 1;
  }

  return Object.entries(cardCounts).map(([catalogId, quantity]) => ({
    catalogId,
    quantity,
  }));
}
