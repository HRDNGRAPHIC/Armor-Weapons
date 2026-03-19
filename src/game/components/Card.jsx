/*
 * Card.jsx — Simple display component for Collection/DeckBuilder pages.
 * Renders a card thumbnail using the catalog card data.
 */
export default function Card({ card, small }) {
    const size = small ? { width: 90, height: 130 } : { width: 140, height: 200 };
    const fs = small ? '0.4rem' : '0.6rem';
    const statFs = small ? '0.55rem' : '0.8rem';

    return (
        <div style={{
            width: size.width, height: size.height,
            background: '#1a1a1a', border: `2px solid ${card.rarity?.color ?? '#444'}`,
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            fontFamily: "'Press Start 2P', monospace", color: '#d1d5db',
        }}>
            <div style={{ background: '#000', padding: '3px 2px', textAlign: 'center', borderBottom: '2px solid #8a0303', color: '#e2d1a3', fontSize: fs, lineHeight: 1.3, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                {card.name}
            </div>
            <div style={{ flexGrow: 1, background: '#0a0a0a', display: 'flex', justifyContent: 'center', alignItems: 'center', borderBottom: '2px solid #8a0303' }}
                 dangerouslySetInnerHTML={{ __html: card.art ?? '' }} />
            <div style={{ background: '#000', display: 'flex', justifyContent: 'space-around', textAlign: 'center', padding: '2px 0', fontSize: fs }}>
                {card.type === 'knight' && (
                    <>
                        <span style={{ color: '#ff0000', fontSize: statFs }}>{card.baseAtk}</span>
                        <span style={{ color: '#4dff4d', fontSize: statFs }}>{card.baseDef}</span>
                        <span style={{ color: '#ffd700', fontSize: statFs }}>{card.basePa}</span>
                    </>
                )}
                {card.type === 'weapon' && <span style={{ color: '#ff0000', fontSize: statFs }}>+{card.atkBonus} ATK</span>}
                {card.type === 'shield' && <span style={{ color: '#4dff4d', fontSize: statFs }}>+{card.defBonus} DEF</span>}
                {(card.type === 'item' || card.type === 'terrain') && <span style={{ color: '#ffd700', fontSize: statFs === '0.8rem' ? '0.5rem' : '0.35rem' }}>{card.desc}</span>}
            </div>
        </div>
    );
}
