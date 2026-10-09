# Collections

Package `com.github.marcoral.versatia.util.collection`.

## `*OrThrow` helpers

`MutableSet.addOrThrow`, `addAllOrThrow`, `MutableMap.putOrThrow`, `putAllOrThrow` and
`Map.getOrThrow` turn silent overwrites and missing keys into exceptions.

```kotlin
val registry = mutableMapOf<String, Handler>()
registry.putOrThrow("shop", ShopHandler())      // throws if "shop" is already registered
```

- `addAllOrThrow` and `putAllOrThrow` check the **whole input before touching the receiver**, so a
  failed call leaves the collection unchanged.
- They also report duplicates *inside* the input, not only clashes with what is already stored.
- A stored `null` value counts as present (`containsKey`, never `get(key) != null`).
- `Iterable<Map<K, V>>.mergeOrThrow` merges several maps and fails on the first key present in two
  of them; the `MapConflict(key, existingValue, newValue)` tells which.

## `DeepMergeMap`

A `MutableMap<K, Any?>` that merges other maps into itself recursively, useful for layering a
default configuration under a user one. For every key of the incoming map:

1. Key absent in the destination: the value is deep-copied in. Nested maps become nested
   `DeepMergeMap`s, nested collections become lists.
2. Both values are maps: they are merged recursively with the same rules.
3. Both values are collections: the result is their concatenation.
4. Anything else is a *conflict*, resolved by the `MergeConflictStrategy` given to the constructor:

| Strategy             | Result                                                                   |
|----------------------|--------------------------------------------------------------------------|
| `OVERRIDE` (default) | incoming value wins                                                      |
| `KEEP_EXISTING`      | existing value stays                                                     |
| `COMBINE_INTO_LIST`  | `[existing, incoming]`; a collection on either side is flattened into it |
| `THROW`              | `IllegalStateException` naming the dotted key path                       |

```kotlin
val merged = DeepMergeMap<String>(MergeConflictStrategy.KEEP_EXISTING)
merged += userConfig.getValues(true)
merged += defaults.getValues(true)        // fills the gaps, keeps the user's values
```

`null` is an ordinary value, not "absent". Incoming maps are never mutated. Use `merge(other)` or
`map += other` to mutate in place and `mergedWith(other)` to get a copy. There is deliberately no
`plus` operator: defining both `plus` and `plusAssign` makes `+=` on a `var` ambiguous in Kotlin.
