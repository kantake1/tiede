import { useEffect, useRef, useState } from 'react'
import type { Expense } from '../types'

/** 編集中の支払い。null は新規入力 */
export function useEditing() {
  const [editing, setEditingState] = useState<Expense | null>(null)
  // 非同期の処理の後で「今どれを編集中か」を確かめるための参照
  const editingRef = useRef(editing)
  useEffect(() => {
    editingRef.current = editing
  }, [editing])
  // 同じ支払いを編集し直すときもフォームを作り直すための番号
  const [rev, setRev] = useState(0)
  const setEditing = (e: Expense | null) => {
    setEditingState(e)
    setRev((r) => r + 1)
  }
  return {
    editing,
    rev,
    setEditing,
    /** いま id の支払いを編集中か (undefined は新規入力中) */
    isCurrent: (id: string | undefined) => editingRef.current?.id === id,
  }
}
