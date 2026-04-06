/**
 * OpenSCAD subset parser and mesh generator.
 * Supports: cube, sphere, cylinder, translate, rotate, scale, color, union, difference, intersection
 */
import { identity, translate, rotateX, rotateY, rotateZ, scale, multiply, type Mat4, type Vec3 } from './math3d'

// ── Token types ──

enum TT {
  Num, Ident, LParen, RParen, LBrace, RBrace, LBracket, RBracket,
  Comma, Semi, Eq, Plus, Minus, Star, Slash, Percent, Hash, Dollar, Dot,
  Lt, Gt, LtEq, GtEq, EqEq, NotEq, Not, And, Or, Question, Colon, Eof,
}

interface Token { type: TT; value: string; pos: number }

function tokenize(src: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < src.length) {
    // skip whitespace
    if (/\s/.test(src[i])) { i++; continue }
    // skip line comments
    if (src[i] === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++
      continue
    }
    // skip block comments
    if (src[i] === '/' && src[i + 1] === '*') {
      i += 2
      while (i < src.length - 1 && !(src[i] === '*' && src[i + 1] === '/')) i++
      i += 2
      continue
    }
    const pos = i
    // number
    if (/[0-9]/.test(src[i]) || (src[i] === '.' && /[0-9]/.test(src[i + 1]))) {
      let num = ''
      if (src[i] === '-') { num += '-'; i++ }
      while (i < src.length && /[0-9]/.test(src[i])) { num += src[i]; i++ }
      if (i < src.length && src[i] === '.') { num += '.'; i++; while (i < src.length && /[0-9]/.test(src[i])) { num += src[i]; i++ } }
      if (i < src.length && (src[i] === 'e' || src[i] === 'E')) { num += src[i]; i++; if (src[i] === '+' || src[i] === '-') { num += src[i]; i++ }; while (i < src.length && /[0-9]/.test(src[i])) { num += src[i]; i++ } }
      tokens.push({ type: TT.Num, value: num, pos })
      continue
    }
    // identifier
    if (/[a-zA-Z_$]/.test(src[i])) {
      let id = ''
      while (i < src.length && /[a-zA-Z0-9_$]/.test(src[i])) { id += src[i]; i++ }
      tokens.push({ type: TT.Ident, value: id, pos })
      continue
    }
    // two-char ops
    const two = src.slice(i, i + 2)
    if (two === '<=') { tokens.push({ type: TT.LtEq, value: two, pos }); i += 2; continue }
    if (two === '>=') { tokens.push({ type: TT.GtEq, value: two, pos }); i += 2; continue }
    if (two === '==') { tokens.push({ type: TT.EqEq, value: two, pos }); i += 2; continue }
    if (two === '!=') { tokens.push({ type: TT.NotEq, value: two, pos }); i += 2; continue }
    if (two === '&&') { tokens.push({ type: TT.And, value: two, pos }); i += 2; continue }
    if (two === '||') { tokens.push({ type: TT.Or, value: two, pos }); i += 2; continue }
    // single-char
    const map: Record<string, TT> = {
      '(': TT.LParen, ')': TT.RParen, '{': TT.LBrace, '}': TT.RBrace,
      '[': TT.LBracket, ']': TT.RBracket, ',': TT.Comma, ';': TT.Semi,
      '=': TT.Eq, '+': TT.Plus, '-': TT.Minus, '*': TT.Star, '/': TT.Slash,
      '%': TT.Percent, '#': TT.Hash, '<': TT.Lt, '>': TT.Gt, '!': TT.Not,
      '?': TT.Question, ':': TT.Colon, '.': TT.Dot,
    }
    if (map[src[i]] !== undefined) {
      tokens.push({ type: map[src[i]], value: src[i], pos })
      i++
      continue
    }
    // skip unknown
    i++
  }
  tokens.push({ type: TT.Eof, value: '', pos: i })
  return tokens
}

// ── AST ──

interface ASTNode {
  type: 'call'
  name: string
  args: Record<string, any>
  children: ASTNode[]
}

// ── Parser ──

class Parser {
  tokens: Token[]
  pos = 0

  constructor(tokens: Token[]) { this.tokens = tokens }

  peek(): Token { return this.tokens[this.pos] }
  advance(): Token { return this.tokens[this.pos++] }
  expect(t: TT): Token {
    const tok = this.advance()
    if (tok.type !== t) throw new Error(`Expected ${TT[t]} but got ${TT[tok.type]} "${tok.value}" at pos ${tok.pos}`)
    return tok
  }
  match(t: TT): boolean {
    if (this.peek().type === t) { this.advance(); return true }
    return false
  }

  parseProgram(): ASTNode[] {
    const nodes: ASTNode[] = []
    while (this.peek().type !== TT.Eof) {
      const node = this.parseStatement()
      if (node) nodes.push(node)
    }
    return nodes
  }

  parseStatement(): ASTNode | null {
    if (this.peek().type === TT.Semi) { this.advance(); return null }
    // skip modifier prefixes like # % * !
    while (this.peek().type === TT.Hash || this.peek().type === TT.Percent ||
           this.peek().type === TT.Star || this.peek().type === TT.Not) {
      this.advance()
    }
    if (this.peek().type === TT.Ident) {
      return this.parseCall()
    }
    // skip unknown tokens
    this.advance()
    return null
  }

  parseCall(): ASTNode {
    const name = this.expect(TT.Ident).value
    const args: Record<string, any> = {}

    if (this.match(TT.LParen)) {
      this.parseArgs(args)
      this.expect(TT.RParen)
    }

    const children: ASTNode[] = []
    if (this.peek().type === TT.LBrace) {
      this.advance()
      while (this.peek().type !== TT.RBrace && this.peek().type !== TT.Eof) {
        const child = this.parseStatement()
        if (child) children.push(child)
      }
      this.match(TT.RBrace)
    } else if (this.peek().type !== TT.Semi && this.peek().type !== TT.Eof) {
      // single child (e.g. translate([0,0,0]) cube(...);)
      const child = this.parseStatement()
      if (child) children.push(child)
    } else {
      this.match(TT.Semi)
    }

    return { type: 'call', name, args, children }
  }

  parseArgs(args: Record<string, any>) {
    let positional = 0
    while (this.peek().type !== TT.RParen && this.peek().type !== TT.Eof) {
      // check for named argument: ident = value
      if (this.peek().type === TT.Ident && this.tokens[this.pos + 1]?.type === TT.Eq &&
          this.tokens[this.pos + 1]?.value !== '=') {
        // This check isn't quite right for ==, let me fix:
        if (this.tokens[this.pos + 1]?.type === TT.Eq) {
          const key = this.advance().value
          this.advance() // skip =
          args[key] = this.parseValue()
        } else {
          args[`_${positional++}`] = this.parseValue()
        }
      } else {
        args[`_${positional++}`] = this.parseValue()
      }
      this.match(TT.Comma)
    }
  }

  parseValue(): any {
    const tok = this.peek()
    // unary minus
    if (tok.type === TT.Minus) {
      this.advance()
      const v = this.parseValue()
      return typeof v === 'number' ? -v : v
    }
    if (tok.type === TT.Num) {
      this.advance()
      return parseFloat(tok.value)
    }
    if (tok.type === TT.Ident) {
      const val = tok.value
      if (val === 'true') { this.advance(); return true }
      if (val === 'false') { this.advance(); return false }
      if (val === 'undef') { this.advance(); return undefined }
      this.advance()
      // could be a function call like sin(x), just return identifier for now
      return val
    }
    if (tok.type === TT.LBracket) {
      return this.parseVector()
    }
    // skip unrecognized
    this.advance()
    return 0
  }

  parseVector(): number[] {
    this.expect(TT.LBracket)
    const values: number[] = []
    while (this.peek().type !== TT.RBracket && this.peek().type !== TT.Eof) {
      const v = this.parseValue()
      if (typeof v === 'number') values.push(v)
      else values.push(0)
      this.match(TT.Comma)
    }
    this.expect(TT.RBracket)
    return values
  }
}

// ── Mesh Data ──

export interface MeshData {
  vertices: Float32Array  // interleaved: position(3) + normal(3) per vertex
  indices: Uint32Array
  color: [number, number, number, number]
  transform: Mat4
}

// ── Mesh Generators ──

function makeCube(sx: number, sy: number, sz: number, center: boolean): { verts: number[], idx: number[] } {
  const x0 = center ? -sx / 2 : 0, x1 = center ? sx / 2 : sx
  const y0 = center ? -sy / 2 : 0, y1 = center ? sy / 2 : sy
  const z0 = center ? -sz / 2 : 0, z1 = center ? sz / 2 : sz

  const faces: [Vec3, Vec3, Vec3, Vec3, Vec3][] = [
    [[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1],[0,0,1]],   // front
    [[x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0],[0,0,-1]],   // back
    [[x0,y1,z0],[x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[0,1,0]],    // top
    [[x0,y0,z1],[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[0,-1,0]],   // bottom
    [[x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],[1,0,0]],    // right
    [[x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0],[-1,0,0]],   // left
  ]
  const verts: number[] = []
  const idx: number[] = []
  let vi = 0
  for (const [a, b, c, d, n] of faces) {
    verts.push(a[0],a[1],a[2], n[0],n[1],n[2])
    verts.push(b[0],b[1],b[2], n[0],n[1],n[2])
    verts.push(c[0],c[1],c[2], n[0],n[1],n[2])
    verts.push(d[0],d[1],d[2], n[0],n[1],n[2])
    idx.push(vi, vi+1, vi+2, vi, vi+2, vi+3)
    vi += 4
  }
  return { verts, idx }
}

function makeSphere(radius: number, segments: number): { verts: number[], idx: number[] } {
  const verts: number[] = []
  const idx: number[] = []
  const rings = segments
  const sectors = segments

  for (let r = 0; r <= rings; r++) {
    const phi = Math.PI * r / rings
    const sp = Math.sin(phi), cp = Math.cos(phi)
    for (let s = 0; s <= sectors; s++) {
      const theta = 2 * Math.PI * s / sectors
      const st = Math.sin(theta), ct = Math.cos(theta)
      const nx = sp * ct, ny = cp, nz = sp * st
      verts.push(radius * nx, radius * ny, radius * nz, nx, ny, nz)
    }
  }
  for (let r = 0; r < rings; r++) {
    for (let s = 0; s < sectors; s++) {
      const a = r * (sectors + 1) + s
      const b = a + sectors + 1
      idx.push(a, b, a + 1)
      idx.push(a + 1, b, b + 1)
    }
  }
  return { verts, idx }
}

function makeCylinder(h: number, r1: number, r2: number, center: boolean, fn: number): { verts: number[], idx: number[] } {
  const verts: number[] = []
  const idx: number[] = []
  const z0 = center ? -h / 2 : 0
  const z1 = center ? h / 2 : h
  const seg = fn

  // side
  const slopeLen = Math.sqrt(h * h + (r1 - r2) * (r1 - r2))
  const nzSlope = (r1 - r2) / slopeLen
  const nrSlope = h / slopeLen

  for (let i = 0; i <= seg; i++) {
    const a = (2 * Math.PI * i) / seg
    const ca = Math.cos(a), sa = Math.sin(a)
    const nx = ca * nrSlope, ny = sa * nrSlope, nz = nzSlope
    verts.push(r1 * ca, r1 * sa, z0, nx, ny, nz)
    verts.push(r2 * ca, r2 * sa, z1, nx, ny, nz)
  }
  for (let i = 0; i < seg; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3
    idx.push(a, b, c)
    idx.push(c, b, d)
  }

  // bottom cap
  const bi = verts.length / 6
  verts.push(0, 0, z0, 0, 0, -1)
  for (let i = 0; i <= seg; i++) {
    const a = (2 * Math.PI * i) / seg
    verts.push(r1 * Math.cos(a), r1 * Math.sin(a), z0, 0, 0, -1)
  }
  for (let i = 0; i < seg; i++) {
    idx.push(bi, bi + i + 2, bi + i + 1)
  }

  // top cap
  const ti = verts.length / 6
  verts.push(0, 0, z1, 0, 0, 1)
  for (let i = 0; i <= seg; i++) {
    const a = (2 * Math.PI * i) / seg
    verts.push(r2 * Math.cos(a), r2 * Math.sin(a), z1, 0, 0, 1)
  }
  for (let i = 0; i < seg; i++) {
    idx.push(ti, ti + i + 1, ti + i + 2)
  }

  return { verts, idx }
}

// ── Evaluator ──

const DEFAULT_COLORS: [number, number, number, number][] = [
  [0.26, 0.52, 0.96, 1],
  [0.96, 0.52, 0.26, 1],
  [0.26, 0.86, 0.56, 1],
  [0.86, 0.26, 0.66, 1],
  [0.96, 0.86, 0.26, 1],
  [0.46, 0.76, 0.86, 1],
  [0.76, 0.56, 0.96, 1],
  [0.56, 0.86, 0.36, 1],
]

let colorIdx = 0

function nextColor(): [number, number, number, number] {
  return DEFAULT_COLORS[(colorIdx++) % DEFAULT_COLORS.length]
}

function evalNodes(nodes: ASTNode[], transform: Mat4, color: [number, number, number, number] | null): MeshData[] {
  const meshes: MeshData[] = []

  for (const node of nodes) {
    const m = evalNode(node, transform, color)
    meshes.push(...m)
  }
  return meshes
}

function getArg(args: Record<string, any>, name: string, positional: number, def: any): any {
  if (args[name] !== undefined) return args[name]
  if (args[`_${positional}`] !== undefined) return args[`_${positional}`]
  return def
}

function evalNode(node: ASTNode, transform: Mat4, color: [number, number, number, number] | null): MeshData[] {
  const { name, args, children } = node

  switch (name) {
    case 'cube': {
      const size = getArg(args, 'size', 0, 1)
      const center = getArg(args, 'center', 1, false)
      let sx: number, sy: number, sz: number
      if (Array.isArray(size)) { sx = size[0] ?? 1; sy = size[1] ?? 1; sz = size[2] ?? 1 }
      else { sx = sy = sz = typeof size === 'number' ? size : 1 }
      const { verts, idx } = makeCube(sx, sy, sz, center === true)
      return [{ vertices: new Float32Array(verts), indices: new Uint32Array(idx), color: color ?? nextColor(), transform }]
    }

    case 'sphere': {
      const r = getArg(args, 'r', 0, undefined) ?? getArg(args, 'd', -1, undefined) != null ? (getArg(args, 'd', -1, 2) / 2) : 1
      const radius = getArg(args, 'r', 0, r)
      const fn = getArg(args, '$fn', -1, 24)
      const { verts, idx } = makeSphere(typeof radius === 'number' ? radius : 1, Math.max(8, fn))
      return [{ vertices: new Float32Array(verts), indices: new Uint32Array(idx), color: color ?? nextColor(), transform }]
    }

    case 'cylinder': {
      const h = getArg(args, 'h', 0, 1)
      let r1 = getArg(args, 'r1', -1, undefined)
      let r2 = getArg(args, 'r2', -1, undefined)
      const r = getArg(args, 'r', 1, undefined)
      const d = getArg(args, 'd', -1, undefined)
      const d1 = getArg(args, 'd1', -1, undefined)
      const d2 = getArg(args, 'd2', -1, undefined)
      if (d1 != null) r1 = d1 / 2
      if (d2 != null) r2 = d2 / 2
      if (r1 == null && r2 == null) {
        const baseR = d != null ? d / 2 : (r != null ? r : 1)
        r1 = baseR; r2 = baseR
      }
      if (r1 == null) r1 = r2
      if (r2 == null) r2 = r1
      const center = getArg(args, 'center', -1, false)
      const fn = getArg(args, '$fn', -1, 24)
      const { verts, idx } = makeCylinder(h, r1, r2, center === true, Math.max(8, fn))
      return [{ vertices: new Float32Array(verts), indices: new Uint32Array(idx), color: color ?? nextColor(), transform }]
    }

    case 'translate': {
      const v = getArg(args, 'v', 0, [0, 0, 0])
      const vec: Vec3 = Array.isArray(v) ? [v[0] ?? 0, v[1] ?? 0, v[2] ?? 0] : [0, 0, 0]
      const newT = translate(transform, vec)
      return evalNodes(children, newT, color)
    }

    case 'rotate': {
      const a = getArg(args, 'a', 0, 0)
      const v = getArg(args, 'v', 1, undefined)
      let newT = transform
      if (Array.isArray(a)) {
        // rotate([x,y,z]) - Euler angles in degrees
        const rx = (a[0] ?? 0) * Math.PI / 180
        const ry = (a[1] ?? 0) * Math.PI / 180
        const rz = (a[2] ?? 0) * Math.PI / 180
        if (rz) newT = rotateZ(newT, rz)
        if (ry) newT = rotateY(newT, ry)
        if (rx) newT = rotateX(newT, rx)
      } else if (typeof a === 'number' && Array.isArray(v)) {
        // rotate(a, v=[x,y,z]) - angle around axis
        const angle = a * Math.PI / 180
        const ax: Vec3 = [v[0] ?? 0, v[1] ?? 0, v[2] ?? 1]
        // Rodrigues' rotation - approximate with euler for simplicity
        // For exact: use axis-angle to matrix
        newT = axisAngleRotate(newT, ax, angle)
      } else if (typeof a === 'number') {
        newT = rotateZ(newT, a * Math.PI / 180)
      }
      return evalNodes(children, newT, color)
    }

    case 'scale': {
      const v = getArg(args, 'v', 0, [1, 1, 1])
      const vec: Vec3 = Array.isArray(v) ? [v[0] ?? 1, v[1] ?? 1, v[2] ?? 1] : [v, v, v]
      const newT = scale(transform, vec)
      return evalNodes(children, newT, color)
    }

    case 'mirror': {
      // Simplified mirror - just negate the appropriate axis in scale
      const v = getArg(args, 'v', 0, [1, 0, 0])
      if (Array.isArray(v)) {
        const sx = v[0] ? -1 : 1, sy = v[1] ? -1 : 1, sz = v[2] ? -1 : 1
        const newT = scale(transform, [sx, sy, sz])
        return evalNodes(children, newT, color)
      }
      return evalNodes(children, transform, color)
    }

    case 'color': {
      const c = getArg(args, 'c', 0, undefined) ?? getArg(args, '_0', 0, [0.5, 0.5, 0.5])
      let newColor: [number, number, number, number]
      if (Array.isArray(c)) {
        newColor = [c[0] ?? 0.5, c[1] ?? 0.5, c[2] ?? 0.5, c[3] ?? 1]
      } else if (typeof c === 'string') {
        newColor = cssColorToRgba(c)
      } else {
        newColor = [0.5, 0.5, 0.5, 1]
      }
      return evalNodes(children, transform, newColor)
    }

    case 'union':
      return evalNodes(children, transform, color)

    case 'difference': {
      // Render first child normally, remaining children in translucent red
      const meshes: MeshData[] = []
      if (children.length > 0) {
        meshes.push(...evalNode(children[0], transform, color))
      }
      for (let i = 1; i < children.length; i++) {
        meshes.push(...evalNode(children[i], transform, [0.9, 0.2, 0.2, 0.4]))
      }
      return meshes
    }

    case 'intersection': {
      // Render all children with transparency
      const meshes: MeshData[] = []
      for (const child of children) {
        meshes.push(...evalNode(child, transform, color ? [color[0], color[1], color[2], 0.6] : null))
      }
      return meshes
    }

    case 'hull':
    case 'minkowski':
    case 'linear_extrude':
    case 'rotate_extrude':
      // Unsupported complex ops - just render children
      return evalNodes(children, transform, color)

    case 'multmatrix': {
      const m = getArg(args, 'm', 0, undefined)
      if (Array.isArray(m) && m.length >= 4) {
        const mat = new Float32Array(16)
        for (let r = 0; r < 4; r++)
          for (let c = 0; c < 4; c++)
            mat[r * 4 + c] = m[r]?.[c] ?? (r === c ? 1 : 0)
        return evalNodes(children, multiply(mat, transform), color)
      }
      return evalNodes(children, transform, color)
    }

    default:
      // Unknown module - try to evaluate children
      return evalNodes(children, transform, color)
  }
}

function axisAngleRotate(m: Mat4, axis: Vec3, angle: number): Mat4 {
  const len = Math.sqrt(axis[0] ** 2 + axis[1] ** 2 + axis[2] ** 2)
  if (len < 1e-10) return m
  const x = axis[0] / len, y = axis[1] / len, z = axis[2] / len
  const c = Math.cos(angle), s = Math.sin(angle), t = 1 - c
  const r = identity()
  r[0] = t*x*x + c;   r[1] = t*x*y - s*z; r[2] = t*x*z + s*y
  r[4] = t*x*y + s*z;  r[5] = t*y*y + c;   r[6] = t*y*z - s*x
  r[8] = t*x*z - s*y;  r[9] = t*y*z + s*x; r[10] = t*z*z + c
  return multiply(r, m)
}

function cssColorToRgba(name: string): [number, number, number, number] {
  const colors: Record<string, [number, number, number, number]> = {
    red: [1, 0, 0, 1], green: [0, 0.5, 0, 1], blue: [0, 0, 1, 1],
    yellow: [1, 1, 0, 1], cyan: [0, 1, 1, 1], magenta: [1, 0, 1, 1],
    white: [1, 1, 1, 1], black: [0, 0, 0, 1], orange: [1, 0.65, 0, 1],
    gray: [0.5, 0.5, 0.5, 1], grey: [0.5, 0.5, 0.5, 1],
    pink: [1, 0.75, 0.8, 1], purple: [0.5, 0, 0.5, 1],
    brown: [0.65, 0.16, 0.16, 1],
  }
  return colors[name.toLowerCase()] ?? [0.5, 0.5, 0.5, 1]
}

// ── Public API ──

export function parseOpenSCAD(source: string): MeshData[] {
  colorIdx = 0
  const tokens = tokenize(source)
  const parser = new Parser(tokens)
  const ast = parser.parseProgram()
  return evalNodes(ast, identity(), null)
}
