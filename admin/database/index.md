---
title: Database module
sidebar_label: Overview
counterpart: /docs/modules/database
---

# Database module

The Database module gives each plugin that uses it a database of its own. Out of the box that is
an SQLite file in the plugin's folder, and nothing has to be set up; you move it to H2, MySQL,
MariaDB or PostgreSQL by editing one file.

## Installing {/* #installing */}

Install `VersatiaModule-Database-0.0.1.jar` next to VersatiaCore when a plugin lists
`VersatiaModule-Database` under `depend:`. At its first start Paper downloads the module's
libraries (HikariCP and the H2, MariaDB and PostgreSQL drivers) into `libraries/`, which needs
access to Maven Central once; the SQLite and MySQL drivers come with Paper.

| Engine       | Data                                          | Oldest server |
|--------------|-----------------------------------------------|---------------|
| `sqlite`     | a file in the plugin's folder, `database.db`  | SQLite 3.35   |
| `h2`         | a file in the plugin's folder, `database.mv.db` | H2 2.1      |
| `mysql`      | a MySQL server, port 3306; reaches MariaDB too | MySQL 8.0.19 |
| `mariadb`    | a MariaDB server, port 3306                   | MariaDB 10.3  |
| `postgresql` | a PostgreSQL server, port 5432                | PostgreSQL 12 |

The module creates tables, never databases: on a database server, create the database (and on
PostgreSQL the schema) before the first start.

## The files {/* #the-files */}

| File                                              | What it sets                                     |
|---------------------------------------------------|--------------------------------------------------|
| `plugins/<Plugin>/database.yml`                   | where one plugin's data lives, its pool, timings and table prefix; written by the module at the first open ([database.yml](configuration.md#database-yml)) |
| `plugins/VersatiaModule-Database/connections.yml` | connections several plugins share, and the connection of plugins installed later ([connections.yml](configuration.md#connectionsyml)) |
| `plugins/VersatiaModule-Database/config.yml`      | `defaults:` for every plugin whose `database.yml` leaves a key out ([config.yml](configuration.md#configyml)) |

## Common tasks {/* #common-tasks */}

| You want to                                        | Read                                                     |
|----------------------------------------------------|----------------------------------------------------------|
| move a plugin from SQLite to MySQL, with its data  | [Changing the database](data.md#changing-the-database)   |
| put several plugins on one MySQL database          | [connections.yml](configuration.md#connectionsyml)       |
| keep the password out of the file                  | [Secrets in the file](configuration.md#secrets-in-the-file) |
| see what every database is doing                   | [Status](operations.md#status)                           |
| apply an edited file                               | [Reloading](operations.md#reloading)                     |
| find slow statements                               | [Logs](operations.md#logs)                               |
| understand a message in the log                    | [Troubleshooting](operations.md#troubleshooting)         |

At start every plugin logs one line saying where its data is:

```text
[Shop] SQLITE database.db, prefix shop_, schema V3
```
