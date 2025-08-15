import { redirect } from 'next/navigation'

export default function Page() {
  // We merged Market into "Liðið mitt" (Dashboard)
  return redirect('/dashboard')
}