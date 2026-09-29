/** おあいこのロゴ (寄り添う2つのおもち = お互いさま・貸し借りなし。背景なし) と名前。マークは favicon.svg を共用 (絵柄を変えたら ?v= を上げる: index.html・manifest も同じ) */
export function Logo() {
  return (
    <span className="brand">
      <img src="/favicon.svg?v=4" width="24" height="24" alt="" />
      おあいこ
    </span>
  )
}
