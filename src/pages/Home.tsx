import { X } from 'lucide-react'
import { useState } from 'react'
import { friendlyError } from '../lib/errors'
import { forgetRecent, getRecent } from '../lib/recent'
import { getStore, isFirebaseConfigured } from '../store'

export function Home() {
  const [name, setName] = useState('')
  const [membersText, setMembersText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [recent, setRecent] = useState(getRecent)

  const memberNames = [...new Set(membersText.split(/[\n,、，]/).map((s) => s.trim()).filter(Boolean))]

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError('グループ名を入力する')
    if (memberNames.length < 2) return setError('メンバーを2人以上入力する')
    if (memberNames.some((n) => n.length > 50)) return setError('メンバー名は50文字以内にする')
    if (memberNames.length > 100) return setError('メンバーは100人までにする')
    setBusy(true)
    setError('')
    try {
      const store = await getStore()
      const id = await store.createTrip(name.trim(), memberNames)
      location.hash = `#/t/${id}`
    } catch (err) {
      setError(`作成に失敗した: ${friendlyError(err)}`)
      setBusy(false)
    }
  }

  return (
    <main>
      {!isFirebaseConfigured && (
        <p className="notice">Firebase 未設定のためローカルモードで動作中。データはこのブラウザ内にのみ保存され、共有できない。</p>
      )}
      <section className="card">
        <h2>新しいグループを作成</h2>
        <form onSubmit={create} className="stack">
          <label>
            グループ名
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例: 大学の友達" maxLength={100} />
          </label>
          <label>
            メンバー (改行またはカンマ区切り)
            <textarea
              value={membersText}
              onChange={(e) => setMembersText(e.target.value)}
              rows={4}
              placeholder={'たろう\nはなこ\nじろう'}
            />
          </label>
          {memberNames.length > 0 && (
            <div className="chips">
              {memberNames.map((m) => (
                <span key={m} className="chip">
                  {m}
                </span>
              ))}
            </div>
          )}
          {error && <p className="error">{error}</p>}
          <button type="submit" className="primary" disabled={busy}>
            {busy ? '作成中…' : '作成して共有URLを発行'}
          </button>
        </form>
      </section>

      {recent.length > 0 && (
        <section className="card">
          <h2>最近開いたグループ</h2>
          <ul className="list">
            {recent.map((r) => (
              <li key={r.id} className="row">
                <a href={`#/t/${r.id}`} className="grow">
                  {r.name}
                </a>
                <button
                  className="ghost small"
                  onClick={() => {
                    forgetRecent(r.id)
                    setRecent(getRecent())
                  }}
                  aria-label={`${r.name} を履歴から削除`}
                >
                  <X size={16} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}
