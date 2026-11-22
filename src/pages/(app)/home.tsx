/** /home: the app's entry point after sign-in; sends people to the funnel list. */
import { Navigate } from 'react-router-dom'

export default function HomePage() {
  return <Navigate to="/funnels" replace />
}
