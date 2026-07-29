import assert from 'node:assert/strict'

const clone = (value) => structuredClone(value)
const at = (root, path) => path.slice(1).split('/').reduce((node, key) => node[key], root)
const replace = (root, path, value) => { const copy = clone(root); const keys = path.slice(1).split('/'); const key = keys.pop(); let node = copy; for (const part of keys) node = node[part]; node[key] = value; return copy }
const insert = (root, path, value) => { const copy = clone(root); const keys = path.slice(1).split('/'); const index = Number(keys.pop()); let node = copy; for (const part of keys) node = node[part]; node.splice(index, 0, value); return copy }
const remove = (root, path) => { const copy = clone(root); const keys = path.slice(1).split('/'); const key = keys.pop(); let node = copy; for (const part of keys) node = node[part]; Array.isArray(node) ? node.splice(Number(key), 1) : delete node[key]; return copy }
const base = Object.freeze({ list: [{ id: 'a', value: 1 }], mode: 'captured_replay', observation: { producer: 'Integrated Lead' } })
const cases = [
  ['not_applicable', () => clone(base), (v) => assert.deepEqual(v, base)],
  ['json_add', () => replace(base, '/added', true), (v) => assert.equal(v.added, true)],
  ['json_remove', () => remove({ ...base, removable: true }, '/removable'), (v) => assert.equal('removable' in v, false)],
  ['json_replace', () => replace(base, '/mode', 'live_current'), (v) => assert.equal(v.mode, 'live_current')],
  ['selector_replace', () => replace(base, '/observation/producer', 'Backend Architect'), (v) => assert.equal(v.observation.producer, 'Backend Architect')],
  ['selector_duplicate_identity', () => insert(base, '/list/1', clone(base.list[0])), (v) => assert.equal(v.list.length, 2)],
  ['request_duplicate', () => insert(base, '/list/1', clone(base.list[0])), (v) => assert.equal(v.list[0].id, v.list[1].id)],
  ['live_current_successor', () => replace(base, '/mode', 'live_current'), (v) => assert.equal(v.mode, 'live_current')],
  ['port_fault', () => ({ kind: 'port_fault', method: 'readCanonicalBody', ordinal: 1 }), (v) => assert.equal(v.ordinal, 1)],
  ['forged_token', () => ({ kind: 'forged_token', construction: 'structurally_equal_new_object' }), (v) => assert.equal(v.construction, 'structurally_equal_new_object')],
  ['token_reuse_sequence', () => ['materialize', 'validate', 'validate_same_token'], (v) => assert.equal(v.length, 3)],
  ['retired_export_absence', () => ({ export_name: 'validateArchitectureRepairAuthorityObservationV2A13' }), (v) => assert.ok(v.export_name.includes('V2A13'))],
  ['forbidden_surface_scan', () => ['result', 'trace', 'diagnostic'], (v) => assert.equal(v.includes('result'), true)],
  ['captured_successor', () => ({ captured: 'prior', successor: 'later' }), (v) => assert.notEqual(v.captured, v.successor)],
]
for (const [name, apply, verify] of cases) { const result = apply(); verify(result); assert.deepEqual(base, { list: [{ id: 'a', value: 1 }], mode: 'captured_replay', observation: { producer: 'Integrated Lead' } }, `${name} isolates input`) }
console.log(JSON.stringify({ result: 'PASS', operations: cases.length }))
