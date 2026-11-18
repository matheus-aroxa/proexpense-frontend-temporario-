import { AccountSelectPage } from './pages/AccountSelectPage'
import { UserSelectPage } from './pages/UserSelectPage'
import { WorkspacePage } from './pages/WorkspacePage'
import { useSession } from './session/session-context'

function App() {
  const { user, account } = useSession()
  if (!user) return <UserSelectPage />
  if (!account) return <AccountSelectPage />
  return <WorkspacePage key={account.id} />
}

export default App
