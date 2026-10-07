import Home from './pages/Home.jsx';
import Room from './pages/Room.jsx';
import { usePath } from './lib/router.js';

export default function App() {
  const path = usePath();
  const roomMatch = path.match(/^\/room\/([A-Za-z]{4})\/?$/);
  return roomMatch ? <Room key={roomMatch[1]} code={roomMatch[1].toUpperCase()} /> : <Home />;
}
