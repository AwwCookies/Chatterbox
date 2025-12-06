import { useThreadCardStore } from '../../stores/threadCardStore';
import ThreadCard from './ThreadCard';

function ThreadCardContainer() {
  const { cards, closeCard, updatePosition, togglePin, bringToFront } = useThreadCardStore();

  if (cards.length === 0) return null;

  return (
    <>
      {cards.map(card => (
        <ThreadCard
          key={card.id}
          id={card.id}
          messageId={card.messageId}
          channelId={card.channelId}
          position={card.position}
          isPinned={card.isPinned}
          zIndex={card.zIndex}
          onClose={() => closeCard(card.id)}
          onUpdatePosition={(pos) => updatePosition(card.id, pos)}
          onTogglePin={() => togglePin(card.id)}
          onBringToFront={() => bringToFront(card.id)}
        />
      ))}
    </>
  );
}

export default ThreadCardContainer;
