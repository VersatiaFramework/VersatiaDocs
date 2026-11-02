---
slug: /
sidebar_label: About experimental
title: Experimental documentation
description: What experimental means in Versatia, what this part of the site covers and how to give feedback.
---

import ExperimentalContents from '@site/src/components/ExperimentalContents';

This part of the site documents features of Versatia that are **experimental**: they are built,
tested and usable, but their design is still open. They live here, apart from the
[stable documentation](/docs), so that nothing in the stable pages depends on them. While anything
is experimental, a Stable / Experimental switch in the navigation bar moves between the two. These
pages are for the plugin developer; the server admin's part of an experimental module is in the
[server admin guide](/admin), under Experimental modules.

## What experimental means {/* #what-experimental-means */}

| An experimental feature                                   | A stable feature                                  |
|-----------------------------------------------------------|---------------------------------------------------|
| may change, be renamed or disappear in any release, without notice and without a deprecation period | changes only as the versioning rules of the project allow |
| is described only here; the stable pages, their examples and Best practices never rely on it | is part of the stable documentation |
| may still have rough edges in its messages, defaults and configuration files | has settled names, defaults and messages |

What an experimental feature writes on a server (its files, its tables, its configuration) may need
to be migrated by hand, or recreated, when the feature changes. Use it where you can afford that:
a test server, a new plugin, a plugin whose data you can rebuild.

## What is here {/* #what-is-here */}

<ExperimentalContents />

## Feedback {/* #feedback */}

Experimental features are where feedback changes the most. If something is hard to use, a message
is unclear or a default is wrong for your server, open an issue in the
[VersatiaDocs repository](https://github.com/VersatiaFramework/VersatiaDocs/issues) and say which
page and which feature it is about.
