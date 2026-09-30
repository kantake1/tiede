// re2js (約40KB gzip) の代わり。Firestore SDK はパイプライン (正規表現の条件) でだけ使い、このアプリは使わない。
// ponytail: パイプラインの正規表現を使うことになったら vite.config.ts の alias を外す
export const RE2JS = {
  compile(): never {
    throw new Error('re2js is not bundled')
  },
}
