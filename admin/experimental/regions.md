---
title: VersatiaRegions
counterpart: /experimental/plugins/regions
description: Installing VersatiaRegions, naming layers and regions in regions.yml, painting their shapes in game, and the files, commands and messages that come with it.
---

# VersatiaRegions

VersatiaRegions gives your server regions of any shape, in layers: lands, then the places inside
them, then whatever you need. In a layer every column of the world lies in at most one region, and
a place inherits from the region of every layer it lies in, the innermost one winning: a cemetery
painted inside a land takes the land's values unless it sets its own. You name the regions in
`regions.yml`; builders paint their shapes in game. What a region's values do is up to the plugins
reading them, such as your server's own.

## Installing {/* #installing */}

Put `VersatiaRegions-0.0.1.jar` into `plugins/` next to VersatiaCore and start the server:

| Plugin | Dependency | Needed for |
|---|---|---|
| VersatiaCore | required | everything: VersatiaRegions runs on it |
| CommandAPI | optional | `/regions`, without which regions cannot be drawn; plugins still read the regions there are |

## Layers and regions {/* #layers-and-regions */}

`regions.yml` lists, per world, its layers in order, the outermost first, and in each layer its
regions with the values plugins read from them:

```yaml title="plugins/VersatiaRegions/regions.yml"
worlds:
  karhan:
    lands:
      vayron:
        respawn: vayron-square
      mildhen: {}
    places:
      vayron-cemetery:
        respawn: cemetery-gate
      hunting-grounds-10-15: {}
```

A player in the cemetery reads `respawn: cemetery-gate`, one anywhere else in Vayron
`vayron-square`. The hunting grounds may cross the border of Vayron and Mildhen: each of their
columns inherits from the land it lies in.

- **Ids** are lower-case letters, digits, `_` and `-`, and a region's is unique on the server.
- **A region without values** is written `{}`; `mildhen:` with nothing after it is lost when the
  file is read.
- **Every region needs a name** players read, in `plugins/VersatiaRegions/messages/regions.yml`
  under its id; a region without one fails the start or the reload, naming it:

```yaml title="plugins/VersatiaRegions/messages/regions.yml"
region:
  vayron: "Vayron"
  mildhen: "Mildhen"
  vayron-cemetery: "Cemetery of Vayron"
  hunting-grounds-10-15: "Hunting grounds (levels 10-15)"
```

`/versatia reload regions` applies a change of both files.

## Drawing a region {/* #drawing-a-region */}

`/regions draw <region>` puts the region brush into your hand (a blaze rod, `editor.tool` of
`config.yml`) and shows, within 48 blocks, the outline being drawn in green and the borders of the
regions of the same layer in light blue, glowing through the terrain. Nobody but builders sees
them. With the brush in your main hand:

| Input | Does |
|---|---|
| right click | adds the column clicked, with a line from the last one you added |
| Shift + right click | adds a column starting a new line |
| left click | removes the column clicked from the outline |
| Shift + left click | removes the lines through the column clicked |
| swap-hands key (F) | fills the shape you look at, turning it into the region |

A click into the air reaches the block you look at, up to 128 blocks away; holding the right button
draws as you sweep. The brush breaks and uses nothing, and any other item in your hand builds as
always. Everyone drawing a region draws the same outline, and sees the others' too.
`/regions stop` takes the brush away; `/regions clear` empties the outline.

## Filling {/* #filling */}

The fill spreads from the column you look at, by the sides of columns, so an outline touching
only at corners holds it too:

- **A closed outline** becomes the region: its inside with the outline itself.
- **An outline drawn up to other regions** of the layer need not close by itself: their borders
  close it, and the new region ends next to them, sharing nothing. A gap that other regions enclose
  on every side fills with no outline at all.
- **An arc on the region's own border** grows the region.
- **A shape covering other regions** asks which side gives way: Cut the new region (it keeps out of
  the others) or Cut the existing ones (they lose what the new shape covers), clickable for a
  minute. You are told when a region loses all its columns or falls apart into pieces.
- **An open shape** tells the column the fill got out at.

A region's border is its own row of columns: where two regions meet, you see two rows, one each.
Filled shapes are saved at once; the outlines are not, and a restart forgets them.

## Commands and permission {/* #commands */}

All of `/regions` needs `versatia.regions.command.regions` (op by default):

| Command | Does |
|---|---|
| `/regions draw <region>` | starts drawing a region, in its world |
| `/regions stop` | stops drawing |
| `/regions clear` | empties the outline of the region you draw |
| `/regions here` | lists the region of each layer at your column |
| `/regions resolve new` or `existing` | answers which side a filled shape cuts |
| `/regions delete <region>` | tells how many columns a region has and offers to delete them; `confirm` deletes |

## Files {/* #files */}

The shapes are kept in the world's folder, one file per layer, so they travel with the map:
`<world>/VersatiaRegions/regions/<layer>.bin`. Back them up with the world. A copy of the map
from your builders brings its shapes; its regions must be in your `regions.yml`.

```yaml title="plugins/VersatiaRegions/config.yml"
editor:
  tool: BLAZE_ROD
  reach: 128
  render-radius: 48
  draft-block: LIME_STAINED_GLASS
  existing-block: LIGHT_BLUE_STAINED_GLASS
```

| Key | What it is |
|---|---|
| `editor.tool` | the item builders draw with, a material name |
| `editor.reach` | how far a click into the air reaches, in blocks |
| `editor.render-radius` | how far from a builder outlines and borders show, 1 to 128 blocks; each marked column is an entity only builders see |
| `editor.draft-block`, `editor.existing-block` | the blocks marking the outline drawn and the borders of the regions there |

The texts builders read, and the sentence a player reads when a plugin stops them crossing into a
region without a reason of its own (`move.denied`), are in `messages/regions.yml` with the regions'
names; [Editing messages](../messages.md) explains the format.

## Corner cases {/* #corner-cases */}

- **A region removed from regions.yml whose columns are still in a file** fails the start,
  naming the file and the region: put it back, then delete its columns with `/regions delete`.
- **Another builder changing the layer** while your fill is worked out asks you to fill again.
- **A region removed by a reload** while you draw it ends your drawing at your next click.
- **Unloaded chunks** show no marks until you come closer.
- **A fill over a box of more than 268 million columns** is refused.
