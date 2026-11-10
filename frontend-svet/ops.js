// Operations in the spirit of js-framework-benchmark, shared by the svet and
// Svelte harnesses so both apply exactly the same row transitions.
export function createOps() {
  let nextKey = 0
  const row = () => {
    const key = nextKey++
    return { key, text: `Piece ${key}  ${200 + (key % 400)} x ${150 + (key % 300)}  1` }
  }
  const make = n => Array.from({ length: n }, row)
  return {
    clear: () => { nextKey = 0; return [] },
    create1k: () => make(1000),
    create10k: () => make(10000),
    replace1k: () => make(1000),
    append1k: cur => cur.concat(make(1000)),
    update10th: cur => cur.map((r, i) => (i % 10 === 0 ? { key: r.key, text: r.text + ' !' } : r)),
    swap: cur => { const n = cur.slice(); [n[1], n[998]] = [n[998], n[1]]; return n },
    remove: cur => cur.filter((_, i) => i !== 500),
  }
}

// One pass: every op runs on the rows the previous one left.
export const SEQUENCE = ['clear', 'create1k', 'update10th', 'swap', 'swap', 'remove', 'append1k', 'replace1k', 'clear', 'create10k', 'clear']
