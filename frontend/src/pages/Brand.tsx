export function Brand({ large }: { large?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`flex items-center justify-center rounded-lg bg-brand font-bold text-brand-ink ${
          large ? 'size-10 text-lg' : 'size-7 text-sm'
        }`}
      >
        P
      </span>
      <span className={`font-semibold tracking-tight text-ink ${large ? 'text-2xl' : 'text-base'}`}>ProExpense</span>
    </span>
  )
}
