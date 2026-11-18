import { useEffect, useState, type ReactNode } from 'react'
import { CardIcon, LayersIcon, LogoutIcon, ReceiptIcon, RefreshIcon, TagIcon, UsersIcon } from '../components/icons'
import { Alert, Button, IconButton, LoadingState } from '../components/ui'
import { CardsPage } from '../features/cards/CardsPage'
import { CategoriesPage } from '../features/categories/CategoriesPage'
import { ExpensesPage } from '../features/expenses/ExpensesPage'
import { InstallmentsPage } from '../features/installments/InstallmentsPage'
import { MembersPage } from '../features/members/MembersPage'
import { initials } from '../lib/format'
import { useSession } from '../session/session-context'
import { useWorkspace } from '../session/workspace-context'
import { WorkspaceProvider } from '../session/WorkspaceProvider'
import { Brand } from './Brand'

const TABS = [
  { id: 'despesas', label: 'Despesas', icon: <ReceiptIcon />, render: () => <ExpensesPage /> },
  { id: 'parcelamentos', label: 'Parcelamentos', icon: <LayersIcon />, render: () => <InstallmentsPage /> },
  { id: 'cartoes', label: 'Cartões', icon: <CardIcon />, render: () => <CardsPage /> },
  { id: 'categorias', label: 'Categorias', icon: <TagIcon />, render: () => <CategoriesPage /> },
  { id: 'membros', label: 'Membros', icon: <UsersIcon />, render: () => <MembersPage /> },
] as const

type TabId = (typeof TABS)[number]['id']

const tabFromHash = (): TabId => {
  const hash = window.location.hash.replace('#', '')
  return (TABS.find((tab) => tab.id === hash)?.id ?? 'despesas') as TabId
}

function useHashTab(): [TabId, (tab: TabId) => void] {
  const [tab, setTab] = useState<TabId>(tabFromHash)
  useEffect(() => {
    const onChange = () => setTab(tabFromHash())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return [tab, (next) => (window.location.hash = next)]
}

export function WorkspacePage() {
  const { user, account } = useSession()
  return (
    <WorkspaceProvider account={account!} me={user!}>
      <WorkspaceShell />
    </WorkspaceProvider>
  )
}

function WorkspaceShell() {
  const { account, me, loading, error, reload } = useWorkspace()
  const { selectAccount, signOut } = useSession()
  const [tab, setTab] = useHashTab()
  const [refreshing, setRefreshing] = useState(false)

  const current = TABS.find((item) => item.id === tab)!

  async function refresh() {
    setRefreshing(true)
    await reload()
    setRefreshing(false)
  }

  return (
    <div className="min-h-svh">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Brand />
          <span className="text-line">/</span>
          <button
            type="button"
            onClick={() => selectAccount(null)}
            className="truncate rounded-md px-1.5 py-1 text-sm font-medium text-ink hover:bg-surface-2"
            title="Trocar de conta"
          >
            {account.name}
          </button>
          <div className="ml-auto flex items-center gap-1">
            <IconButton label="Atualizar dados" onClick={refresh} disabled={refreshing}>
              <RefreshIcon className={refreshing ? 'animate-spin' : ''} />
            </IconButton>
            <span className="hidden items-center gap-2 pl-2 text-sm text-ink-2 sm:flex">
              <span className="flex size-7 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand">
                {initials(me.name)}
              </span>
              {me.name}
            </span>
            <IconButton label="Trocar de usuário" onClick={signOut}>
              <LogoutIcon />
            </IconButton>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4" aria-label="Seções">
          {TABS.map((item) => (
            <TabLink key={item.id} active={item.id === tab} onClick={() => setTab(item.id)} icon={item.icon}>
              {item.label}
            </TabLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {error && (
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="flex-1">
              <Alert>{error}</Alert>
            </div>
            <Button variant="secondary" size="sm" onClick={refresh}>
              Tentar novamente
            </Button>
          </div>
        )}
        {loading ? <LoadingState label="Carregando dados da conta…" /> : current.render()}
      </main>
    </div>
  )
}

function TabLink({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: ReactNode; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition ${
        active ? 'border-brand text-ink' : 'border-transparent text-ink-3 hover:text-ink'
      }`}
    >
      {icon}
      {children}
    </button>
  )
}
