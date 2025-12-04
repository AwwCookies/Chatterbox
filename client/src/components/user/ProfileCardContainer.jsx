import { useProfileCardStore } from '../../stores/profileCardStore';
import UserProfileCard from './UserProfileCard';

function ProfileCardContainer() {
  const { cards, closeCard, updatePosition, togglePin, bringToFront } = useProfileCardStore();

  if (cards.length === 0) return null;

  return (
    <>
      {cards.map(card => (
        <UserProfileCard
          key={card.id}
          id={card.id}
          username={card.username}
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

export default ProfileCardContainer;
