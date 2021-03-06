'use strict'

class Vertex {
  constructor(v) {
    this.v = new THREE.Vector3().set(v.x, v.y, v.z)
    this.quadric = new THREE.Matrix4()
  }
}

class Face {
  constructor(v1, v2, v3) {
    this.v1 = v1
    this.v2 = v2
    this.v3 = v3

    this.removed = false
  }
}

class Pair {
  constructor(A, B) {
    // TODO fix
    if (B.less(A)) {
      A, B = B, A
    }
    this.A = A
    this.B = B
    this.index = 0
    this.removed  = false
    this.cachedError = 9001

    this.quadric = this.quadric.bind(this)
  }

  vector() {
    // magic to give nicest vector given two vertices
  }

  quadric() {
    return this.A.Quadric.Add(this.B.Quadric)
  }
}

class PriorityQueue {
  constructor() {
    // TODO make, or find package
  }
}


export const simplify = ({mesh, factor=1, threshold=0}) => {
  console.log(mesh)
  console.log(factor)

  const triangles = mesh.geometry.faces

  // Map of distinct vertices
  // TODO ensure distinct
  // TODO better name
  const vectorToVertex = []

  const computeTriangleQuadric = (triangle) => {
    // const { a, b, c } = triangle
    const v1 = vectorToVertex[triangle.a]
    const v2 = vectorToVertex[triangle.b]
    const v3 = vectorToVertex[triangle.c]
    console.log(v1.v, v2.v, v3.v)

    const e1 = new THREE.Vector3().subVectors(v2.v, v1.v)
    const e2 = new THREE.Vector3().subVectors(v3.v, v1.v)
    console.log(e1, e2)

    const n = new THREE.Vector3().crossVectors(e1, e2).normalize()

    const { x, y, z } = v1.v
    // const { x as a, y as b, z as c } = n
    const a = n.x
    const b = n.y
    const c = n.z
    const d = -a*x -b*y -c*z

    const mat = new THREE.Matrix4().set(
      a * a, a * b, a * c, a * d,
  		a * b, b * b, b * c, b * d,
  		a * c, b * c, c * c, c * d,
  		a * d, b * d, c * d, d * d
    )

    return mat

    // e1 := t.V2.Sub(t.V1)
  	// e2 := t.V3.Sub(t.V1)
  	// n := e1.Cross(e2).Normalize()
  	// x, y, z := t.V1.X, t.V1.Y, t.V1.Z
  	// a, b, c := n.X, n.Y, n.Z
  	// d := -a*x - b*y - c*z
  	// return Matrix{
  	// 	a * a, a * b, a * c, a * d,
  	// 	a * b, b * b, b * c, b * d,
  	// 	a * c, b * c, c * c, c * d,
  	// 	a * d, b * d, c * d, d * d,
  	// }
  }


  for (let i=0; i < triangles.length; i++) {
    // a, b, c are vertex indices
    const { a, b, c } = triangles[i]
    vectorToVertex[a] = new Vertex(mesh.geometry.vertices[a])
    vectorToVertex[b] = new Vertex(mesh.geometry.vertices[b])
    vectorToVertex[c] = new Vertex(mesh.geometry.vertices[c])
  }

  // ===========================================================================
  // 1. Compute Q for all initial vertices
  // ===========================================================================
  for (let i=0; i < triangles.length; i++) {
    const triangle = triangles[i]
    const q = computeTriangleQuadric(triangle)
    console.log(q)

    const { a, b, c } = triangle
    const v1 = vectorToVertex[a]
    const v2 = vectorToVertex[b]
    const v3 = vectorToVertex[c]

    // assumes add mutates it
    v1.quadric = addMatrix4(v1.quadric, q)
    v2.quadric = addMatrix4(v2.quadric, q)
    v3.quadric = addMatrix4(v3.quadric, q)
  }

  const vertexToFaces = {}
  for (let i=0; i < triangles.length; i++) {
    const { a, b, c } = triangles[i]
    const v1 = vectorToVertex[a]
    const v2 = vectorToVertex[b]
    const v3 = vectorToVertex[c]

    const face = new Face(v1, v2, v3)

    // TODO fix
    vertexToFaces[v1] = [...vertexToFaces[v1]].push(face)
    vertexToFaces[v2] = [...vertexToFaces[v2]].push(face)
    vertexToFaces[v3] = [...vertexToFaces[v3]].push(face)
  }

  // ===========================================================================
  // 2. Select all valid pairs (edge or distance < threshold)
  // ===========================================================================
  // TODO threshold
  const pairs = {}
  for (let i=0; i < triangles.length; i++) {
    const { a, b, c } = triangles[i]
    const v1 = vectorToVertex[a]
    const v2 = vectorToVertex[b]
    const v3 = vectorToVertex[c]

    pairs[{v1, v2}] = new Pair(v1, v2)
    pairs[{v2, v3}] = new Pair(v2, v3)
    pairs[{v3, v1}] = new Pair(v3, v1)
  }

  // where?
  // ===========================================================================
  // 3. Compute q for each (v1, v2) pair. Cost = q^T(Q1+Q2)q
  // ===========================================================================

  // ===========================================================================
  // 4. Heap keyed on cost with min. at top
  // ===========================================================================
  const queue = new PriorityQueue()
  const vertexToPairs = {}
  for (let i=0; i < pairs.length; i++) {
    queue.push(p)

    // TODO make append, or otherwise
    vertexToPairs[p.A] = append(vertexToPairs[p.A], p)
    vertexToPairs[p.B] = append(vertexToPairs[p.B], p)
  }

  // ===========================================================================
  // 5. Iteratively remove (v1, v2) of least cost, contract, update costs of
  // everything with v1
  // ===========================================================================
  let numFaces = triangles.length
  let target = numFaces * factor
  while (numFaces > target) {
    const p = queue.pop()

    if (p.removed) continue
    p.removed = true

    const distinctFaces = {}
    for (let i=0; i < vertexToFaces[p.A].length; i++) {
      const face = vertexToFaces[p.A][i]
      if (!face.removed) {
        distinctFaces[face] = true
      }
    }
    for (let i=0; i < vertexToFaces[p.B].length; i++) {
      const face = vertexToFaces[p.B][i]
      if (!face.removed) {
        distinctFaces[face] = true
      }
    }

    const distinctPairs = {}
    ['A', 'B'].forEach(it => {
      for (let i=0; i < vertexToPairs[p[it]].length; i++) {
        const q = vertexToPairs[p[it]][i]

        if (!q.removed) {
          distinctPairs[q] = true
        }
      }
    })

    const v = new Vertex(p.vector(), p.quadric())

    ['A', 'B'].forEach(it => delete(vertexToFaces, p[it]))
    for (let i=0; i < distinctFaces.length; i++) {
      const face = distinctFaces[i]
      face.removed = true
      numFaces--

      let { v1, v2, v3 } = face
      if (v1 === p.A || v1 === p.B) v1 = v
			if (v2 === p.A || v2 === p.B) v2 = v
			if (v3 === p.A || v3 === p.B) v3 = v

      const f  = new Face(v1, v2, v3)

      if (!f.Degenerate()) {
				numFaces++
				vertexToFaces[v1] = append(vertexFaces[v1], f)
				vertexToFaces[v2] = append(vertexFaces[v2], f)
				vertexToFaces[v3] = append(vertexFaces[v3], f)
			}
    }

    ['A', 'B'].forEach(it => delete(vertexToPairs, p[it]))
    const seen = {}
    for (let i=0; i < distinctPairs.length; i++) {
      const q = distinctPairs[i]
      q.removed = true
      queue.pop(q.index)

      let { a, b } = q
      if (a === p.A || a === p.B) a = v
			if (b === p.A || b === p.B) b = v
			if (b === v) a, b = b, a // swap so that a == v

      if (seen[b.vector]) continue

      seen[b.vector] = true

      const q2 = new Pair(a, b)
      queue.push(q2)
      vertexToPairs[a] = append(vertexToPairs[a], q)
      vertexToPairs[b] = append(vertexToPairs[b], q)
    }
  }

  // find disctinct faces
  const distinctFaces = {}
  for (let i=0; i < vertexToFaces.length; i++) {
    for (let j=0; j < vertexToFaces[i].length; j++) {
      const f = vertexToFaces[i][j]
      if (!f.removed) distinctFaces[f] = true
    }
  }

  // construct resulting mesh
  const newTriangles = []
  for (let i=0; i < distinctFaces.length; i++) {
    const { v1, v2, v3 } = distinctFaces[i]

    newTriangles[i] = new Triangle(v1, v2, v3)
  }

  return new Mesh(newTriangles)
}
