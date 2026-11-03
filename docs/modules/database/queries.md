# Named queries

Longer queries live in `database/queries/*.sql`, each under a `-- name:` line, and run by name with
`named(name, ...parameters)`, which returns a [statement](statements.md#running-sql) like `sql`:

```sql title="src/main/resources/database/queries/profiles.sql"
-- Queries of the profiles table.

-- name: top-coins
SELECT name, coins FROM {prefix}profiles ORDER BY coins DESC LIMIT :limit

-- name: rank-of
SELECT COUNT(*) + 1 FROM {prefix}profiles
WHERE coins > (SELECT coins FROM {prefix}profiles WHERE uuid = :uuid);
```

```kotlin
val top = database.named("top-coins", "limit" to 10).list<TopEntry>()
```

## The file format {/* #query-file-format */}

`-- name: <name>` is this module's own convention, and it is an ordinary SQL line comment: a query
file stays plain SQL, which an editor highlights and a database tool opens like any script.

- **The marker** is a line of its own: `--`, `name`, `:` and the name, with optional spaces or tabs
  around each part (`--name:top-coins` works too); `name` is written in lower case. Every other
  comment is only a comment.
- **A query** runs from the line after its marker to the next marker or the end of the file.
  Leading whitespace is dropped, and so are a trailing `;`, trailing comments and trailing
  whitespace; comments inside the query stay in its text, where they do no harm.
- **Before the first marker** only comments and blank lines may stand, such as a header comment.
- **One statement per query**: a block holding two statements, or none, is a problem.
- **Markers are found by the SQL reader**, so a line `-- name: x` inside a block comment or a
  multi-line string is part of the query around it, not a marker.

## Files and names {/* #query-files-and-names */}

- Query files live in `src/main/resources/database/queries/`, under any `.sql` name, as many as you
  like; the file a query sits in only organises them. Like migrations they are code: they ship in
  the JAR, are never copied to the data folder and are not read again at a reload.
- Names are **kebab-case**: words of lower-case letters and digits joined by single `-`, such as
  `top-coins`, `rank-of` or `stats-v2`.
- Names are **unique across all query files** of the plugin; `named` takes only the name.
- A query takes [parameters](statements.md#parameters) and [tokens](tokens.md#how-tokens-expand)
  like inline SQL, bound at the call: `named("rank-of", "uuid" to uuid)`, or `.bind(...)` and
  `.bindProperties(...)` on the statement it returns.

## Engine overrides of queries {/* #query-overrides */}

A file in an [engine directory](engine-overrides.md#engine-directories) of `queries/` replaces, on that engine, the
queries it defines, **one by one, by name**: its file name does not matter, and the queries it does
not define keep their generic text. Each name it defines must be defined by a generic file too.

```sql title="src/main/resources/database/queries/postgresql/ranks.sql"
-- name: rank-of
SELECT rank FROM (
    SELECT uuid, RANK() OVER (ORDER BY coins DESC) AS rank FROM {prefix}profiles
) ranked WHERE uuid = :uuid
```

## Checked at start {/* #queries-checked-at-start */}

Every query of every file, the engine directories included, is parsed when the plugin starts and
before its database opens, so a mistake fails the start, not the first call:

| Mistake                                   | Message (after `Plugin Shop: database/queries/profiles.sql:<line>: `) |
|-------------------------------------------|-----------------------------------------------------------|
| SQL before the first marker               | `SQL before the first "-- name:" marker; start each query with -- name: <kebab-name>` |
| a name that is not kebab-case             | `query name "top_coins" is not kebab-case; use lowercase letters, digits and -, such as top-coins` |
| a name used twice                         | `query "top-coins" is already defined at database/queries/ranks.sql:1; names are unique across all query files` |
| a block with no SQL                       | `query "top-coins" is empty`                              |
| a block with two statements               | `query "top-coins" holds more than one statement; give each its own -- name: block` |
| an unknown token                          | `unknown placeholder {uid} in "..."; known: {prefix}, ...` |
| `?` and `:names` mixed                    | `"..." mixes positional ? and named :parameters; use only :names` |

## An unknown name {/* #unknown-query-name */}

`named` with a name the JAR does not define throws an `UnknownQueryException` at the call, so a
typo passes the build and fails only when that line runs; a constant holding the name
(`const val TOP_COINS = "top-coins"`) makes it a compile error instead:

| Situation                                           | Message                                               |
|-----------------------------------------------------|-------------------------------------------------------|
| close names exist (at most two edits away, or one name starts with the other) | `Plugin Shop: database/queries defines no query "top-coin"; close names: top-coins` |
| none is close                                       | `Plugin Shop: database/queries defines no query "richest"; its queries: rank-of, top-coins` (the first ten, then `…`) |
| the JAR has no named queries                        | `Plugin Shop: database/queries defines no query "richest"; the JAR has no named queries; add a database/queries/<file>.sql with -- name: richest blocks` |

## Corner cases {/* #corner-cases */}

- **A query override replaces queries by name, not files by name**: `postgresql/ranks.sql` may
  redefine a query of `profiles.sql`; the queries it leaves out keep their generic text.
- **A `-- name:` line inside a block comment or a multi-line string is not a marker**: markers are
  found by the same SQL reader that expands tokens, so only a line comment standing alone on its
  line starts a query.
