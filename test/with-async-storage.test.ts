import test from "ava"
import * as td from "testdouble"
import { types } from "mobx-state-tree"

// --- setup mocking ----------------------------------------------------------

const reactNative = {
  AsyncStorage: {
    getItem: td.func(),
    setItem: td.func(),
  },
}
td.replace("react-native", reactNative)

// recreate before each run
test.beforeEach(t => {
  reactNative.AsyncStorage.getItem = td.func()
  reactNative.AsyncStorage.setItem = td.func()
})

// --- after mocking ----------------------------------------------------------

import { withAsyncStorage } from "../src/mst-async-storage"

// --- fixtures ---------------------------------------------------------------

export const SampleModel = types
  .model({
    name: "",
    age: 0,
  })
  .actions(self => ({
    setName(value: string) {
      self.name = value
    },
    setAge(value: number) {
      self.age = value
    },
  }))

const DefaultModel = SampleModel.extend(withAsyncStorage()).named("DefaultModel")
const KeyedModel = SampleModel.extend(withAsyncStorage({ key: "Jimmy" }))
const NoAutoSaveModel = SampleModel.extend(withAsyncStorage({ autoSave: false }))

// --- tests ------------------------------------------------------------------

test("loads only when asked", t => {
  DefaultModel.create()
  t.is(td.explain(reactNative.AsyncStorage.getItem).callCount, 0)
})

test("AsyncStorage loading", async t => {
  await DefaultModel.create().load()
  t.is(td.explain(reactNative.AsyncStorage.getItem).callCount, 1)
})

test("custom key name", async t => {
  await KeyedModel.create().load()
  t.is(td.explain(reactNative.AsyncStorage.getItem).calls[0].args[0], "Jimmy")
})

test("default key name", async t => {
  await DefaultModel.create().load()
  t.is(td.explain(reactNative.AsyncStorage.getItem).calls[0].args[0], "DefaultModel")
})

test("won't autosave until loaded", async t => {
  const model = DefaultModel.create()
  model.setAge(69)
  t.is(td.explain(reactNative.AsyncStorage.setItem).callCount, 0)
})

test("autosaves after 1st load", async t => {
  const model = DefaultModel.create()
  await model.load()
  model.setAge(69)
  t.is(td.explain(reactNative.AsyncStorage.setItem).callCount, 1)
})

test("autosave off", async t => {
  const model = NoAutoSaveModel.create()
  await model.load()
  model.setAge(69)
  t.is(td.explain(reactNative.AsyncStorage.setItem).callCount, 0)
})

test("saves proper data", async t => {
  const model = DefaultModel.create()
  await model.load()
  model.setAge(69)
  model.setName("jimmy")
  const ex = td.explain(reactNative.AsyncStorage.setItem)
  const [key, value] = ex.calls[1].args
  t.is(key, "DefaultModel")
  t.deepEqual(JSON.parse(value), { age: 69, name: "jimmy" })
})

test("save can be called manually", async t => {
  const model = DefaultModel.create({ age: 1, name: "kid" })
  await model.save()
  const ex = td.explain(reactNative.AsyncStorage.setItem)
  t.deepEqual(JSON.parse(ex.calls[0].args[1]), { age: 1, name: "kid" })
})

test("only", async t => {
  const Model = SampleModel.extend(withAsyncStorage({ autoSave: false, only: ["age"] }))
  const model = Model.create({ age: 1, name: "kid" })
  await model.save()
  const ex = td.explain(reactNative.AsyncStorage.setItem)
  t.deepEqual(JSON.parse(ex.calls[0].args[1]), { age: 1 })
})

test("only with bad key names", async t => {
  const Model = SampleModel.extend(withAsyncStorage({ autoSave: false, only: ["lol"] }))
  const model = Model.create({ age: 1, name: "kid" })
  await model.save()
  const ex = td.explain(reactNative.AsyncStorage.setItem)
  t.deepEqual(JSON.parse(ex.calls[0].args[1]), {})
})

test("except", async t => {
  const Model = SampleModel.extend(withAsyncStorage({ autoSave: false, except: ["name"] }))
  const model = Model.create({ age: 1, name: "kid" })
  await model.save()
  const ex = td.explain(reactNative.AsyncStorage.setItem)
  t.deepEqual(JSON.parse(ex.calls[0].args[1]), { age: 1 })
})
