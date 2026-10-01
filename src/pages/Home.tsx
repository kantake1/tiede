import { Plus, Trash2, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { Toast } from '../components/Toast'
import { useToast } from '../hooks/useToast'
import { friendlyError } from '../lib/errors'
import { splitNames } from '../lib/names'
import { forgetRecent, getRecent, restoreRecent, type RecentTrip } from '../lib/recent'
import { getStore, isFirebaseConfigured } from '../store'

export function Home() {
  const [name, setName] = useState('')
  const [members, setMembers] = useState<string[]>([])
  const [memberInput, setMemberInput] = useState('')
  const [memberError, setMemberError] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [recent, setRecent] = useState(getRecent)
  const { toast, notify, close: closeToast } = useToast()
  const memberRef = useRef<HTMLInputElement>(null)

  /** 入力欄の名前を一覧に足し、足した後の一覧を返す */
  function addMembers(text = memberInput) {
    const names = splitNames(text)
    const dup = names.filter((n) => members.includes(n))
    const next = [...members, ...names.filter((n) => !members.includes(n))]
    setMembers(next)
    setMemberInput('')
    setMemberError(dup.length ? `${dup.join('、')} はすでに追加しています` : '')
    return next
  }

  async function create(e: React.FormEvent) {
    e.preventDefault()
    // 入力欄に残った名前も含めて作成する (追加の押し忘れ対策)
    const memberNames = addMembers()
    if (!name.trim()) return setError('グループ名を入力してください')
    if (memberNames.length < 2) return setError('メンバーを2人以上追加してください')
    if (memberNames.some((n) => n.length > 50)) return setError('メンバー名は50文字以内にしてください')
    if (memberNames.length > 100) return setError('メンバーは100人までにしてください')
    setBusy(true)
    setError('')
    try {
      const store = await getStore()
      const id = await store.createTrip(name.trim(), memberNames)
      location.assign(`/t/${id}`)
    } catch (err) {
      setError(`作成できませんでした: ${friendlyError(err)}`)
      setBusy(false)
    }
  }

  function forget(r: RecentTrip) {
    forgetRecent(r.id)
    setRecent(getRecent())
    notify(`「${r.name}」を履歴から削除しました`, {
      action: {
        label: '元に戻す',
        run: () => {
          restoreRecent(r)
          setRecent(getRecent())
        },
      },
    })
  }

  return (
    <main>
      {!isFirebaseConfigured && (
        <p className="notice">Firebase 未設定のためローカルモードで動作中です。データはこのブラウザ内にのみ保存され、共有できません。</p>
      )}
      <section className="card">
        <h2>新しいグループを作成</h2>
        <form onSubmit={create} className="stack">
          <label>
            グループ名
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例: いつものメンバー" maxLength={100} />
          </label>
          <div>
            <div className="field-label">
              <span>メンバー</span>
              <span className="muted">{members.length}人</span>
            </div>
            <div className="row">
              <input
                ref={memberRef}
                className="grow"
                value={memberInput}
                onChange={(e) => setMemberInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    e.preventDefault()
                    addMembers()
                  }
                }}
                // カンマ・改行を含む貼り付けは、まとめて追加する
                onPaste={(e) => {
                  const text = e.clipboardData.getData('text')
                  if (!/[\n,、，]/.test(text)) return
                  e.preventDefault()
                  addMembers(memberInput + text)
                }}
                placeholder="名前"
                maxLength={50}
                enterKeyHint="done"
                aria-label="追加するメンバーの名前"
              />
              <button type="button" className="member-add" onClick={() => {
                  addMembers()
                  memberRef.current?.focus()
                }}>
                <Plus size={16} />
                追加
              </button>
            </div>
            {memberError && <p className="error small">{memberError}</p>}
            {members.length > 0 && (
              <ul className="member-list">
                {members.map((m, i) => (
                  <li key={m}>
                    <span className="muted small">{i + 1}</span>
                    <span className="grow">{m}</span>
                    <button
                      type="button"
                      className="ghost icon"
                      onClick={() => setMembers(members.filter((x) => x !== m))}
                      aria-label={`${m} を外す`}
                    >
                      <X size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {error && <p className="error">{error}</p>}
          <button type="submit" className="primary" disabled={busy}>
            {busy ? '作成中…' : '作成'}
          </button>
          <p className="muted small">
            作成すると共有用の URL が発行されます。URL を知っている人は誰でも閲覧・編集・削除できるので、メンバー以外には教えないでください。
          </p>
        </form>
      </section>

      {recent.length > 0 && (
        <section className="card">
          <h2>最近開いたグループ</h2>
          {/* サイドバーのイベントと同じ: デスクトップは薄いゴミ箱、タブレット・スマホは行を左へスワイプ */}
          <ul className="list">
            {recent.map((r) => (
              <li key={r.id} className="sb-row">
                <div className="sb-row-main">
                  <a href={`/t/${r.id}`} className="grow recent-link">
                    {r.name}
                  </a>
                </div>
                <button className="sb-trash" onClick={() => forget(r)} aria-label={`${r.name} を履歴から削除`} title="履歴から削除">
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
          <p className="muted small swipe-hint">行を左へスワイプすると削除できます</p>
        </section>
      )}
      <Toast toast={toast} onClose={closeToast} />
    </main>
  )
}
