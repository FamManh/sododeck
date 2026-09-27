import { useParams } from 'react-router';

/** Stands in for the editor route in library tests. */
export function DeckStub() {
  const { deckId } = useParams();
  return <p>Editor for {deckId}</p>;
}
